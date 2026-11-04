import { NextResponse } from "next/server";
import { apiError } from "@/lib/supabase/errors";
import { toDemoSession } from "@/lib/supabase/mappers";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/demo-sessions/me: the visitor's current session.
 * 401 when there isn't one; the frontend turns 401 into "no session".
 */
export async function GET() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) return apiError("No demo session.", 401);

  // maybeSingle(): 0 rows is not an error. That happens when the token is
  // still in the cookie but the session was deleted (Start fresh in another
  // tab, or the 24 h cleanup).
  const { data: row, error } = await supabase
    .from("demo_sessions")
    .select("code, created_at, last_active_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) return apiError("Couldn't load your demo session.", 500, error);
  if (!row) return apiError("No demo session.", 401);

  return NextResponse.json(toDemoSession(row));
}

/**
 * DELETE /api/demo-sessions/me: "Start fresh".
 *
 * end_session() (our database function) deletes the visitor's auth user, and
 * the cascades remove their session and everything in it. Then signOut()
 * clears the session cookies. Order matters: end_session() needs the token,
 * so it runs first.
 */
export async function DELETE() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  // No session: nothing to delete. Still a success, so DELETE can safely be
  // called twice (that property is called "idempotent").
  if (!claimsData?.claims.sub) return new NextResponse(null, { status: 204 });

  const { error } = await supabase.rpc("end_session");
  if (error) return apiError("Couldn't delete your demo session.", 500, error);

  // scope "local": only this browser. The user no longer exists, and
  // signOut() ignores the "user not found" reply while clearing the cookies.
  await supabase.auth.signOut({ scope: "local" });

  // 204 No Content: done, nothing to send back.
  return new NextResponse(null, { status: 204 });
}