# Recall — Build Phases

The roadmap for building Recall. This is a personal project built over time
(ideally a working version before December), not a sprint. Principle: get
something working end-to-end fairly fast, then layer on. Build the lean core
first; conveniences and polish come after the hard part is proven.

**This file is a living document — phases will be tweaked, reordered, and
expanded as the project evolves and as I learn more.**

Status key: [ ] not started · [~] in progress · [x] done

---

## Phase 0 — Foundations & deployed "hello world"
- [ ] Learn just-enough Next.js + TypeScript (only what's needed)
- [ ] Create the Next.js project
- [ ] Deploy a trivial page to Vercel (get the deploy pipeline working FIRST)
- [ ] Build the structured logger engine early (used to debug every later phase)
- **Done when:** a live URL shows a basic page.

## Phase 1 — UI/UX design & planning
- [ ] Map out the screens (auth, document list/upload, chat, settings)
- [ ] Wireframe each screen (rough layout before visuals)
- [ ] Decide the visual direction (colors, type, overall feel)
- [ ] Plan the component structure (what reusable pieces exist)
- [ ] Note: design is planned here, executed in later feature phases
- **Done when:** I have wireframes + a clear visual direction to build against.

## Phase 2 — Auth & database
- [ ] Set up Supabase project
- [ ] Wire up Supabase Auth (signup / login) + the auth UI screens
- [ ] Create the `documents` table in Postgres
- [ ] Set up row-level security (data isolation) from the start
- **Done when:** users can sign up, log in, and the documents table exists with RLS.

## Phase 3 — File upload & text extraction
- [ ] Build the upload UI
- [ ] Upload a PDF (logged-in user) to Supabase storage
- [ ] Validate file type (magic bytes) + size cap (security)
- [ ] Extract raw text from the PDF
- **Done when:** upload a PDF, see its extracted text.

## Phase 4 — RAG ingestion pipeline [the heart]
- [ ] Design + create the `chunks` table (pgvector)
- [ ] Split extracted text into chunks
- [ ] Embed each chunk via OpenAI
- [ ] Store chunks + vectors in Postgres/pgvector
- **Done when:** an uploaded document is stored as searchable meaning-vectors.

## Phase 5 — Query & chat [the payoff]
- [ ] Build the chat UI
- [ ] Embed the user's question
- [ ] Vector-search Postgres for the most relevant chunks
- [ ] Send chunks + question to the OpenAI LLM
- [ ] Stream the answer back, with document citation
- **Done when:** "chat with your documents" works end-to-end.

## Phase 6 — Testing setup
- [ ] Learn the basics of testing in this stack
- [ ] Set up a testing framework
- [ ] Write first unit tests (e.g. chunking, validation logic)
- [ ] Write integration test(s) for a core flow (e.g. upload → ingest)
- [ ] Note: after this, testing becomes an ongoing habit (see cross-cutting)
- **Done when:** a test suite exists and runs, covering core logic.

## Phase 7 — One memorable feature
- [ ] Pick ONE: auto-generated quizzes OR flashcards from the material
- [ ] Build its UI
- **Done when:** the chosen study feature works.

## Phase 8 — Polish, security, CI, docs
- [ ] Refine the UI against the Phase 1 design (consistency, responsiveness)
- [ ] Harden multi-tenant security (RLS review, XSS sanitization)
- [ ] Add CI pipeline (GitHub Actions: type-check, lint, tests on every push)
- [ ] Write a strong README; final deploy
- **Done when:** shippable, on resume, candidate for the portfolio site.

---

## Phase 9 (later) — Real users / launch
Production hardening before opening to real users: prompt-injection mitigation,
per-user rate limiting, OpenAI spend caps, terms/privacy. Becomes its own resume
story ("deployed to production, onboarded N users").

## Phase 10 (stretch) — Admin dashboard
A dashboard visualizing the structured logs + system/health metrics — a
mini-Kibana for Recall. The logger's UI lives here. Earns its own resume bullet.

---

## Cross-cutting (not phases — ongoing habits from the start)
- **Logger:** engine built early (Phase 0); used to debug every phase; fancy
  viewer UI is Phase 10.
- **Frontend/UI:** designed in Phase 1, executed in every feature phase, refined
  in Phase 8.
- **Testing:** established in Phase 6, then an ongoing habit; enforced by CI in Phase 8.
- **Version control:** commit + push at each meaningful step from day one.
- **Documentation:** update the docs every session.