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
| POST | `/v1/answer` | `{ courseId, question }` → `{ answer, usage }`: a cited answer from the course's passages |

`/v1/answer` needs two headers: `X-Recall-Internal` (the shared `INTERNAL_KEY`, so only Next.js can call it) and `Authorization: Bearer <visitor's Supabase token>`. The service talks to Supabase with the publishable key plus that token, so RLS decides what it can read; it holds no database password. Errors: 401 (bad key or token), 422 (bad body), 429 (5 per minute, or the session's token budget is spent), 502 (OpenAI or Supabase failed), 503 (the OpenAI project's monthly limit is reached).

## Answer pipeline

`main.py` (the endpoint) → `db.py` (Supabase as the visitor: budget, `match_chunks`, `spend_tokens`) → `answer.py` (prompt, structured output schema, quote finding, mapping to the frontend's `Answer` type). Each claim cites exactly one passage; if the best match is weaker than `ANSWER_MIN_SIMILARITY` (0.25), the answer is "not found" and no answer model is called. `ratelimit.py` keeps the per-visitor limit in memory.

## Ingest (sample PDFs)

`src/recall_api/ingest/`: `pdf.py` reads each page's text (PyMuPDF), `chunk.py` cuts pages into ~400-token passages that never cross a page, `embed.py` turns them into 1,536-number embeddings (`text-embedding-3-small`).

The sample courses' PDFs are listed in `samples.toml` and loaded by a laptop-only script (it needs `ADMIN_DATABASE_URL` and `OPENAI_API_KEY` in `api/.env`):

```
uv run python -m recall_api.scripts.ingest_samples --dry-run
uv run python -m recall_api.scripts.ingest_samples --ref <project-ref>
```

Sample material: Jeff Erickson, *Algorithms* (2019), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), https://jeffe.cs.illinois.edu/teaching/algorithms/. The PDFs go in `api/samples/` (gitignored).
