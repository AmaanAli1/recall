# Recall — Software Development Life Cycle (SDLC)

This document describes the engineering process behind Recall: how the project 
moves from idea to running software, and how the other docs in this repo map to 
each stage of the SDLC. The goal is to build Recall deliberately — not just to 
write code, but to engineer it.

## Model: iterative / incremental (Agile-leaning)

Recall is built in incremental phases (see PHASES.md), each delivering something 
that works, with documentation revisited as the project evolves. This is an 
iterative, Agile-leaning approach rather than rigid waterfall: requirements and 
design are revisited as I learn, and each phase ships a working increment instead 
of building everything before anything runs.

## How Recall maps to the SDLC stages


### 1. Planning
Defining what Recall is, why it exists, and the high-level approach. 
- See: PROJECT_CONTEXT.md (pitch, goals, stack), DECISIONS.md (early choices 
  with reasoning).

### 2. Requirements
Identifying what the app must do and the constraints it must respect.
- Functional: user accounts, document upload, RAG-based Q&A from a user's own
  materials, study aids (quizzes/flashcards), per-user privacy.
- Non-functional: security (untrusted file/input handling), cost control
  (LLM/embedding usage), reliability, maintainability.
- See: PROJECT_CONTEXT.md (what it does), ARCHITECTURE.md (security model and
  constraints).

### 3. Design
Designing the system before building it — architecture, data, and interface.
- System architecture: components and how they interact, plus the two core
  flows (ingestion and query).
- Data model: tables, columns, relationships, and the reasoning behind each.
- UI/UX: screens, wireframes, and visual direction planned before implementation.
- See: ARCHITECTURE.md, DATABASE.md, PHASES.md (Phase 1 — UI/UX design).

### 4. Implementation
Building the software in incremental phases, lean core first, committed to git
as the work progresses.
- Each phase delivers a working increment rather than a big-bang build.
- Code is committed incrementally with clear messages, producing a visible
  history of how the project was built.
- See: PHASES.md (the build roadmap), the codebase, and the git history.

### 5. Testing
Verifying the software behaves correctly, established as a deliberate stage and
then maintained as an ongoing habit.
- A testing framework plus unit tests (e.g. chunking, validation) and
  integration tests for core flows (e.g. upload → ingest).
- After it's set up, testing becomes continuous and is enforced automatically by
  the CI pipeline on every push.
- See: PHASES.md (Phase 6 — testing setup; Phase 8 — CI).

### 6. Deployment
Getting the software running in production, automatically and repeatably.
- Continuous Deployment via Vercel from day one (every push to main deploys).
- Continuous Integration (GitHub Actions) runs checks before deployment, so only
  passing code ships.
- See: DECISIONS.md (version control + CI/CD plan), PHASES.md (Phases 0, 8).

### 7. Maintenance
Keeping the software healthy over time and evolving it after launch.
- Scheduled cleanup (the soft-delete 30-day purge job).
- Observability through the structured logger; future monitoring/admin dashboard.
- Production hardening for real users: prompt-injection mitigation, rate
  limiting, spend caps.
- See: DECISIONS.md (soft-delete), PHASES.md (Phases 9–10).

## Why this matters

Following the SDLC deliberately — and documenting it — is the difference between
"I wrote some code" and "I engineered a system." Every stage here is backed by a
real artifact in this repo: a decision logged with its reasoning, a design
documented before code, a commit history showing incremental progress. This file
is the map; the other docs are the territory.

This document is living and will be refined as the project evolves.


