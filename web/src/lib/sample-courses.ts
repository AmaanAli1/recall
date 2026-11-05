/**
 * Fixed ids of the 3 shared sample courses.
 *
 * These are the same values the database migration seeds
 * (supabase/migrations/…_sample_courses_and_end_session.sql). The mock uses
 * them too, so mocked documents, answers and chats line up with the real
 * courses the API returns.
 */
export const SAMPLE_COURSE_IDS = {
  algorithms: "00000000-0000-0000-0000-00000000c001",
  operatingSystems: "00000000-0000-0000-0000-00000000c002",
  statistics: "00000000-0000-0000-0000-00000000c003",
} as const;
