/**
 * Fixed ids of the 2 shared sample courses (Operating Systems c002 and
 * Statistics c003 were removed in the 2026-11-23 clean-up).
 *
 * These are the same values the database migration seeds
 * (supabase/migrations/…_sample_courses_and_end_session.sql). The mock uses
 * them too, so mocked documents, answers and chats line up with the real
 * courses the API returns.
 */
export const SAMPLE_COURSE_IDS = {
  algorithms: "00000000-0000-0000-0000-00000000c001",
  everydayMath: "00000000-0000-0000-0000-00000000c004",
} as const;
