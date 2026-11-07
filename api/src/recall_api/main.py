"""The FastAPI app. Phase 2: only a health check.

Run it locally with:  uv run fastapi dev src/recall_api/main.py
Docker / AWS run:     uvicorn recall_api.main:app
"""

from fastapi import FastAPI

app = FastAPI(
    title="Recall API",
    version="0.1.0",
    summary="Ingest, retrieve and answer with page-level citations.",
)


@app.get("/health")
def health() -> dict[str, bool]:
    """Liveness check: "the process is up and answering".

    The AWS load balancer calls this every few seconds to
    decide whether to send traffic here. Deliberately
    touches nothing else (no database, no OpenAI): if
    Supabase had a blip, we don't want AWS to restart a
    healthy container.
    """
    return {"ok": True}
