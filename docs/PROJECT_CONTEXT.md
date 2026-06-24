# Recall —  Project Context

## Elevator Pitch
Recall is an AI-powered study companion. A student uploads their own course materials (PDFs, slides, notes), and the app answers questions
*from those materials* using RAG (retrieval-augmented generation), and generates quizzes/flashcards to help them study. Each user's
documents are private to their account.

## Why this project
- Extends my AI experience (trained an AI support agent at D2L) into building a full AI product end-to-end.
- Complements my GymFlow project: GymFlow shows backend/security/relational-DB depth; this adds modern frontend (Next.js/React/TS), 
  AI/LLM integration, and vector search. Together they span the full modern stack.

## Tech Stack
- Frontend + API; Next.js, React, TypeScript
- Database: PostgreSQL (via Supabase) + pgvector for vector search
- Auth + File Storage: Supabase
- AI: [embedding model + LLM via API —  TBD which]
- Hosting: Vercel (app) + Supabase (DB)

## How I work (for Claude)
- I'm learning as I build. Give me code WITH explanations; I type it myself and add my own comments to understand it.
- Explain the plan before generating code. Keep scope tight —  one thing at a time.
- **Document as we go.** When we make a meaningful decision, remind me to log it in DECISIONS.md (with the "why"). When the schema or status 
  changes, remind me to update DATABASE.md / PROJECT_CONTEXT.md.
- At the end of a working session, give me the edits to update the docs so my files stay current.

## Current Status
- Phase: Planning / foundation docs (pre-code)
- Working on: Setting up planning docs; deciding architecture & database design.
- Next: System architecture diagram + DATABASE.md design.
