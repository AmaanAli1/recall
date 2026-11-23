-- Demo clean-up (decided 2026-11-23).
--
-- 1. Remove the Operating Systems and Statistics sample
--    courses: they never had real PDFs, so every answer
--    there was "not found".
-- 2. Add one simple sample course, Everyday Math. Its PDFs
--    (two chapters of OpenStax Prealgebra 2e, CC BY 4.0)
--    are loaded later by the ingest script, like Algorithms.
-- 3. A visitor can create 1 course of their own (was 10).
--    Every upload costs embeddings and storage, and the demo
--    is free and anonymous. Sample courses don't count.

------------------------------------------------------
-- 1. Remove two sample courses
------------------------------------------------------

-- "on delete cascade" (chats, messages, documents, chunks)
-- removes everything that hung off them: visitors' chats
-- in those courses, which only ever said "not found".
-- session_id is null = a sample course, so this can never
-- touch a visitor's own course with the same id.
delete from public.courses
 where session_id is null
   and id in ('00000000-0000-0000-0000-00000000c002',
              '00000000-0000-0000-0000-00000000c003');

------------------------------------------------------
-- 2. Add Everyday Math
------------------------------------------------------

-- A new fixed id (c004), not a reused one: a visitor's old
-- link or chat to c002 must not quietly turn into math.
-- "on conflict do nothing": safe to run twice.
insert into public.courses (id, session_id, name, color)
values ('00000000-0000-0000-0000-00000000c004', null,
        'Everyday Math', 'green')
on conflict do nothing;

------------------------------------------------------
-- 3. One course of your own
------------------------------------------------------

-- Same function as the first migration, new number and
-- message. "create or replace" swaps the body in place;
-- the trigger that calls it stays as it is. The message is
-- shown to visitors (the API lists it as safe), so it must
-- match COURSE_LIMIT_MESSAGE in web/src/lib/courses.ts.
--
-- Courses a session already has above the limit stay until
-- the session is cleaned up: the trigger only runs on insert.
create or replace function public.enforce_course_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.courses
       where session_id = new.session_id) >= 1 then
    raise exception 'A demo can hold 1 course of your own.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
