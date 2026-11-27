-- Courses become read-only for visitors (2026-11-27).
--
-- Why: since PR #53 the public demo is Algorithms only.
-- There's one shared sample course, and no uploads or
-- courses of your own (Q113). The website no longer
-- offers "New course", but a browser check is only UX:
-- anyone with a session could still call the database
-- directly and create a course. The database has to
-- refuse it too.
--
-- Two layers, as everywhere else in Recall:
--   1. GRANTs decide whether a role may touch the table
--      at all. Visitors keep SELECT only.
--   2. RLS policies pick the rows. The three "own
--      courses" policies are dropped: nothing left for
--      them to allow.
-- With the grant gone, an insert, update or delete by a
-- visitor fails at once with 42501 (permission denied),
-- before RLS is even asked.

------------------------------------------------------
-- 1. Remove courses visitors already made
------------------------------------------------------

-- session_id null = the shared sample course, which
-- stays. Every other row belongs to a visitor. Their
-- chats (and any documents) go with them through the
-- "on delete cascade" foreign keys.
delete from public.courses
 where session_id is not null;

------------------------------------------------------
-- 2. Drop the policies that let visitors write
------------------------------------------------------

-- "read own and sample courses" stays. It still lets
-- visitors read the sample, and with no own courses
-- possible, "own" simply never matches.
drop policy "create own courses" on public.courses;
drop policy "update own courses" on public.courses;
drop policy "delete own courses" on public.courses;

------------------------------------------------------
-- 3. Drop the one-course limit
------------------------------------------------------

-- The trigger only existed to count a visitor's own
-- courses before each insert. Drop the trigger first:
-- a function can't be dropped while a trigger uses it.
drop trigger courses_limit on public.courses;
drop function public.enforce_course_limit();

------------------------------------------------------
-- 4. Visitors can only read courses
------------------------------------------------------

-- Layer 1. Revoke exactly what was granted in
-- 20261104052935_explicit_table_grants.sql; SELECT is
-- left as it was.
revoke insert, update, delete
  on table public.courses from authenticated;
