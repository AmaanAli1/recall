-- Tests for documents + chunks: RLS, read-only access,
-- match_chunks() (retrieval), spend_tokens() (budget),
-- constraints and the cleanup cascade.
--
-- Same pattern as the other files: one transaction,
-- rolled back at the end, so no data is ever kept.

begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- A test vector: 1,536 zeros with a single 1 at
-- position i. Two of them are either identical
-- (similarity 1) or unrelated (similarity 0), which
-- makes the expected order obvious. pg_temp = a
-- function that only exists for this connection.
create function pg_temp.vec(i integer)
returns extensions.vector
language sql
immutable
as $$
  select (array_fill(0::real, array[i - 1])
          || 1::real
          || array_fill(0::real, array[1536 - i]))::extensions.vector;
$$;

-- Two anonymous visitors (ids ...a2 / ...b2, so they
-- don't clash with the other files' users). The
-- trigger gives each a session with a 50,000 budget.
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a2', true),
  ('00000000-0000-0000-0000-0000000000b2', true);

-- A owns a course.
insert into public.courses (id, session_id, name) values
  ('00000000-0000-0000-0000-0000000000ca',
   '00000000-0000-0000-0000-0000000000a2', 'A private');

-- As admin (the role the ingest script uses):
--   d001 = a sample document in the sample Algorithms
--          course (session_id NULL), ready
--   d002 = a sample document still embedding
--   d00a = A's own document in A's course, ready
insert into public.documents (id, course_id, session_id, name, pages, sha256, status) values
  ('00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-00000000c001', null,
   'Ch3_DP.pdf', 40, repeat('a', 64), 'ready'),
  ('00000000-0000-0000-0000-00000000d002',
   '00000000-0000-0000-0000-00000000c001', null,
   'Ch4_Greedy.pdf', 30, repeat('b', 64), 'embedding'),
  ('00000000-0000-0000-0000-00000000d00a',
   '00000000-0000-0000-0000-0000000000ca',
   '00000000-0000-0000-0000-0000000000a2',
   'A_notes.pdf', 2, repeat('c', 64), 'ready');

insert into public.chunks (document_id, page, chunk_index, content, token_count, embedding) values
  ('00000000-0000-0000-0000-00000000d001', 4, 0, 'Greedy fails when...', 10, pg_temp.vec(1)),
  ('00000000-0000-0000-0000-00000000d001', 11, 1, 'Knapsack...', 10, pg_temp.vec(2)),
  ('00000000-0000-0000-0000-00000000d002', 2, 0, 'Not ready yet', 10, pg_temp.vec(1)),
  ('00000000-0000-0000-0000-00000000d00a', 1, 0, 'A private note', 10, pg_temp.vec(3));

------------------------------------------------------
-- Visitor A
------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

-- 1-2. Reading: samples plus your own.
select is(
  (select count(*)::int from public.documents),
  3, 'A sees the 2 sample documents and their own');

select is(
  (select count(*)::int from public.chunks),
  4, 'A sees the chunks of all 3');

-- 3-6. Writing: refused. 42501 = no privilege (the
-- grant is SELECT only, so Postgres stops it before
-- RLS even looks).
select throws_ok($$
  insert into public.documents (course_id, name, pages, sha256)
  values ('00000000-0000-0000-0000-0000000000ca', 'x.pdf', 1, repeat('d', 64))
$$, '42501', null, 'A cannot add a document (not yet: December)');

select throws_ok($$
  update public.documents set status = 'ready'
   where id = '00000000-0000-0000-0000-00000000d002'
$$, '42501', null, 'A cannot change a document''s status');

select throws_ok($$
  insert into public.chunks (document_id, page, chunk_index, content, token_count, embedding)
  values ('00000000-0000-0000-0000-00000000d00a', 1, 9, 'planted', 1, pg_temp.vec(1))
$$, '42501', null, 'A cannot plant a chunk, even in their own document');

