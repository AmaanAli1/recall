"""The FastAPI app: a health check and the answer endpoint.

Run it locally with:  uv run fastapi dev src/recall_api/main.py
Docker / AWS run:     uvicorn recall_api.main:app

POST /v1/answer, step by step:
  1. Is the caller our Next.js server? (internal key)
  2. Which visitor? (their Supabase token)
  3. Not too many questions this minute? (rate limit)
  4. Budget left? (demo_sessions, read as the visitor)
  5. Embed the question            -> timing.embed
  6. match_chunks() (RLS applies)  -> timing.search
  7. Best match too weak? -> "not found", no answer model
  8. Ask the model for cited claims -> timing.generate
  9. Map to the frontend's Answer, charge the budget
"""

import hashlib
import hmac
import logging
import time
from functools import lru_cache
from typing import Annotated, Any
from uuid import UUID

import openai
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from recall_api.answer import (
    MAX_PASSAGES,
    SYSTEM_PROMPT,
    Answer,
    ModelAnswer,
    Timing,
    build_input,
    not_found,
    to_answer,
)
from recall_api.db import DbAuthError, DbError, SupabaseClient
from recall_api.ingest.embed import embed_texts, make_client
from recall_api.ratelimit import RateLimiter
from recall_api.settings import Settings, get_settings

log = logging.getLogger("recall_api")

RETRIEVE_COUNT = 8  # passages fetched; the best MAX_PASSAGES go to the model
MAX_OUTPUT_TOKENS = 800  # D5: per-request cap on the answer's length

# The short messages visitors may see. Details go to the
# logs only (same rule as apiError() in Next.js).
UNAUTHORIZED = "Unauthorized."
SESSION_EXPIRED = "Your demo session has expired. Start a new one."
TOO_FAST = "Too many questions in a minute. Wait a moment and try again."
BUDGET_SPENT = "This demo session has used its token budget."
QUOTA_REACHED = "The demo has reached its monthly AI budget. Please try again next month."
UPSTREAM_DOWN = "The answer service is having trouble right now. Please try again."

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


# ---------------------------------------------------------
# Dependencies: things an endpoint needs, built once.
# ---------------------------------------------------------
# FastAPI calls these for each request (Depends(...)). Tests
# swap them for fakes with app.dependency_overrides, so no
# test ever talks to OpenAI or Supabase.


@lru_cache
def get_supabase() -> SupabaseClient:
    settings = get_settings()
    return SupabaseClient(settings.supabase_url, settings.supabase_publishable_key)


@lru_cache
def get_openai() -> Any:
    return make_client(get_settings().openai_api_key.get_secret_value())


_limiter = RateLimiter(limit=5, window=60.0)


def get_limiter() -> RateLimiter:
    return _limiter


def visitor_token(
    settings: Annotated[Settings, Depends(get_settings)],
    # Header() reads "X-Recall-Internal" / "Authorization";
    # FastAPI turns the underscores into dashes.
    x_recall_internal: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """Checks steps 1 + 2 and returns the visitor's token."""
    expected = settings.internal_key.get_secret_value()
    # compare_digest takes the same time whether the first
    # or the last character differs, so the key can't be
    # guessed one character at a time by timing responses.
    if not x_recall_internal or not hmac.compare_digest(
        x_recall_internal.encode(), expected.encode()
    ):
        raise HTTPException(status_code=401, detail=UNAUTHORIZED)
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail=UNAUTHORIZED)
    # Not verified here: Supabase verifies it on the first
    # database call (step 4) and answers 401 if it's bad.
    return token.strip()


# ---------------------------------------------------------
# Request and response shapes
# ---------------------------------------------------------


class AskBody(BaseModel):
    # Strip spaces BEFORE the length checks, so "   " is
    # rejected as empty.
    model_config = ConfigDict(str_strip_whitespace=True)

    courseId: UUID  # a malformed id is a 422 before any work
    question: str = Field(min_length=1, max_length=2000)


class Usage(BaseModel):
    tokens: int  # what this answer cost (embedding + model)
    # Budget left. Left out of the JSON if charging failed
    # (exclude_none below drops every None field).
    remaining: int | None


class AnswerResponse(BaseModel):
    answer: Answer
    usage: Usage


def _seconds(start: float) -> float:
    return round(time.perf_counter() - start, 2)


