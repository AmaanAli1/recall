-- Table privileges (GRANTs): layer 1 of database
-- security, before RLS picks rows.
--
-- These pin the exact privileges, so every database
-- (CI, staging, production) must match, whatever
-- defaults Supabase applies to new projects.

begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

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

select * from finish();
rollback;