-- Tests for chats + messages: RLS, column grants,
-- the touch_chat() trigger, limits and cascades.
--
-- Same pattern as the other files: one transaction,
-- rolled back at the end, so no data is ever kept.

begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- Two anonymous visitors. The trigger gives each a
-- session. Ids end in ...a1 and ...b1 so they don't
-- clash with the other test files' users.
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000b1', true);

-- B owns a course, so we can check A can't use it.
insert into public.courses (id, session_id, name) values
  ('00000000-0000-0000-0000-0000000000cb',
   '00000000-0000-0000-0000-0000000000b1', 'B private');

------------------------------------------------------
-- Visitor A
------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

-- 1. No session_id sent: the default fills it in.
select lives_ok($$
  insert into public.chats (id, course_id, title) values
    ('00000000-0000-0000-0000-00000000c4a1',
     '00000000-0000-0000-0000-00000000c001',
     'DP vs greedy')
$$, 'A can start a chat on a sample course');

select is(
  (select session_id from public.chats
    where id = '00000000-0000-0000-0000-00000000c4a1'),
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'session_id defaults to the visitor (auth.uid())');

-- 42501 = RLS refused the new row.
select throws_ok($$
  insert into public.chats (session_id, course_id, title) values
    ('00000000-0000-0000-0000-0000000000b1',
     '00000000-0000-0000-0000-00000000c001', 'Planted')
$$, '42501', null,
  'A cannot create a chat in B''s session');

select throws_ok($$
  insert into public.chats (course_id, title) values
    ('00000000-0000-0000-0000-0000000000cb', 'Sneaky')
$$, '42501', null,
  'A cannot attach a chat to B''s course');

-- 23514 = check_violation.
select throws_ok($$
  insert into public.chats (course_id, title) values
    ('00000000-0000-0000-0000-00000000c001', '  padded  ')
$$, '23514', null,
  'titles with spaces at the ends are rejected');

select throws_ok($$
  insert into public.chats (course_id, title) values
    ('00000000-0000-0000-0000-00000000c001', repeat('x', 81))
$$, '23514', null,
  'titles over 80 characters are rejected');

-- A question and its answer, saved together.
select lives_ok($$
  insert into public.messages (chat_id, role, content, answer) values
    ('00000000-0000-0000-0000-00000000c4a1', 'user',
     'When does DP beat greedy?', null),
    ('00000000-0000-0000-0000-00000000c4a1', 'assistant',
     'When choices overlap.', '{"claims":["When choices overlap."]}')
$$, 'A can add a question and an answer to her chat');

select results_eq($$
  select role from public.messages
   where chat_id = '00000000-0000-0000-0000-00000000c4a1'
   order by id
$$, $$ values ('user'), ('assistant') $$,
  'messages come back in the order they were saved');

select throws_ok($$
  insert into public.messages (chat_id, role, content, answer) values
    ('00000000-0000-0000-0000-00000000c4a1', 'user',
     'Hi', '{"claims":[]}')
$$, '23514', null,
  'a question cannot carry an answer');

select throws_ok($$
  insert into public.messages (chat_id, role, content) values
    ('00000000-0000-0000-0000-00000000c4a1', 'assistant', 'No JSON')
$$, '23514', null,
  'an answer must carry its JSON');

-- Rename works (title has a column grant)...
select lives_ok($$
  update public.chats set title = 'DP vs greedy (exam)'
   where id = '00000000-0000-0000-0000-00000000c4a1'
$$, 'A can rename her chat');

-- ...but other columns have none: 42501 from GRANTs,
-- before RLS is even consulted.
select throws_ok($$
  update public.chats
     set course_id = '00000000-0000-0000-0000-00000000c002'
   where id = '00000000-0000-0000-0000-00000000c4a1'
$$, '42501', null,
  'A cannot move a chat to another course');

select throws_ok($$
  update public.messages set content = 'edited'
   where chat_id = '00000000-0000-0000-0000-00000000c4a1'
$$, '42501', null,
  'messages cannot be edited');