def _openai_failed(exc: openai.APIError) -> HTTPException:
    """Turn an OpenAI error into a message a visitor can read."""
    # The OpenAI project's hard limit (D5 layer 1) shows up as
    # 429 with code "insufficient_quota": not "try again in a
    # second", but "no more money this month".
    if isinstance(exc, openai.RateLimitError) and exc.code == "insufficient_quota":
        log.error("OpenAI quota reached: %s", exc)
        return HTTPException(status_code=503, detail=QUOTA_REACHED)
    log.exception("OpenAI call failed")
    return HTTPException(status_code=502, detail=UPSTREAM_DOWN)


# ---------------------------------------------------------
# The endpoint
# ---------------------------------------------------------
# A plain `def` (not `async def`): the OpenAI and httpx
# clients used here block while they wait, and FastAPI runs
# plain functions in a thread pool so other requests keep
# moving meanwhile.


@app.post("/v1/answer", response_model=AnswerResponse, response_model_exclude_none=True)
def answer(
    body: AskBody,
    token: Annotated[str, Depends(visitor_token)],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[SupabaseClient, Depends(get_supabase)],
    ai: Annotated[Any, Depends(get_openai)],
    limiter: Annotated[RateLimiter, Depends(get_limiter)],
) -> AnswerResponse:
    course_id = str(body.courseId)

    # 3. Rate limit, keyed by a hash of the token (we never
    #    keep raw tokens around, even in memory). A token
    #    lasts an hour, so this is "per visitor" in practice.
    if not limiter.allow(hashlib.sha256(token.encode()).hexdigest()):
        raise HTTPException(status_code=429, detail=TOO_FAST)

    try:
        # 4. Budget. This is also where a bad token fails.
        if db.budget(token).remaining <= 0:
            raise HTTPException(status_code=429, detail=BUDGET_SPENT)

        timing = Timing()

        # 5. Embed the question.
        start = time.perf_counter()
        embedded = embed_texts(ai, [body.question])
        timing.embed = _seconds(start)
        tokens = embedded.tokens

        # 6. Retrieve, as the visitor: someone else's course
        #    simply returns no rows.
        start = time.perf_counter()
        retrieved = db.match_chunks(token, embedded.vectors[0], course_id, RETRIEVE_COUNT)
        timing.search = _seconds(start)

        # 7. Nothing close enough: don't pay for an answer.
        if not retrieved or retrieved[0].similarity < settings.answer_min_similarity:
            result = not_found(body.question, course_id, retrieved, timing)
        else:
            # 8. Ask for cited claims, shaped by ModelAnswer.
            start = time.perf_counter()
            try:
                response = ai.responses.parse(
                    model=settings.openai_answer_model,
                    instructions=SYSTEM_PROMPT,
                    input=build_input(body.question, retrieved[:MAX_PASSAGES]),
                    text_format=ModelAnswer,
                    max_output_tokens=MAX_OUTPUT_TOKENS,
                    # GPT-5.4 mini's default, written out: no hidden
                    # "thinking" tokens, so answers are fast and cheap.
                    reasoning={"effort": "none"},
                )
            except ValidationError as exc:
                # The reply was cut off mid-JSON (it hit
                # MAX_OUTPUT_TOKENS), so it doesn't parse.
                log.exception("Answer didn't match ModelAnswer")
                raise HTTPException(status_code=502, detail=UPSTREAM_DOWN) from exc
            timing.generate = _seconds(start)
            tokens += response.usage.input_tokens + response.usage.output_tokens
            if response.output_parsed is None:
                # e.g. the model refused, or ran out of tokens.
                log.error("No parsed answer (status %s).", getattr(response, "status", None))
                raise HTTPException(status_code=502, detail=UPSTREAM_DOWN)
            # 9. Map to the frontend's Answer.
            result = to_answer(body.question, course_id, response.output_parsed, retrieved, timing)
    except DbAuthError as exc:
        log.info("Rejected token: %s", exc)
        raise HTTPException(status_code=401, detail=SESSION_EXPIRED) from exc
    except DbError as exc:
        log.exception("Supabase call failed")
        raise HTTPException(status_code=502, detail=UPSTREAM_DOWN) from exc
    except openai.APIError as exc:
        raise _openai_failed(exc) from exc

    # Charge the budget. If this fails, still return the
    # answer: the visitor already waited for it, and the
    # overshoot is one answer at most.
    try:
        remaining: int | None = db.spend_tokens(token, tokens)
    except (DbAuthError, DbError):
        log.exception("spend_tokens failed")
        remaining = None

    return AnswerResponse(answer=result, usage=Usage(tokens=tokens, remaining=remaining))
