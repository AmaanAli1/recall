import { NextResponse } from "next/server";
import { isUuid, parseExchange } from "@/lib/chats";
import { apiError, dbError } from "@/lib/supabase/errors";
import { toChatMessage } from "@/lib/supabase/mappers";
import { createClient } from "@/lib/supabase/server";

/** The message columns the API sends back (see MessageRow in mappers.ts). */
const MESSAGE_COLUMNS = "id, role, content, answer, created_at";

/** Next.js 16: params of a dynamic segment ([id]) arrive as a Promise. */
type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/chats/<id>/messages: every message in one chat, in order.
 *
 * Two questions for the database: does this chat exist for me, and what's
 * in it? With only the second, "no messages" would look the same for an
 * empty chat and for someone else's chat. Not yours → 404, never 403, so
 * the API doesn't confirm that another visitor's chat id is real.
 */
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return apiError("Chat not found.", 404);

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims.sub) return apiError("No demo session.", 401);

  // RLS returns the chat only if it's in the visitor's session.
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (chatError) return apiError("Couldn't load this chat.", 500, chatError);
  if (!chat) return apiError("Chat not found.", 404);

  const { data: rows, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("chat_id", id)
    // The identity id keeps a question before its answer (same created_at).
    .order("id", { ascending: true });

  if (error) return apiError("Couldn't load this chat.", 500, error);

  return NextResponse.json(rows.map(toChatMessage));
}

/**
 * POST /api/chats/<id>/messages { question, answer }: a follow-up in an
 * open chat. Saves both in one insert (one statement: both or neither).
 * The touch_chat() trigger then moves the chat to the top of the sidebar.
 * 201 with the two new messages.
 */
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return apiError("Chat not found.", 404);

  const body: unknown = await request.json().catch(() => null);
  const parsed = parseExchange(body);
  if (!parsed.ok) return apiError(parsed.error, 400);
  const { question, answerText, answer } = parsed.value;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims.sub) return apiError("No demo session.", 401);

  const { data: rows, error } = await supabase
    .from("messages")
    .insert([
      { chat_id: id, role: "user", content: question },
      { chat_id: id, role: "assistant", content: answerText, answer },
    ])
    .select(MESSAGE_COLUMNS);

  if (error) {
    // RLS refused: the chat isn't in this visitor's session (or doesn't
    // exist). Same 404 as GET, for the same reason.
    if (error.code === "42501") return apiError("Chat not found.", 404, error);
    // The 200-message limit → 409 with its message; anything else → 500.
    return dbError(error, "Couldn't save this message.");
  }

  return NextResponse.json(rows.map(toChatMessage), { status: 201 });
}