select throws_ok($$
  delete from public.chunks
$$, '42501', null, 'A cannot delete chunks');

-- 7-11. Retrieval: the sample course, then A's own.
select is(
  (select array_agg(page order by similarity desc)
     from public.match_chunks(pg_temp.vec(1),
          '00000000-0000-0000-0000-00000000c001', 8)),
  array[4, 11],
  'match_chunks returns the sample chunks, closest first, with pages');

select is(
  (select similarity from public.match_chunks(pg_temp.vec(1),
          '00000000-0000-0000-0000-00000000c001', 1)),
  1::double precision,
  'an identical vector has similarity 1');

select is(
  (select count(*)::int from public.match_chunks(pg_temp.vec(1),
          '00000000-0000-0000-0000-00000000c001', 1)),
  1, 'match_count limits the rows');

select ok(
  not exists (select 1 from public.match_chunks(pg_temp.vec(1),
              '00000000-0000-0000-0000-00000000c001', 20)
               where content = 'Not ready yet'),
  'documents still embedding are never searched');

select is(
  (select document_name from public.match_chunks(pg_temp.vec(3),
          '00000000-0000-0000-0000-0000000000ca', 8)),
  'A_notes.pdf', 'A can search their own course');

-- 12-14. Budget.
select is(
  public.spend_tokens(1200), 48800,
  'spend_tokens adds to tokens_used and returns what is left');

select throws_ok($$ select public.spend_tokens(0) $$,
  '22023', null, 'spend_tokens refuses 0');

select throws_ok($$ select public.spend_tokens(-5000) $$,
  '22023', null, 'spend_tokens refuses a negative amount (no refunds)');

------------------------------------------------------
-- Visitor B
------------------------------------------------------
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';

select is(
  (select count(*)::int from public.documents),
  2, 'B sees only the sample documents');

select is_empty($$
  select 1 from public.chunks where content = 'A private note'
$$, 'B cannot read A''s chunks');

-- security invoker: RLS applies inside the function.
select is_empty($$
  select 1 from public.match_chunks(pg_temp.vec(3),
         '00000000-0000-0000-0000-0000000000ca', 8)
$$, 'match_chunks finds nothing in A''s course for B');

select is(
  public.spend_tokens(100), 49900,
  'B spends from B''s own budget');

------------------------------------------------------
-- Not signed in
------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$
  select * from public.match_chunks(pg_temp.vec(1),
         '00000000-0000-0000-0000-00000000c001', 8)
$$, '42501', null, 'anon cannot call match_chunks');

select throws_ok($$ select public.spend_tokens(10) $$,
  '42501', null, 'anon cannot call spend_tokens');

------------------------------------------------------
-- Admin checks
------------------------------------------------------
reset role;

select is(
  (select tokens_used from public.demo_sessions
    where id = '00000000-0000-0000-0000-0000000000a2'),
  1200, 'B''s spending did not touch A''s session');

-- 23505 = unique_violation: same file, same course,
-- both samples (NULL owner). nulls not distinct.
select throws_ok($$
  insert into public.documents (course_id, session_id, name, pages, sha256)
  values ('00000000-0000-0000-0000-00000000c001', null,
          'Copy.pdf', 40, repeat('a', 64))
$$, '23505', null, 'the same sample PDF cannot be added twice to a course');

-- 23514 = check_violation.
select throws_ok($$
  insert into public.chunks (document_id, page, chunk_index, content, token_count, embedding)
  values ('00000000-0000-0000-0000-00000000d001', 0, 7, 'x', 1, pg_temp.vec(1))
$$, '23514', null, 'pages are counted from 1');

-- Cleanup: deleting A's user cascades to the session,
-- the course, the document and its chunks. Samples
-- stay.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a2';

select is(
  (select count(*)::int from public.chunks
    where content in ('A private note', 'Greedy fails when...')),
  1, 'deleting a session removes its chunks and keeps the samples');

select * from finish();
rollback;