-- Security tests for demo_sessions and courses. 
--
-- Everything runs inside one transaction that is 
-- rolled back at the end, so no data is ever kept.

begin;
create extension if not exists pgtap with schema extensions;

-- How many tests we promise to run. If one silently 
-- doesn't run, pgTAP fails the file. 
select plan(14);

-- Two fake visitors. Inserting into auth.users fires 
-- our trigger, exactly like a real anonymous sign-in. 
insert into auth.users (id) values 
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

select is(
    (select count(*)::int from public.demo_sessions
     where id in ('00000000-0000-0000-0000-00000000000a',
                  '00000000-0000-0000-0000-00000000000b')),
    2, 'each sign-in creates a session row');

select ok(
    (select code ~ '^demo-[A-Z2-9]{4}-[A-Z2-9]{2}$'
      from public.demo_sessions
    where id = '00000000-0000-0000-0000-00000000000a'),
    'session code has the demo-XXXX-XX shape');

------------------------------------------------------
-- Act as visitor A: switch to the role the API uses. 
-- and set the "who am I" that auth.uid() reads. 
------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-00000000000a", "role":"authenticated"}';

select is(
    (select count(*)::int from public.demo_sessions), 
    1, 'a visitor sees only their own session');

select lives_ok($$
    insert into public.courses (session_id, name, color)
    values ('00000000-0000-0000-0000-00000000000a', 
            'Data Structures', 'rust')
$$, 'a visitor can create a course');

-- 23505 = unique_violation, 23514 = check_violation
select throws_ok($$
    insert into public.courses (session_id, name)
    values ('00000000-0000-0000-0000-00000000000a', 
            'data structures')
$$, '23505', null, 
    'course names are unique per session, ignoring case');

select throws_ok($$
    insert into public.courses (session_id, name, color)
    values ('00000000-0000-0000-0000-00000000000a', 
            'Bad', 'pink')
$$, '23514', null, 'unknown colours are rejected');

select lives_ok($$
    insert into public.courses (session_id, name)
    select '00000000-0000-0000-0000-00000000000a', 
            'Course ' || g
    from generate_series(2, 10) as g
$$, 'up to 10 courses is fine');

select throws_ok($$
    insert into public.courses (session_id, name)
    values ('00000000-0000-0000-0000-00000000000a', 
            'Course 11')
$$, '23514', 'A demo can hold 10 courses.', 
    'the 11th course is blocked');

select lives_ok($$ select public.touch_session() $$, 
    'a visitor can mark their session active');

-- Try to raise our own token budget. There is no 
-- update policy, so this silently changes 0 rows.
-- We check the value later as the admin.
update public.demo_sessions set token_budget = 9999999;

------------------------------------------------------
-- Act as visitor B, and attack A's data.
------------------------------------------------------

set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is_empty($$
    select id from public.courses
    where session_id = '00000000-0000-0000-0000-00000000000a'
$$, 'B cannot see A''s courses');

-- 42501 = insufficient_privilege (RLS said no)
select throws_ok($$
    insert into public.courses (session_id, name)
    values ('00000000-0000-0000-0000-00000000000a', 
            'Sneaky')
$$, '42501', null, 
    'B cannot create a course in A''s session');

-- Also silently 0 rows: B can't even see the rows.
update public.courses set name = 'hacked'
    where session_id = '00000000-0000-0000-0000-00000000000a';

------------------------------------------------------
-- Back to admin (sees everything) to check results.
------------------------------------------------------

reset role;

select is(
    (select token_budget from public.demo_sessions 
        where id = '00000000-0000-0000-0000-00000000000a'), 
    50000, 'A could not raise their token budget');

select is_empty($$
    select 1 from public.courses where name = 'hacked'
$$, 'B could not rename A''s courses');

-- Deleting the user (what cleanup will do) must
-- remove their session and course via cascades.
delete from auth.users
    where id = '00000000-0000-0000-0000-00000000000a';

select is_empty($$
    select 1 from public.courses
        where session_id = '00000000-0000-0000-0000-00000000000a'
$$, 'deleting a visitor can remove their courses');

select * from finish();
rollback;
