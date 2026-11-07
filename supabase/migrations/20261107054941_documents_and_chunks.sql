-- Documents + chunks: what RAG searches.
--
-- A document is one PDF in one course. A chunk is a
-- short passage from ONE page of it, with an
-- embedding (1,536 numbers from OpenAI's
-- text-embedding-3-small) so we can find the passages
-- closest in meaning to a question.
--
-- v1 scope: only the 3 sample courses have documents,
-- loaded by an admin script from Amaan's laptop.
-- Visitors can READ documents and chunks (their own
-- and the samples) but not write them. Visitor uploads
-- come in December, with their own insert policies.
--
-- Same two security layers as every table so far:
--   1. GRANTs (section 6): which tables visitors may
--      touch at all. Here: read only.
--   2. RLS (sections 2 and 4): which rows. Samples
--      plus your own session's.

------------------------------------------------------
-- 1. pgvector
------------------------------------------------------
-- The extension that adds the "vector" type and the
-- distance operators (<=> is cosine distance). In the
-- extensions schema, like pgTAP, so public stays
-- clean. Supabase ships it; we just switch it on.
create extension if not exists vector with schema extensions;

------------------------------------------------------
-- 2. Documents
------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),

  -- Deleting a course deletes its documents (and,
  -- through the next cascade, their chunks).
  course_id uuid not null
    references public.courses (id) on delete cascade,

  -- The owner. NULL = a shared sample document, like
  -- sample courses. The admin script inserts NULL on
  -- purpose; visitor uploads (December) will get
  -- auth.uid() from the default. Deleting the session
  -- (cleanup, "Start fresh") deletes its documents.
  session_id uuid default auth.uid()
    references public.demo_sessions (id) on delete cascade,

  -- Display name, e.g. "Erickson_Ch3_DynamicProgramming.pdf".
  -- Never used as a file path (upload-edge-cases #12).
  name text not null
    check (char_length(name) between 1 and 200
           and name = btrim(name)
           and name !~ '[[:cntrl:]]'),

  -- Page count from the parser. 2,000 is far above
  -- any lecture PDF; it stops nonsense values.
  pages integer not null check (pages between 1 and 2000),

  -- SHA-256 of the file's bytes (64 hex characters).
  -- Lets us spot the same PDF uploaded twice.
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),

  -- "embedding" while chunks are being made, "ready"
  -- when they can be searched, "failed" with a short
  -- reason. Same three states as the frontend's
  -- DocumentStatus type.
  status text not null default 'embedding'
    check (status in ('embedding', 'ready', 'failed')),
  error text check (char_length(error) <= 300),

  created_at timestamptz not null default now(),

  -- The same file only once per course and owner.
  -- "nulls not distinct" (same lesson as PR #20): two
  -- sample copies (session_id NULL) must also clash.
  constraint documents_once
    unique nulls not distinct (course_id, session_id, sha256)
);

-- Index every foreign key (the cleanup cascades
-- through these). course_id is also how retrieval
-- filters ("only this course's documents").
create index documents_course_id on public.documents (course_id);
create index documents_session_id on public.documents (session_id);

alter table public.documents enable row level security;

-- Read the samples and your own. Same rule as the
-- courses policy. (select auth.uid()) in brackets is
-- worked out once per query, not once per row.
create policy "read sample and own documents"
  on public.documents for select
  to authenticated
  using (session_id is null or session_id = (select auth.uid()));

-- Deliberately no insert / update / delete policies
-- in v1: with RLS on and no policy, every write is
-- refused even if a grant slipped through.

------------------------------------------------------
-- 3. Chunks
------------------------------------------------------
create table public.chunks (
  -- bigint identity: cheap, and keeps insert order.
  id bigint generated always as identity primary key,

  document_id uuid not null
    references public.documents (id) on delete cascade,

  -- The PDF page this passage comes from, counted
  -- from 1 the way a PDF viewer counts (not the
  -- number printed in the footer). A chunk never
  -- spans two pages, so this is always exact: it IS
  -- the citation.
  page integer not null check (page >= 1),

  -- Order of the chunk inside its document (0, 1, 2…).
  chunk_index integer not null check (chunk_index >= 0),

  -- The passage text shown in the Sources pane.
  content text not null
    check (char_length(content) between 1 and 8000),

  -- How many tokens the passage is (for the prompt
  -- budget). Our chunks are ~400; 2,000 is a ceiling.
  token_count integer not null
    check (token_count between 1 and 2000),

  -- 1,536 dimensions = text-embedding-3-small. A
  -- different model means a new column/migration,
  -- which is the point: vectors from two models
  -- can't be compared.
  embedding extensions.vector(1536) not null,

  -- One chunk per position in a document. This
  -- unique index starts with document_id, so it also
  -- serves as the foreign-key index.
  constraint chunks_position unique (document_id, chunk_index)
);

