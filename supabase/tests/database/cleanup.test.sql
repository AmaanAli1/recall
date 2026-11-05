-- Tests for cleanup_idle_sessions() and its cron job.
--
-- Same pattern as the other files: one transaction,
-- rolled back at the end, so no data is ever kept.

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

-- Four fake users. The trigger gives each a session.
--   E: anonymous, idle 25 h      -> deleted
--   F: anonymous, active now     -> kept
--   H: anonymous, idle 23 h      -> kept (under 24 h)
--   G: NOT anonymous, idle 25 h  -> kept (real account)
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000e', true),
  ('00000000-0000-0000-0000-00000000000f', true),
  ('00000000-0000-0000-0000-000000000011', true),
  ('00000000-0000-0000-0000-000000000012', false);

-- Pretend time has passed by moving last_active_at
-- back, instead of waiting a day.
update public.demo_sessions
   set last_active_at = now() - interval '25 hours'
 where id in ('00000000-0000-0000-0000-00000000000e',
              '00000000-0000-0000-0000-000000000012');

update public.demo_sessions
   set last_active_at = now() - interval '23 hours'
 where id = '00000000-0000-0000-0000-000000000011';

-- E owns a course, to check the cascade removes it.
insert into public.courses (session_id, name)
values ('00000000-0000-0000-0000-00000000000e', 'E notes');

------------------------------------------------------
-- Visitors can't run it
------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000f","role":"authenticated"}';

-- 42501 = insufficient_privilege.
select throws_ok($$ select public.cleanup_idle_sessions() $$,
  '42501', null,
  'a visitor cannot run the cleanup');

set local role anon;

select throws_ok($$ select public.cleanup_idle_sessions() $$,
  '42501', null,
  'someone not signed in cannot run the cleanup');

reset role;

------------------------------------------------------
-- As admin (the role cron uses): run it
------------------------------------------------------

select has_function('public', 'cleanup_idle_sessions',
  'cleanup_idle_sessions() exists');

select is(public.cleanup_idle_sessions(), 1,
  'the cleanup deletes exactly one user (E)');

select is_empty($$
  select 1 from auth.users
   where id = '00000000-0000-0000-0000-00000000000e'
  union all
  select 1 from public.demo_sessions
   where id = '00000000-0000-0000-0000-00000000000e'
  union all
  select 1 from public.courses
   where session_id = '00000000-0000-0000-0000-00000000000e'
$$, 'an idle session goes, with its user and courses');

select isnt_empty($$
  select 1 from public.demo_sessions
   where id = '00000000-0000-0000-0000-00000000000f'
$$, 'an active session is kept');

select isnt_empty($$
  select 1 from public.demo_sessions
   where id = '00000000-0000-0000-0000-000000000011'
$$, 'a session idle for 23 h is kept');

select isnt_empty($$
  select 1 from auth.users
   where id = '00000000-0000-0000-0000-000000000012'
$$, 'a real (non-anonymous) account is never deleted');

select is(
  (select count(*)::int from public.courses
    where session_id is null),
  3, 'the 3 sample courses are untouched');

------------------------------------------------------
-- The schedule
------------------------------------------------------

select is(
  (select schedule from cron.job
    where jobname = 'cleanup-idle-sessions'),
  '17 * * * *',
  'the cleanup is scheduled hourly at minute 17');

select * from finish();
rollback;