-- Explicit table privileges for the API roles.
--
-- Found 2026-11-04: on staging, reading demo_sessions
-- failed with 42501 "permission denied for table
-- demo_sessions". Postgres checks two layers:
--   1. GRANTs: may this role touch the table at all?
--   2. RLS policies: if so, which rows?
-- We wrote layer 2 but relied on Supabase to grant
-- layer 1 automatically. Newer Supabase projects don't;
-- the local CLI database (used by CI) still does. So CI
-- passed while staging failed.
--
-- Fix: never rely on defaults. Revoke everything, then
-- grant exactly what the app needs (least privilege).
-- That gives every database the same privileges.

revoke all on table public.demo_sessions
  from anon, authenticated;
revoke all on table public.courses
  from anon, authenticated;

-- Visitors only READ their session. Rows are created by
-- the handle_new_session() trigger and changed only via
-- touch_session(); both are security definer functions,
-- so visitors need no insert/update/delete here.
grant select on table public.demo_sessions
  to authenticated;

-- Courses: full create/read/update/delete. RLS still
-- limits it to your own rows (samples stay read-only).
grant select, insert, update, delete
  on table public.courses to authenticated;