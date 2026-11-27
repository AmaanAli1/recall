-- Courses are read-only for visitors (2026-11-27,
-- migration 20261127040000_read_only_courses.sql).
--
-- The demo has one shared course, Algorithms. Visitors
-- can read it, and nothing else: no creating, renaming
-- or deleting any course, their own included.
--
-- One transaction, rolled back at the end: nothing kept.

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

------------------------------------------------------
-- As admin: the sample course and what was removed
------------------------------------------------------

select results_eq($$
    select id::text, name, color from public.courses
     where session_id is null order by id
$$, $$ values
    ('00000000-0000-0000-0000-00000000c001', 'Algorithms', 'blue')
$$, 'Algorithms is the only sample course');

select is_empty($$
    select 1 from public.courses
     where id in ('00000000-0000-0000-0000-00000000c002',
                  '00000000-0000-0000-0000-00000000c003',
                  '00000000-0000-0000-0000-00000000c004')
$$, 'Operating Systems, Statistics and Everyday Math are gone');

-- The one-course limit is gone with the feature.
select hasnt_trigger('public', 'courses', 'courses_limit',
    'the course-limit trigger is gone');

select hasnt_function('public', 'enforce_course_limit',
    'and so is its function');

-- Only the read policy is left.
select policies_are('public', 'courses',
    array['read own and sample courses'],
    'visitors have a read policy on courses, and nothing else');

-- A fake visitor (the trigger on auth.users creates
-- their session, like a real anonymous sign-in).
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000c');

------------------------------------------------------
-- As visitor C
------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-00000000000c", "role":"authenticated"}';

select is(
    (select count(*)::int from public.courses),
    1, 'a visitor sees the sample course, and only that');

-- 42501 = insufficient_privilege. Visitors have no
-- INSERT/UPDATE/DELETE grant any more, so Postgres
-- refuses before RLS is even asked. Each attempt is
-- inside throws_ok: an error outside it would abort
-- the whole test transaction.
select throws_ok($$
    insert into public.courses (session_id, name)
    values ('00000000-0000-0000-0000-00000000000c', 'Mine')
$$, '42501', null, 'a visitor cannot create a course of their own');

select throws_ok($$
    insert into public.courses (session_id, name)
    values (null, 'Fake sample')
$$, '42501', null, 'a visitor cannot create a sample course');

select throws_ok($$
    update public.courses set name = 'hacked'
     where session_id is null
$$, '42501', null, 'a visitor cannot rename the sample course');

select throws_ok($$
    delete from public.courses where session_id is null
$$, '42501', null, 'a visitor cannot delete the sample course');

select * from finish();
rollback;
