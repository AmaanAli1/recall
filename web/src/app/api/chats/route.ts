import { NextResponse } from "next/server";
import { isUuid } from "@/lib/chats";
import { apiError } from "@/lib/supabase/errors";
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

/*
 * No POST here any more (security pass, 2026-11-27). POST /api/chats took
 * the answer from the BROWSER and saved it: a leftover from before real
 * answers existed. Real answers are saved by the server in POST /api/ask,
 * from the RAG service's reply, so a client can't put words in Recall's
 * mouth through our own API. Next.js answers a POST here with 405.
 */
