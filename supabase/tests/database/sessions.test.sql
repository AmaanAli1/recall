-- Tests for the sample courses and end_session().
--
-- Same pattern as rls.test.sql: one transaction, 
-- rolled back at the end, so no data is ever kept.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- Two fake ANONYMOUS visitors (C and D). Real demo 
-- users are anonymous, and end_session() only deletes 
-- anonymous users, so the flag matters here.
insert into auth.users (id, is_anonymous) values 
  ('00000000-0000-0000-0000-00000000000c', true), 
  ('00000000-0000-0000-0000-00000000000d', true);

------------------------------------------------------
-- As admin: this seed and the name rule
------------------------------------------------------

select is(
    (select count(*)::int from public.courses 
      where session_id is null), 
    3, 'exactly 3 shared sample courses exist');

-- 23505 = unique_violation. Before the "nulls not 
-- distinct" fix, this insert would have succeeded.
select throws_ok($$
  insert into public.courses (session_id, name)
  values (null, 'algorithms')
$$, '23505', null, 
  'two sample courses cannot share a name');

------------------------------------------------------
-- As visitor C
------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = 
  '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';

-- C gets one course of their own for the tests below.
insert into public.courses (session_id, name)
values ('00000000-0000-0000-0000-00000000000c', 'C notes');

select is(
    (select count(*)::int from public.courses), 
    4, 'a visitor sees the 3 samples plus their own');

-- Updates and deletes the policies don't allow change 
-- 0 rows without an error. We check as admin later.
update public.courses set name = 'hacked'
  where session_id is null;
delete from public.courses where session_id is null;

------------------------------------------------------
-- As visitor D: their own course, then Start fresh
------------------------------------------------------

set local request.jwt.claims = 
  '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';

insert into public.courses (session_id, name)
values ('00000000-0000-0000-0000-00000000000d', 'D notes');

select is(
  (select count(*)::int from public.courses),
  4, 'D sees the samples and only their own course');

select lives_ok($$ select public.end_session() $$,
  'a visitor can end their own session');

------------------------------------------------------
-- As a visitor who is NOT signed in (role anon)
------------------------------------------------------

set local role anon;

-- 42501 = insufficient_privilege: anon has no
-- execute right on end_session() at all.
select throws_ok($$ select public.end_session() $$,
  '42501', null,
  'someone not signed in cannot call end_session()');

------------------------------------------------------
-- Back to admin to check what really happened
------------------------------------------------------

reset role;

select is(
  (select count(*)::int from public.courses
    where session_id is null and name <> 'hacked'),
  3, 'visitors cannot rename or delete sample courses');

select is_empty($$
  select 1 from public.demo_sessions
   where id = '00000000-0000-0000-0000-00000000000d'
  union all
  select 1 from public.courses
   where session_id = '00000000-0000-0000-0000-00000000000d'
$$, 'end_session() removed D''s session and courses');

select is(
  (select count(*)::int from public.courses
    where session_id = '00000000-0000-0000-0000-00000000000c'),
  1, 'end_session() left other visitors alone');

select * from finish();
rollback;