-- No vector index (HNSW/IVFFlat) yet, on purpose:
-- a few thousand chunks are searched exactly by a
-- plain scan in milliseconds, and an approximate index
-- combined with a "this course only" filter can
-- silently return fewer than k rows. Add one when Dyno
-- shows search time matters.

alter table public.chunks enable row level security;

-- A chunk is visible when its document is: a sample,
-- or yours. Written out instead of relying on the
-- documents policy, so this rule reads on its own.
create policy "read chunks of visible documents"
  on public.chunks for select
  to authenticated
  using (
    exists (
      select 1 from public.documents d
       where d.id = chunks.document_id
         and (d.session_id is null
              or d.session_id = (select auth.uid()))
    )
  );

------------------------------------------------------
-- 4. match_chunks(): the "retrieve" step
------------------------------------------------------
-- The k chunks of one course closest in meaning to
-- the question's embedding, best first, with the page
-- numbers the answer will cite.
--
-- security INVOKER (the default, written out): it
-- runs with the caller's rights, so the RLS policies
-- above still decide what it can see. Asking about
-- someone else's course returns nothing.
--
-- set search_path = '': so the cosine operator has to
-- be named in full: operator(extensions.<=>).
-- Similarity = 1 - cosine distance (1 = same meaning).
create function public.match_chunks(
  query_embedding extensions.vector(1536),
  target_course uuid,
  match_count integer default 8
)
returns table (
  chunk_id bigint,
  document_id uuid,
  document_name text,
  page integer,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, d.id, d.name, c.page, c.content,
         1 - (c.embedding operator(extensions.<=>) query_embedding)
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where d.course_id = target_course
    and d.status = 'ready'
  order by c.embedding operator(extensions.<=>) query_embedding
  -- Between 1 and 20, whatever the caller asks for.
  limit least(greatest(coalesce(match_count, 8), 1), 20);
$$;

------------------------------------------------------
-- 5. spend_tokens(): the per-session token budget
------------------------------------------------------
-- demo_sessions has tokens_used / token_budget (50,000
-- by default) since the first migration, and visitors
-- deliberately have no UPDATE on it. The API calls
-- this after each answer with the tokens OpenAI says
-- it used.
--
-- security DEFINER: it must update a row the visitor
-- can't. It only ever touches the caller's own row
-- (auth.uid()) and only ever ADDS, so calling it
-- directly can only use up your own budget.
-- Returns what's left (never below 0).
create function public.spend_tokens(amount integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining integer;
begin
  -- 22023 = invalid_parameter_value. Zero or negative
  -- would be a refund; over 20,000 is no real answer.
  if amount is null or amount < 1 or amount > 20000 then
    raise exception 'amount must be between 1 and 20000'
      using errcode = '22023';
  end if;

  update public.demo_sessions
     set tokens_used = tokens_used + amount
   where id = (select auth.uid())
  returning token_budget - tokens_used into remaining;

  -- P0002 = no_data_found: no session for this caller.
  if not found then
    raise exception 'No demo session.' using errcode = 'P0002';
  end if;

  return greatest(remaining, 0);
end;
$$;

------------------------------------------------------
-- 6. Explicit GRANTs (rule since PR #22)
------------------------------------------------------
-- Revoke everything first, so Supabase's defaults
-- (which differ between projects) don't matter.
revoke all on table public.documents from anon, authenticated;
revoke all on table public.chunks from anon, authenticated;

-- v1: visitors read, nobody but the admin writes.
grant select on table public.documents to authenticated;
grant select on table public.chunks to authenticated;

-- Postgres lets PUBLIC run new functions, and
-- Supabase grants them to anon: take both away, then
-- allow signed-in visitors only.
revoke execute on function public.match_chunks(extensions.vector, uuid, integer)
  from public, anon;
grant execute on function public.match_chunks(extensions.vector, uuid, integer)
  to authenticated;

revoke execute on function public.spend_tokens(integer)
  from public, anon;
grant execute on function public.spend_tokens(integer)
  to authenticated;