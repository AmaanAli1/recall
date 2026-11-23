-- The sample courses after the 2026-11-23 clean-up, and
-- the details of the one-course limit.
--
-- One transaction, rolled back at the end: nothing kept.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

------------------------------------------------------
-- The sample courses (as the admin, who sees everything)
------------------------------------------------------

select results_eq($$
    select id::text, name, color from public.courses
     where session_id is null order by id
$$, $$ values
    ('00000000-0000-0000-0000-00000000c001', 'Algorithms', 'blue'),
    ('00000000-0000-0000-0000-00000000c004', 'Everyday Math', 'green')
$$, 'the sample courses are Algorithms and Everyday Math');

select is_empty($$
    select 1 from public.courses
     where id in ('00000000-0000-0000-0000-00000000c002',
                  '00000000-0000-0000-0000-00000000c003')
$$, 'Operating Systems and Statistics are gone');

-- Two fake visitors (the trigger creates their sessions).
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000d');

------------------------------------------------------
-- As visitor C
------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-00000000000c", "role":"authenticated"}';

select is(
    (select count(*)::int from public.courses
      where session_id is null),
    2, 'a visitor sees both sample courses');

-- The samples don't count towards the limit: C has none
-- of their own yet, so one is fine.
select lives_ok($$
    insert into public.courses (session_id, name)
    values ('00000000-0000-0000-0000-00000000000c', 'Mine')
$$, 'the sample courses don''t count towards the limit');

-- An archived course still holds PDFs, so it still counts.
update public.courses set archived = true
 where session_id = '00000000-0000-0000-0000-00000000000c';

select throws_ok($$
    insert into public.courses (session_id, name)
    values ('00000000-0000-0000-0000-00000000000c', 'Second')
$$, '23514', 'A demo can hold 1 course of your own.',
    'an archived course still counts');

-- Deleting it frees the slot again.
delete from public.courses
 where session_id = '00000000-0000-0000-0000-00000000000c';

select lives_ok($$
    insert into public.courses (session_id, name)
    values ('00000000-0000-0000-0000-00000000000c', 'Replacement')
$$, 'deleting your course makes room for a new one');

------------------------------------------------------
-- As visitor D: the limit is per session
------------------------------------------------------

set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-00000000000d", "role":"authenticated"}';

select lives_ok($$
    insert into public.courses (session_id, name)
    values ('00000000-0000-0000-0000-00000000000d', 'Mine')
$$, 'another visitor gets their own course (same name is fine)');

select throws_ok($$
    insert into public.courses (session_id, name)
    values ('00000000-0000-0000-0000-00000000000d', 'More')
$$, '23514', 'A demo can hold 1 course of your own.',
    'and is limited to one as well');

------------------------------------------------------
-- Visitors still can't add sample courses
------------------------------------------------------

-- session_id null = a sample course; the insert policy
-- requires your own session id, so RLS refuses (42501).
select throws_ok($$
    insert into public.courses (session_id, name)
    values (null, 'Fake sample')
$$, '42501', null, 'a visitor cannot create a sample course');

select * from finish();
rollback;
