-- Cleanup job: delete demo sessions idle for 24 h.
--
-- The UI promises "your demo is deleted 24 h after
-- your last visit". This migration keeps that promise:
-- 1. cleanup_idle_sessions() deletes the anonymous
--    users whose session hasn't been active for 24 h.
-- 2. pg_cron runs it every hour, inside the database.

------------------------------------------------------
-- 1. The function
------------------------------------------------------

-- Deletes from auth.users (not demo_sessions), the
-- same way end_session() does. The cascades remove the
-- session row and everything it owns (courses now;
-- chats and documents later), and the visitor's login
-- token stops working, because its user is gone.
--
-- NOT "security definer" this time: the only caller
-- is pg_cron, which runs the job as the role that
-- scheduled it (postgres, the owner, who may already
-- delete from auth.users). Rule: security definer only
-- when a less-privileged role must run it.
--
-- Returns how many users it deleted, so running it by
-- hand in the SQL Editor tells you what it did.
create function public.cleanup_idle_sessions()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  removed integer;
begin
  -- "using" joins a second table into a delete.
  -- Only anonymous users: never a real account.
  delete from auth.users u
   using public.demo_sessions s
   where s.id = u.id
     and u.is_anonymous
     and s.last_active_at < now() - interval '24 hours';

  -- row_count = how many rows the last statement hit.
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Nobody but the owner may run this: it deletes
-- OTHER people's sessions. Postgres gives PUBLIC
-- execute on new functions, and Supabase also gives it
-- to anon and authenticated, so take all three away.
revoke execute on function public.cleanup_idle_sessions()
  from public, anon, authenticated;

------------------------------------------------------
-- 2. Run it every hour with pg_cron
------------------------------------------------------

-- pg_cron is a Postgres extension: a scheduler living
-- inside the database, so no server or GitHub Action
-- has to stay awake for it. It keeps its jobs in the
-- cron schema (cron.job) and a log of every run in
-- cron.job_run_details.
create extension if not exists pg_cron;

-- At minute 17 of every hour (cron format: minute,
-- hour, day of month, month, day of week). Minute 17
-- instead of 0: lots of jobs everywhere start at :00.
-- Scheduling the same name again replaces the job, so
-- this line is safe to run twice.
select cron.schedule(
  'cleanup-idle-sessions',
  '17 * * * *',
  $$ select public.cleanup_idle_sessions() $$
);