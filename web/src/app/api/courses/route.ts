import { NextResponse } from "next/server";
import { apiError } from "@/lib/supabase/errors";
import { toCourse } from "@/lib/supabase/mappers";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/courses: the visitor's courses plus the 3 shared sample courses.
 *
 * No WHERE clause for "mine or samples": the RLS policy "read own and sample
 * courses" already filters every row, inside the database.
 */
export async function GET() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims.sub) return apiError("No demo session.", 401);

  const { data: rows, error } = await supabase
    .from("courses")
    .select("id, session_id, name, code, term, color, archived")
    // Samples (session_id null) first, then the visitor's own, oldest first.
    .order("session_id", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .order("name", { ascending: true });

  if (error) return apiError("Couldn't load your courses.", 500, error);

  return NextResponse.json(rows.map((row) => toCourse(row)));
}