import { NextResponse } from "next/server";
import { isUuid, parseNewChat, titleFromQuestion } from "@/lib/chats";
import { apiError, dbError } from "@/lib/supabase/errors";
import { toChatRecord } from "@/lib/supabase/mappers";
import { createClient } from "@/lib/supabase/server";

/** The chat columns the API sends back (see ChatRow in mappers.ts). */
const CHAT_COLUMNS = "id, course_id, title, pinned, updated_at";

/**
 * GET /api/chats?courseId=…: the visitor's chats for one course.
 *
 * Pinned first, then the most recently active. No "session_id = me"
 * filter: the RLS policy "read own chats" already does that inside the
 * database, for every query.
 */
export async function GET(request: Request) {
  // Check the id before anything else: a malformed one would otherwise
  // reach Postgres and come back as error 22P02.
  const courseId = new URL(request.url).searchParams.get("courseId");
  if (!isUuid(courseId)) return apiError("Pick a course.", 400);

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims.sub) return apiError("No demo session.", 401);

  const { data: rows, error } = await supabase
    .from("chats")
    .select(CHAT_COLUMNS)
    .eq("course_id", courseId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    // The database allows 100 chats per session, so this is everything.
    .limit(100);

  if (error) return apiError("Couldn't load your chats.", 500, error);

  return NextResponse.json(rows.map(toChatRecord));
}

/**
 * POST /api/chats { courseId, question, answer }: start a chat with its
 * first question and answer. 201 with the new chat.
 *
 * Two writes: the chat, then its two messages. They're separate requests
 * to the database, so they aren't one transaction. If the second fails,
 * we delete the chat we just made (a "compensating action"), so the
 * visitor is never left with an empty chat in the sidebar.
 */
export async function POST(request: Request) {
  // request.json() throws on a body that isn't JSON; treat that as "no body".
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseNewChat(body);
  if (!parsed.ok) return apiError(parsed.error, 400);
  const { courseId, question, answerText, answer } = parsed.value;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims.sub) return apiError("No demo session.", 401);

  // No session_id here: the column defaults to auth.uid(), read from the
  // visitor's token. RLS refuses (42501) if the course isn't one they can
  // see, and the trigger refuses (23514) at the 100-chat limit.
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .insert({ course_id: courseId, title: titleFromQuestion(question) })
    .select(CHAT_COLUMNS)
    .single();

  if (chatError) return dbError(chatError, "Couldn't save this chat.");

  // Both rows in ONE insert = one statement, so they're saved together or
  // not at all. The id column keeps them in order (question, then answer).
  const { error: messagesError } = await supabase.from("messages").insert([
    { chat_id: chat.id, role: "user", content: question },
    { chat_id: chat.id, role: "assistant", content: answerText, answer },
  ]);

  if (messagesError) {
    const { error: undoError } = await supabase.from("chats").delete().eq("id", chat.id);
    if (undoError) console.error("[api] couldn't remove the empty chat", undoError);
    return dbError(messagesError, "Couldn't save this chat.");
  }

  return NextResponse.json(toChatRecord(chat), { status: 201 });
}