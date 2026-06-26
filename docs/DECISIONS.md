# Recall —  Decision Log (ADRs)

A running log of key decisions and the reasoning behind them.
Newest at the top. Format: Decision -> Why -> (any tradeoff).

---

## 2026-06-25 — Auth screen: split-screen layout with ambient brand panel
**Decision:** Auth uses a split-screen (form left, animated brand canvas right)
rather than a centered card. Right panel runs a slow drifting-particle animation;
left panel has a faint drifting glow.
**Why:** A centered card wastes desktop space and reads as generic/AI-generated.
The split fills the screen, gives Recall a distinctive identity, and the ambient
(not narrative) motion suits a screen users pass through repeatedly. The literal
"PDF → AI → answer" explainer animation is saved for a future landing page, where
first-impression storytelling matters more.
**Tradeoff:** More to build than a plain card, but high identity payoff.

## 2026-06-25 — Logo: connected-node cluster
**Decision:** Recall's logo is a cluster of connected dots on a blue rounded
square (kept the "brain" spirit but as linked nodes).
**Why:** Doubles as a brain/neural motif and a knowledge-graph/embedding network —
on-theme for what Recall actually does — and works as a recurring brand motif.

## 2026-06-25 — Visual design: dark theme, electric blue accent
**Decision:** Recall uses a dark "developer-tool" aesthetic. Core palette:
- Page background: #0d0f12 (near-black)
- Card/surface: #15181d
- Borders: #1f2329 (subtle), #2a2f37 (inputs/hover)
- Primary text: #e8eaed · Secondary/muted text: #8b9096
- Accent (buttons, links, focus): #2f6bff (electric blue)
- Success: a separate green (e.g. #15b884) so it's distinct from the accent
**Why:** Fits an AI/developer tool; blue reads technical and trustworthy. Dark
theme is the requested direction and suits long study sessions.
**Tradeoff:** Must ensure sufficient text contrast on the dark background (accessibility).

## 2026-06-23 — Version control + CI/CD plan
**Decision:** Use git + a private GitHub repo (`recall`) from day one, comitting 
docs and code as the project progresses (flip to public when portfolio-ready). 
Continous Deployment comes via Vercel (auto-deploy on push to main). 
Continous Integration via GitHub Actions (type-check, lint, tests on every 
push) to be added mid-build, once there's code and tests to check. 
**Why:** Git history gives a recoverable timeline and shows consistent work over 
months. Vercel makes CD nearly free. A CI pipeline catches errors automatically 
and is strong, real DevOps experience.
**Tradeoff:** CI adds setup, so it's deferred until there's code worth checking — 
not built up front.

## 2026-06-23 — Soft delete with 30-day grace period for documents
**Decision:** Deleting a document sets a `deleted_at` timestamp (soft delete) 
rather than removing the row. A scheduled cleanup job permanently hard-deletes 
rows whose `deleted_at` is older than 30 days. Queries that list documents 
filter `WHERE deleted_at IS NULL`.
**Why:** Combines the safety of soft delete (undo/trash window, no accidental 
permanent loss) with the privacy/storage benefits of eventual hard delete. Also 
preserves the expensive OpenAI embeddings during the window, so a restore inside 
30 days costs nothing to re-create.
**Tradeoff / caveat:** Adds two obligations — (1) every document-listing query 
must exclude soft-deleted rows (will enforce centrally via a view or RLS, not by 
remembering in each query), and (2) a scheduled job (Supabase pg_cron / scheduled 
function) MUST exist to perform the 30-day purge; the timestamp alone deletes 
nothing. (Same scheduled-job pattern as GymFlow's node-cron daily reset.)

## 2026-06-23 — documents table stores file metadata at upload
**Decision:** The `documents` table includes `file_size`, `page_count`, and 
`mime_type`, captured at upload time.
**Why:** Cheap to capture during ingestion and useful for display, quota limits, 
and security (the validated mime_type and size cap). Capturing later would 
requre re-reading files.
**Tradeoff:** A few extra columns; negligible cost.

## 2026-06-22 — Enforce data isolation via Postgres row-level security (RLS)
**Decision:** Multi-tenant data isolation will be enforced at the database level 
using Postgres RLS, not only in application code.
**Why:** The worst failure mode in a multi-user app is one user seeing another's 
documents. Application-level checks can be forgotten; RLS makes the database 
itself refuse to return another user's rows — a safety net under the app logic.
**Tradeoff:** Slightly more setup in the database layer, but it's foundational 
and painful to retrofit, so it goes in from Phase 1.

## 2026-06-22 — Validate uploaded files by content, not extension
**Decision:** File-type validation checks the actual content signature (magic 
bytes) and MIME type, plus a max file-size limit — not the filename extension.
**Why:** A malicious file can be renamed `.pdf`. Trusting the extension is a 
known weakness. Checking real content + capping size protects the parser, 
storage, and cost.
**Tradeoff:** A bit more upload-handling code, but it closes an obvious hole.

## 2026-06-22 — Build a structured, environment-aware logger early
**Decision:** Build a custom logger early in the project: log levels 
(debug/info/warn/error), structured (object) log output, and an environment 
threshold (dev shows debug+; production shows info+). An admin dashboard that 
visualized logs is parked as a stretch goal (Phase 8), not built up front.
**Why:** A logger pays for itself immediately during development by making the 
system's behavior visible while I build. Structured logs are queryable (same 
idea as Kibana, which I use at D2L). The dashboard is a second project's worth 
of work, so it's deferred until the core app works.
**Tradeoff:** Time spent up front, but it speeds up all later debugging.

## 2026-06-21 — LLM & embedding providor: OpenAI (both)
**Decision:** Use OpenAI for both the embedding model
(`text-embedding-3-small`) and the LLM, to start.
**Why:** As a beginner, the biggest cost is friction, not API fees. OpenAI has
the densest beginner-friendly RAG documentation and examples, so I spend my 
limited time learning RAG instead of debugging tooling. Cost at my scale is 
negligible (cents for embeddings, a few dollars total expected).
**Tradeoff:** Paid from the first call (will set a spending limit). Architecture 
will keep the LLM swappable so I can move to Claude or Gemini later if I want.

## 2026-06-21 — Project name: "Recall"
**Decision:** Working name is "Recall".
**Why:** Triple meaning - what memory does when studying, what RAG's retrieval 
step literally does, and it's short and brandable.