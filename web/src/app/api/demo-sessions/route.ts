import { NextResponse } from "next/server";
import { apiError } from "@/lib/supabase/errors";
import { toDemoSession } from "@/lib/supabase/mappers";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/demo-sessions: start a demo session ("Try the demo").
 *
 * 1. If the visitor already has a session (a valid token in their cookies),
 *    reuse it. A double click or a refresh must not create a second one.
 * 2. Otherwise sign them in anonymously. Supabase creates an auth user and
 *    sets the session cookies; our handle_new_session() trigger creates the
 *    matching demo_sessions row with a demo-XXXX-XX code.
 * 3. Read that row back (RLS: you can only read your own) and return it.
 */
export async function POST() {
  const supabase = await createClient();

  // getClaims() verifies the token in the cookies. claims.sub = the user id.
  const { data: claimsData } = await supabase.auth.getClaims();
  let userId = claimsData?.claims.sub;

  if (!userId) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      // 429 = the rate limit we set in Phase 2 (30 per hour per IP).
      if (error?.status === 429) {
        return apiError(
          "Too many new demo sessions from your network. Try again in a little while.",
          429,
          error,
        );
      }
      return apiError("Couldn't start a demo session.", 503, error);
    }
    userId = data.user.id;
  }

  const { data: row, error } = await supabase
    .from("demo_sessions")
    .select("code, created_at, last_active_at")
    .eq("id", userId)
    .single();

  if (error || !row) {
    return apiError("Couldn't load your demo session.", 500, error);
  }

  // 201 Created: a session exists now (new or reused).
  return NextResponse.json(toDemoSession(row), { status: 201 });
}
