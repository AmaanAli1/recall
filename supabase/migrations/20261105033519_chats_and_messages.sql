-- Chats + messages.
--
-- A chat is one conversation about one course, owned
-- by one demo session. Messages are the questions and
-- answers inside it, in order.
--
-- Same security model as courses, two layers:
--   1. GRANTs (section 4): which tables and columns
--      visitors may use at all, and for what.
--   2. RLS (sections 1-2): which rows. Always your
--      own session's.

------------------------------------------------------
-- 1. Chats
------------------------------------------------------
create table public.chats (
  id uuid primary key default gen_random_uuid(),

  -- The owner. "default auth.uid()" fills it in from
  -- the visitor's token, so the API never has to send
  -- it (and can't get it wrong). RLS still checks it.
  -- Cascade: deleting the session (cleanup or
  -- "Start fresh") deletes its chats.
  session_id uuid not null default auth.uid()
    references public.demo_sessions (id) on delete cascade,

  -- Every chat belongs to one course. Deleting the
  -- course deletes its chats.
  course_id uuid not null
    references public.courses (id) on delete cascade,

  -- 1-80 characters, no spaces at either end, and no
  -- control characters (tabs, newlines, invisible
  -- bytes). The frontend trims too; this is the gate.
  title text not null
    check (char_length(title) between 1 and 80
           and title = btrim(title)
           and title !~ '[[:cntrl:]]'),

  pinned boolean not null default false,
  created_at timestamptz not null default now(),

  -- When the last message arrived. The sidebar sorts
  -- by it and groups it into Today / This week /
  -- Earlier. Set by the touch_chat() trigger below,
  -- not by visitors (see the column grants).
  updated_at timestamptz not null default now()
);

-- The sidebar's query: one session's chats for one
-- course, newest first. This index serves it, and its
-- first column also covers the session_id foreign key
-- (deleting a session finds its chats quickly).
create index chats_session_course_idx
  on public.chats (session_id, course_id, updated_at desc);

-- course_id is a foreign key too: deleting a course
-- has to find its chats.
create index chats_course_id_idx
  on public.chats (course_id);

alter table public.chats enable row level security;

create policy "read own chats"
  on public.chats for select
  to authenticated
  using (session_id = (select auth.uid()));

-- Two checks on the NEW row: it's yours, and its
-- course is one you can see (yours or a sample). Without
-- the second, you could attach a chat to another
-- visitor's course if you guessed its id.
create policy "create own chats"
  on public.chats for insert
  to authenticated
  with check (
    session_id = (select auth.uid())
    and exists (
      select 1 from public.courses c
       where c.id = course_id
         and (c.session_id is null
              or c.session_id = (select auth.uid()))
    )
  );

-- Rename and pin. The column grants (section 4) mean
-- only title and pinned can change at all.
create policy "update own chats"
  on public.chats for update
  to authenticated
  using (session_id = (select auth.uid()))
  with check (session_id = (select auth.uid()));

create policy "delete own chats"
  on public.chats for delete
  to authenticated
  using (session_id = (select auth.uid()));

------------------------------------------------------
-- 2. Messages
------------------------------------------------------
create table public.messages (
  -- A counting number, not a uuid: a question and its
  -- answer are saved in the same statement, so they
  -- get the same created_at. The id keeps their order.
  id bigint generated always as identity primary key,

  chat_id uuid not null
    references public.chats (id) on delete cascade,

  -- Stored again here (it's also on the chat) so the
  -- RLS check is a plain comparison with no join, and
  -- so deleting a session cascades straight here.
  session_id uuid not null default auth.uid()
    references public.demo_sessions (id) on delete cascade,

  role text not null
    check (role in ('user', 'assistant')),

  -- The question, or the answer's text. Questions up
  -- to 2,000 characters (the composer's limit).
  content text not null
    check (char_length(content) between 1 and
           case when role = 'user' then 2000 else 8000 end),

  -- The full answer (claims, sources, timing) as JSON,
  -- only on assistant messages. Questions never have
  -- one; answers always do. Capped at 64 kB so nobody
  -- can store huge blobs.
  answer jsonb
    check (pg_column_size(answer) <= 65536),
  check ((role = 'assistant') = (answer is not null)),
  check (answer is null or jsonb_typeof(answer) = 'object'),

  created_at timestamptz not null default now()
);

-- Opening a chat reads its messages in order.
create index messages_chat_id_idx
  on public.messages (chat_id, id);

-- Foreign key index: the hourly cleanup deletes whole
-- sessions, and without this Postgres would scan every
-- message to find a session's ones.
create index messages_session_id_idx
  on public.messages (session_id);

alter table public.messages enable row level security;

create policy "read own messages"
  on public.messages for select
  to authenticated
  using (session_id = (select auth.uid()));

-- The new message must be yours AND go into a chat
-- of yours. RLS on chats also applies inside this
-- subquery, so another visitor's chat can't be found.
create policy "add messages to own chats"
  on public.messages for insert
  to authenticated
  with check (
    session_id = (select auth.uid())
    and exists (
      select 1 from public.chats ch
       where ch.id = chat_id
         and ch.session_id = (select auth.uid())
    )
  );

-- Deliberately NO update or delete policy: messages
-- are a record of what was asked and answered. They
-- go away only with their chat (the cascade).

------------------------------------------------------
-- 3. Triggers: keep updated_at fresh, enforce limits
------------------------------------------------------

-- After a message is added, move its chat to "now".
-- security definer: visitors may not update
-- updated_at themselves (no column grant), so this
-- runs with the owner's rights. It can only touch the
-- one chat the new message belongs to. Functions that
-- return "trigger" can't be called directly.
create function public.touch_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chats
     set updated_at = now()
   where id = new.chat_id;
  return new;
end;
$$;

create trigger messages_touch_chat
  after insert on public.messages
  for each row execute function public.touch_chat();

-- Limits, so one visitor can't fill the database by
-- calling the API (or Supabase directly) in a loop.
-- Same pattern as the 10-course limit. Not security
-- definer: a visitor counting their own rows is fine.
create function public.enforce_chat_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.chats
       where session_id = new.session_id) >= 100 then
    raise exception 'A demo can hold 100 chats.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger chats_limit
  before insert on public.chats
  for each row execute function public.enforce_chat_limit();

create function public.enforce_message_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.messages
       where chat_id = new.chat_id) >= 200 then
    raise exception 'This chat is full. Start a new chat.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger messages_limit
  before insert on public.messages
  for each row execute function public.enforce_message_limit();

------------------------------------------------------
-- 4. GRANTs (layer 1): exactly what the app needs
------------------------------------------------------
-- Rule since PR #22: revoke everything, then grant
-- precisely, so every database ends up the same.

revoke all on table public.chats from anon, authenticated;
revoke all on table public.messages from anon, authenticated;

-- Chats: read, create, delete...
grant select, insert, delete
  on table public.chats to authenticated;

-- ...and UPDATE on two columns only. A column grant:
-- visitors can rename and pin, but can't move a chat
-- to another course, change its owner, or fake
-- updated_at. Postgres refuses with 42501.
grant update (title, pinned)
  on table public.chats to authenticated;

-- Messages: read and add. No update, no delete.
grant select, insert
  on table public.messages to authenticated;

-- The trigger-only functions: nobody calls them
-- directly. Take away PUBLIC's default execute anyway,
-- so the grants list says exactly what's intended.
revoke execute on function public.touch_chat()
  from public, anon, authenticated;
revoke execute on function public.enforce_chat_limit()
  from public, anon, authenticated;
revoke execute on function public.enforce_message_limit()
  from public, anon, authenticated;