------------------------------------------------------
-- touch_chat(): a new message moves the chat to now
------------------------------------------------------
-- now() is fixed for the whole transaction, so push
-- updated_at back a day as admin, add a message as A,
-- and check it came back to now().
reset role;
update public.chats
   set updated_at = now() - interval '1 day'
 where id = '00000000-0000-0000-0000-00000000c4a1';

set local role authenticated;
insert into public.messages (chat_id, role, content) values
  ('00000000-0000-0000-0000-00000000c4a1', 'user', 'And knapsack?');

select is(
  (select updated_at from public.chats
    where id = '00000000-0000-0000-0000-00000000c4a1'),
  now(),
  'a new message bumps the chat''s updated_at');

------------------------------------------------------
-- Visitor B
------------------------------------------------------
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

select is_empty($$
  select 1 from public.chats
  union all
  select 1 from public.messages
$$, 'B sees none of A''s chats or messages');

select throws_ok($$
  insert into public.messages (session_id, chat_id, role, content) values
    ('00000000-0000-0000-0000-0000000000b1',
     '00000000-0000-0000-0000-00000000c4a1', 'user', 'Planted')
$$, '42501', null,
  'B cannot add a message to A''s chat');

-- RLS hides A's row from B, so these change 0 rows
-- without an error. Check the result as admin.
update public.chats set title = 'Hacked'
 where id = '00000000-0000-0000-0000-00000000c4a1';
delete from public.chats
 where id = '00000000-0000-0000-0000-00000000c4a1';

reset role;
select is(
  (select title from public.chats
    where id = '00000000-0000-0000-0000-00000000c4a1'),
  'DP vs greedy (exam)',
  'B cannot rename or delete A''s chat');

------------------------------------------------------
-- Limits
------------------------------------------------------
set local role authenticated;

-- B fills up to the 100-chat limit; the 101st fails.
insert into public.chats (course_id, title)
select '00000000-0000-0000-0000-00000000c001', 'Chat ' || n
  from generate_series(1, 100) n;

select throws_ok($$
  insert into public.chats (course_id, title) values
    ('00000000-0000-0000-0000-00000000c001', 'One too many')
$$, '23514', 'A demo can hold 100 chats.',
  'a session can hold at most 100 chats');

-- One chat fills up to 200 messages; the 201st fails.
insert into public.messages (chat_id, role, content)
select (select id from public.chats where title = 'Chat 1'),
       'user', 'Question ' || n
  from generate_series(1, 200) n;

select throws_ok($$
  insert into public.messages (chat_id, role, content)
  select id, 'user', 'One too many'
    from public.chats where title = 'Chat 1'
$$, '23514', 'This chat is full. Start a new chat.',
  'a chat can hold at most 200 messages');

------------------------------------------------------
-- Not signed in
------------------------------------------------------
set local role anon;

select throws_ok($$ select 1 from public.chats $$,
  '42501', null,
  'someone not signed in cannot read chats');

------------------------------------------------------
-- Cascades
------------------------------------------------------
-- Deleting a chat takes its messages with it.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

delete from public.chats
 where id = '00000000-0000-0000-0000-00000000c4a1';

reset role;
select is_empty($$
  select 1 from public.messages
   where chat_id = '00000000-0000-0000-0000-00000000c4a1'
$$, 'deleting a chat deletes its messages');

-- Deleting the user (what end_session() and the
-- cleanup job do) removes every chat and message of
-- that session, through demo_sessions.
delete from auth.users
 where id = '00000000-0000-0000-0000-0000000000b1';

select is_empty($$
  select 1 from public.chats
   where session_id = '00000000-0000-0000-0000-0000000000b1'
  union all
  select 1 from public.messages
   where session_id = '00000000-0000-0000-0000-0000000000b1'
$$, 'ending a session deletes its chats and messages');

select * from finish();
rollback;