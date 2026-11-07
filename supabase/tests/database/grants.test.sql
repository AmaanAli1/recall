-- Table privileges (GRANTs): layer 1 of database
-- security, before RLS picks rows.
--
-- These pin the exact privileges, so every database
-- (CI, staging, production) must match, whatever
-- defaults Supabase applies to new projects.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

select table_privs_are(
  'public', 'demo_sessions', 'authenticated',
  array['SELECT'],
  'visitors can only read demo_sessions');

select table_privs_are(
  'public', 'demo_sessions', 'anon',
  array[]::text[],
  'not-signed-in users have no access to demo_sessions');

select table_privs_are(
  'public', 'courses', 'authenticated',
  array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'visitors can read and change courses (RLS limits rows)');

select table_privs_are(
  'public', 'courses', 'anon',
  array[]::text[],
  'not-signed-in users have no access to courses');

-- Chats: read, create, delete at table level. UPDATE
-- is a column grant (next two tests), so it doesn't
-- appear here.
select table_privs_are(
  'public', 'chats', 'authenticated',
  array['SELECT', 'INSERT', 'DELETE'],
  'visitors can read, create and delete chats');
 
-- column_privs_are counts table-level grants too, so
-- title shows SELECT/INSERT plus its own UPDATE.
select column_privs_are(
  'public', 'chats', 'title', 'authenticated',
  array['SELECT', 'INSERT', 'UPDATE'],
  'visitors can rename a chat');
 
select column_privs_are(
  'public', 'chats', 'course_id', 'authenticated',
  array['SELECT', 'INSERT'],
  'visitors cannot move a chat to another course');
 
select table_privs_are(
  'public', 'chats', 'anon',
  array[]::text[],
  'not-signed-in users have no access to chats');
 
-- Messages: read and add only.
select table_privs_are(
  'public', 'messages', 'authenticated',
  array['SELECT', 'INSERT'],
  'visitors can read and add messages, never edit them');
 
select table_privs_are(
  'public', 'messages', 'anon',
  array[]::text[],
  'not-signed-in users have no access to messages');


-- Documents + chunks: read only in v1 (the admin 
-- script writes them; visitor uploads are December).
select table_privs_are(
  'public', 'documents', 'authenticated',
  array['SELECT'],
  'visitors can only read documents');
 
select table_privs_are(
  'public', 'documents', 'anon',
  array[]::text[],
  'not-signed-in users have no access to documents');
 
select table_privs_are(
  'public', 'chunks', 'authenticated',
  array['SELECT'],
  'visitors can only read chunks');
 
select table_privs_are(
  'public', 'chunks', 'anon',
  array[]::text[],
  'not-signed-in users have no access to chunks');
 
-- The two RAG functions: signed-in visitors only.
-- (Postgres grants new functions to PUBLIC, which
-- anon is part of, unless the migration revokes it.)
select ok(
  not has_function_privilege('anon',
    'public.match_chunks(extensions.vector, uuid, integer)', 'execute'),
  'anon cannot execute match_chunks');
 
select ok(
  not has_function_privilege('anon',
    'public.spend_tokens(integer)', 'execute'),
  'anon cannot execute spend_tokens');

select * from finish();
rollback;