-- Sample courses + end_session().
--
-- 1. Fix: sample courses could share a name.
-- 2. Seed the 3 shared sample coures.
-- 3. end_session(): lets a visitor delete their own
--    session ("Start fresh").

------------------------------------------------------
-- 1. One name per session, sample courses included
------------------------------------------------------

-- The old index treated NULLs as all different, so two
-- sample courses (session_id is null) could both be 
-- called "Algorithms". "nulls not distinct" (Postgres
-- 15+) makes NULL count as one value, like a session.
-- An index can't be altered in place: drop, recreate.
drop index public.courses_name_per_session;

create unique index courses_name_per_session
  on public.courses (session_id, lower(name))
  nulls not distinct;

------------------------------------------------------
-- 2. The 3 shared sample courses
------------------------------------------------------

-- session_id = null means "shared". Every visitor can
-- read them through the existing policy "read own and 
-- sample courses". Nobody can edit or delete them: the 
-- update/delete policies require session_id = 
-- auth.uid(), and null never equals anything.
--
-- Fixed ids (instead of random gen_random_uuid()), so 
-- later migrations and tests can point at these exact 
-- courses, e.g. when the sample lecture PDFs are added 
-- in the RAG phase.
--
-- Names and colours match the frontend's mock data, so 
-- the UI looks the same when it switches to real data.
--
-- "on conflict do nothing": if a row would break a 
-- unique rule (same id, or the same name, thanks to the 
-- index from part 1), skip it instead of failing. That 
-- makes this insert safe even if a course already exists.
insert into public.courses (id, session_id, name, color)
values
    ('00000000-0000-0000-0000-00000000c001', null, 
     'Algorithms', 'blue'), 
    ('00000000-0000-0000-0000-00000000c002', null, 
     'Operating Systems', 'teal'), 
    ('00000000-0000-0000-0000-00000000c003', null, 
     'Statistics', 'ochre')
on conflict do nothing;

------------------------------------------------------
-- 3. end_session(): "Start fresh"
------------------------------------------------------

-- Deletes the CALLER's own auth user. Everything else 
-- follows through the cascades we already have: 
--   auth.users -> demo_session -> courses (and later 
--   chats, documents...)
--
-- Why a function? Visitors have no rights on 
-- auth.users at all: "security definer" runs this with 
-- the creator's rights, but the WHERE clause keeps it 
-- narrow: only your own id, and only if you're an 
-- anonymous demo user, never a real account.
-- "set search_path = ''" for the same reason as 
-- handle_new_session(): fully spelled-out names only.
create function public.end_session()
returns void
language sql
security definer
set search_path = ''
as $$
   delete from auth.users
    where id = (select auth.uid())
      and is_anonymous;
$$;

-- Postgres lets everyone (PUBLIC_ run a new function by 
-- default, and Supabase also grants it to anon. Take 
-- both away, then allow signed-in visitors only.
revoke execute on function public.end_session()
 from public, anon;

grant execute on function public.end_session()
 to authenticated;
