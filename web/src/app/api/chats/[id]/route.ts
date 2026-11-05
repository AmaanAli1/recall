import { NextResponse } from "next/server";
import { isUuid, parseChatPatch } from "@/lib/chats";
import { apiError, dbError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

/**
 * Routes for one chat: /api/chats/<id>.
 *
 * The folder is named [id] (square brackets), which makes it a "dynamic
 * segment" in the Next.js App Router: /api/chats/abc… runs this file with
 * params.id = "abc…". In Next.js 16, params is a Promise, so it's awaited.
 */
type Context = { params: Promise<{ id: string }> };

/**
 * PATCH /api/chats/<id> { title? , pinned? }: rename and/or pin. 204.
 *
 * 404 when no row changed: the chat doesn't exist, or it's another
 * visitor's (RLS hides it, so to us it doesn't exist either). Answering
 * 404 in both cases means the API never confirms that someone else's
 * chat id is real.
 */
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return apiError("Chat not found.", 404);

  const body: unknown = await request.json().catch(() => null);
  const parsed = parseChatPatch(body);
  if (!parsed.ok) return apiError(parsed.error, 400);

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims.sub) return apiError("No demo session.", 401);

  // Only the checked fields go to the database (never the raw body), and
  // the column grant would refuse any other column anyway.
  // .select("id") returns the rows that changed, so we can tell
  // "updated" from "nothing matched".
  const { data: rows, error } = await supabase
    .from("chats")
    .update(parsed.value)
    .eq("id", id)
    .select("id");

  if (error) return dbError(error, "Couldn't update this chat.");
  if (!rows || rows.length === 0) return apiError("Chat not found.", 404);

  return new NextResponse(null, { status: 204 });
}

/**
 * DELETE /api/chats/<id>: delete a chat and (by cascade) its messages. 204.
 *
 * Idempotent: deleting a chat that's already gone, or was never yours,
 * is still 204. The Ask sidebar sends this after its Undo window closes,
 * possibly while the tab is closing, so a retry must never show an error.
 */
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse(null, { status: 204 }); // nothing that could exist

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims.sub) return apiError("No demo session.", 401);

  // RLS ("delete own chats") makes this a no-op for anyone else's chat.
  const { error } = await supabase.from("chats").delete().eq("id", id);
  if (error) return dbError(error, "Couldn't delete this chat.");

  return new NextResponse(null, { status: 204 });
}