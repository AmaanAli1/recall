import { NextResponse } from "next/server";
import { HISTORY_MESSAGES, PASS_THROUGH, answerService, answerText, parseAsk, toHistory, type Turn } from "@/lib/ask";
import type { Answer, ChatRecord } from "@/lib/api/types";
import { titleFromQuestion } from "@/lib/chats";
import { apiError } from "@/lib/supabase/errors";
import { toChatRecord, type ChatRow } from "@/lib/supabase/mappers";
import { createClient } from "@/lib/supabase/server";

/** The chat columns the API sends back (same as /api/chats). */
const CHAT_COLUMNS = "id, course_id, title, pinned, updated_at";

/** The answer service gets 30 s (Lambda's own timeout); then we give up. */
const ANSWER_TIMEOUT_MS = 30_000;

/** Vercel: let this function run past the default for slow answers. */
export const maxDuration = 60;

/**
 * POST /api/ask { courseId, question, chatId? } → { answer, chat, saved }
 *
 * The browser's only way to ask. Step by step:
 *   1. Check the body and who's asking (the session cookie).
 *   2. Follow-up? Make sure the chat is the visitor's BEFORE paying for
 *      an answer (someone else's chat → 404, as in /api/chats), and load
 *      its last few turns: FastAPI uses them to rewrite a vague follow-up
 *      ("why does that fail?") into a question search can use.
 *   3. Ask FastAPI, server to server, with the internal key and the
 *      visitor's own token. FastAPI calls Supabase as the visitor, so RLS
 *      decides what it can search, and it charges the visitor's budget.
 *   4. Save the question and the answer (a new chat, or into chatId).
 *   5. Return the answer, even if saving failed (`saved: false`): the
 *      visitor already waited and paid for it.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseAsk(body);
  if (!parsed.ok) return apiError(parsed.error, 400);
  const { courseId, question, chatId } = parsed.value;

  const service = answerService();
  if (!service) return apiError("Answers aren't set up here yet.", 503, "FASTAPI_URL or FASTAPI_INTERNAL_KEY is missing");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims.sub) return apiError("No demo session.", 401);
  // getClaims() just verified the token, so reading it from the session
  // is safe. FastAPI needs the token itself to act as this visitor.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return apiError("No demo session.", 401);

  // 2. A follow-up must go into one of the visitor's own chats.
  let chat: ChatRecord | null = null;
  if (chatId) {
    const { data: row, error } = await supabase.from("chats").select(CHAT_COLUMNS).eq("id", chatId).maybeSingle();
    if (error) return apiError("Couldn't load this chat.", 500, error);
    if (!row) return apiError("Chat not found.", 404);
    chat = toChatRecord(row as ChatRow);
  }

  // The chat's history comes from the database, never from the browser, so
  // nobody can hand the rewriter a made-up conversation. Newest first (by id:
  // a question and its answer share a created_at), then turned around.
  let history: Turn[] = [];
  if (chat) {
    const { data: rows, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", chat.id)
      .order("id", { ascending: false })
      .limit(HISTORY_MESSAGES);
    // Without history the follow-up is still answered, just not rewritten.
    if (error) console.error("[api] couldn't load the chat's history", error);
    else history = toHistory((rows ?? []) as { role: string; content: string }[]);
  }

  // 3. Ask the answer service.
  let answer: Answer;
  try {
    const res = await fetch(service.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Recall-Internal": service.key,
        Authorization: `Bearer ${token}`,
      },
      // history only when there is some: a first question sends none.
      body: JSON.stringify({ courseId, question, ...(history.length ? { history } : {}) }),
      signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res
        .json()
        .then((b: { detail?: unknown }) => b.detail)
        .catch(() => undefined);
      if (PASS_THROUGH.has(res.status) && typeof detail === "string") return apiError(detail, res.status);
      return apiError("The answer service is having trouble right now. Please try again.", 502, `FastAPI ${res.status}: ${String(detail)}`);
    }
    answer = ((await res.json()) as { answer: Answer }).answer;
  } catch (error) {
    // AbortSignal.timeout throws a "TimeoutError"; anything else is a network failure.
    if (error instanceof Error && error.name === "TimeoutError") {
      return apiError("That took too long to answer. Please try again.", 504, error);
    }
    return apiError("The answer service is having trouble right now. Please try again.", 502, error);
  }

  // 4. Save. Same two-step write as POST /api/chats, with the same undo.
  const messages = (id: string) => [
    { chat_id: id, role: "user", content: question },
    { chat_id: id, role: "assistant", content: answerText(answer), answer },
  ];

  if (chat) {
    const { error } = await supabase.from("messages").insert(messages(chat.id));
    if (error) {
      console.error("[api] couldn't save the follow-up", error);
      return NextResponse.json({ answer, chat, saved: false });
    }
    return NextResponse.json({ answer, chat, saved: true });
  }

  const { data: row, error: chatError } = await supabase
    .from("chats")
    .insert({ course_id: courseId, title: titleFromQuestion(question) })
    .select(CHAT_COLUMNS)
    .single();
  if (chatError || !row) {
    console.error("[api] couldn't create the chat", chatError);
    return NextResponse.json({ answer, chat: null, saved: false });
  }
  const created = toChatRecord(row as ChatRow);

  const { error: messagesError } = await supabase.from("messages").insert(messages(created.id));
  if (messagesError) {
    console.error("[api] couldn't save the messages", messagesError);
    const { error: undoError } = await supabase.from("chats").delete().eq("id", created.id);
    if (undoError) console.error("[api] couldn't remove the empty chat", undoError);
    return NextResponse.json({ answer, chat: null, saved: false });
  }

  return NextResponse.json({ answer, chat: created, saved: true }, { status: 201 });
}
