# Recall

Ask your lecture notes a question and get an answer cited to the exact page.
Every change to retrieval is measured on **Dyno**, an eval harness that blocks
merges when quality drops below a redline.

| Folder | What | Stack |
|---|---|---|
| [`web/`](web) | Frontend | Next.js (App Router), TypeScript, Tailwind CSS 4, Playwright, Vitest |
| [`api/`](api) | RAG service (ingest, retrieve, generate) | Python, FastAPI, Docker |
| [`dyno/`](dyno) | Eval harness and CI quality gate | Python, MLflow |

Data lives in Supabase: Postgres + pgvector + full-text search, Storage, and
anonymous auth for per-visitor demo sessions with row-level security.

## Run the frontend locally

```bash
cd web
cp .env.example .env.local   # fill in your Supabase values
npm ci
npm run dev                  # http://localhost:3000
```

Checks (the same ones CI runs on every pull request):

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build && npm run test:e2e
```

# api

Recall's RAG service (FastAPI, Python 3.12, managed with [uv](https://docs.astral.sh/uv/)): ingest PDFs, retrieve passages, answer with page-level citations. Called only by the Next.js route handler `POST /api/ask`, server to server.

## Run it

```
cd api
uv sync                                    # install into api/.venv
uv run pytest                              # tests
uv run ruff check                          # lint
uv run ruff format --check                 # formatting
uv run fastapi dev src/recall_api/main.py  # http://127.0.0.1:8000/health
```

Settings come from environment variables or `api/.env` (copy `.env.example`; never commit `.env`).

## Endpoints

| Method | Path | What |
|---|---|---|
| GET | `/health` | Liveness check for the load balancer: `{"ok": true}` |


## How changes ship

GitHub Flow: one short-lived branch per change, a pull request with CI
(lint, typecheck, unit, Playwright) and a Vercel preview deploy, squash-merge to
`main`, which deploys to production. Commits follow
[Conventional Commits](https://www.conventionalcommits.org).
