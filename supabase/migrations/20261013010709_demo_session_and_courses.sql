-- Demo sessions + courses.
--
-- A visitor signs in anonymously (Supabase Auth), and
-- that user's id IS their session id. Every row a
-- visitor owns carries it, and row-level security
-- (RLS) makes Postgres check it on every query.

------------------------------------------------------
-- 1. Sessions: one row per anonymous visitor
------------------------------------------------------
create table public.demo_sessions (
  -- Same id as the auth user. "on delete cascade":
  -- deleting the user (24 h cleanup, or "Start fresh")
  -- deletes the session, and through further cascades
  -- all of its data.
  id uuid primary key
    references auth.users (id) on delete cascade,

  -- What the UI shows, e.g. demo-K7QF-3M.
  -- The check rejects anything that isn't that shape.
  code text not null unique
    check (code ~ '^demo-[A-Z2-9]{4}-[A-Z2-9]{2}$'),

  created_at     timestamptz not null default now(),
  -- Cleanup deletes sessions idle for 24 h.
  last_active_at timestamptz not null default now(),

  -- Token budget so one visitor can't run up the bill.
  tokens_used  integer not null default 0
    check (tokens_used >= 0),
  token_budget integer not null default 50000
    check (token_budget > 0)
);

alter table public.demo_sessions enable row level security;

-- Read your own session only. Anonymous users have the
-- "authenticated" role. (select auth.uid()) in brackets
-- is evaluated once per query, not once per row.
create policy "read own session"
  on public.demo_sessions for select
  to authenticated
  using (id = (select auth.uid()));

-- Deliberately NO insert or update policy: visitors
-- must not be able to edit tokens_used or token_budget.
-- Rows are created by the trigger below, and "still
-- active" goes through touch_session(), which can only
-- change last_active_at.

------------------------------------------------------
-- 2. Create the session row automatically on sign-in
------------------------------------------------------

-- n random characters from an alphabet without the
-- look-alikes 0/O and 1/I (same as the mock API).
create function public.random_code(n integer)
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
           1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, n);
$$;

-- Runs after every new auth user. "security definer"
-- runs it with the creator's rights, which lets it
-- insert even though visitors can't. "set search_path
-- = ''" makes us spell out public./auth., so nobody
-- can trick it with a look-alike table name.
create function public.handle_new_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.demo_sessions (id, code)
  values (
    new.id,
    'demo-' || public.random_code(4)
      || '-' || public.random_code(2)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_session();

-- "I'm still here": bumps last_active_at for the
-- caller's own session, and nothing else.
create function public.touch_session()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.demo_sessions
     set last_active_at = now()
   where id = (select auth.uid());
$$;

grant execute on function public.touch_session()
  to authenticated;

------------------------------------------------------
-- 3. Courses
------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),

  -- null = a sample course every session can read.
  -- Otherwise it's the owner's session.
  session_id uuid
    references public.demo_sessions (id) on delete cascade,

  -- Same rules as lib/courses.ts, enforced here too:
  -- the frontend check is only for UX.
  name text not null
    check (char_length(name) between 1 and 60
           and name = btrim(name)),
  code text
    check (code ~ '^[A-Z0-9]{1,12}$'),
  term text
    check (char_length(term) <= 30),
  color text not null default 'blue'
    check (color in ('blue','teal','green',
                     'ochre','rust','plum')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- No two courses with the same name in one session,
-- ignoring case ("Algorithms" = "algorithms").
create unique index courses_name_per_session
  on public.courses (session_id, lower(name));

-- RLS policies filter by session_id on every query,
-- so index it.
create index courses_session_id_idx
  on public.courses (session_id);

alter table public.courses enable row level security;

create policy "read own and sample courses"
  on public.courses for select
  to authenticated
  using (session_id is null
         or session_id = (select auth.uid()));

-- "with check" applies to the NEW row: you can only
-- create courses owned by yourself.
create policy "create own courses"
  on public.courses for insert
  to authenticated
  with check (session_id = (select auth.uid()));

-- "using" picks which rows you may touch; "with check"
-- stops you moving one into someone else's session.
create policy "update own courses"
  on public.courses for update
  to authenticated
  using (session_id = (select auth.uid()))
  with check (session_id = (select auth.uid()));

create policy "delete own courses"
  on public.courses for delete
  to authenticated
  using (session_id = (select auth.uid()));

-- Max 10 courses per session (archived included),
-- checked by the database before every insert.
create function public.enforce_course_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.courses
       where session_id = new.session_id) >= 10 then
    raise exception 'A demo can hold 10 courses.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger courses_limit
  before insert on public.courses
  for each row
  when (new.session_id is not null)
  execute function public.enforce_course_limit();