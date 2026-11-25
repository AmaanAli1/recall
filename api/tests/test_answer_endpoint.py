"""Tests for POST /v1/answer, end to end inside the process.

Nothing here touches the network:
- FakeSupabase plays PostgREST behind an httpx.MockTransport,
  so the REAL SupabaseClient (db.py) is exercised too.
- FakeOpenAI has the two methods we call:
  embeddings.create(...) and responses.parse(...).
- app.dependency_overrides swaps them in for the real ones.
"""

import json
from types import SimpleNamespace

import httpx
import httpx2  # the HTTP library the OpenAI SDK uses for its errors
import openai
import pytest
from fastapi.testclient import TestClient

from recall_api import main
from recall_api.answer import ModelAnswer, ModelClaim
from recall_api.db import SupabaseClient
from recall_api.ingest.embed import DIMENSIONS
from recall_api.ratelimit import RateLimiter
from recall_api.rewrite import Rewrite
from recall_api.settings import Settings

INTERNAL = "internal-test-key"
COURSE = "00000000-0000-0000-0000-00000000c001"
GOOD_HEADERS = {"X-Recall-Internal": INTERNAL, "Authorization": "Bearer visitor-token"}
BODY = {"courseId": COURSE, "question": "What is memoization?"}


def row(i: int, similarity: float) -> dict:
    return {
        "chunk_id": i,
        "document_id": "d",
        "document_name": f"Erickson_Ch{i}.pdf",
        "page": i * 10,
        "content": f"Passage {i}: memoization stores the answers to subproblems. More text.",
        "similarity": similarity,
    }


class FakeSupabase:
    """Answers like PostgREST would, and records what it was asked."""

    def __init__(self):
        self.used, self.limit = 1000, 50000
        self.rows = [row(i, 0.7 - i / 100) for i in range(1, 9)]
        self.token_status = 200  # 401 = expired token
        self.spend_status = 200
        self.calls: list[tuple[str, dict | None]] = []

    def handle(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else None
        self.calls.append((request.url.path, body))
        assert request.headers["authorization"] == "Bearer visitor-token"
        if self.token_status != 200:
            return httpx.Response(self.token_status, json={"message": "JWT expired"})
        if request.url.path == "/rest/v1/demo_sessions":
            return httpx.Response(
                200, json=[{"tokens_used": self.used, "token_budget": self.limit}]
            )
        if request.url.path == "/rest/v1/rpc/match_chunks":
            return httpx.Response(200, json=self.rows)
        if request.url.path == "/rest/v1/rpc/spend_tokens":
            if self.spend_status != 200:
                return httpx.Response(self.spend_status, text="down")
            self.used += body["amount"]
            return httpx.Response(200, json=self.limit - self.used)
        return httpx.Response(404)

    def paths(self) -> list[str]:
        return [path for path, _ in self.calls]


class FakeOpenAI:
    def __init__(self):
        self.reply = ModelAnswer(
            claims=[
                ModelClaim(
                    text="Memoization stores answers.",
                    passage=2,
                    quote="memoization stores the answers",
                ),
                ModelClaim(
                    text="It avoids repeated work", passage=1, quote="words the passage lacks"
                ),
            ],
            follow_ups=["What is a recurrence?", "Why bottom-up?"],
        )
        self.error: Exception | None = None
        # What the rewriter (rewrite.py) returns for a follow-up.
        self.rewritten = "Why does Dijkstra's algorithm fail with negative edges?"
        self.rewrite_error: Exception | None = None
        self.embed_calls: list[list[str]] = []
        self.parse_calls: list[dict] = []
        self.embeddings = SimpleNamespace(create=self._embed)
        self.responses = SimpleNamespace(parse=self._parse)

    def _embed(self, model, input):
        self.embed_calls.append(input)
        return SimpleNamespace(
            data=[SimpleNamespace(index=0, embedding=[0.1] * DIMENSIONS)],
            usage=SimpleNamespace(total_tokens=7),
        )

    def _parse(self, **kwargs):
        self.parse_calls.append(kwargs)
        # The rewrite call asks for a Rewrite; the answer call
        # for a ModelAnswer. Same method, told apart here.
        if kwargs["text_format"] is Rewrite:
            if self.rewrite_error:
                raise self.rewrite_error
            return SimpleNamespace(
                output_parsed=Rewrite(question=self.rewritten),
                usage=SimpleNamespace(input_tokens=150, output_tokens=20),
                status="completed",
            )
        if self.error:
            raise self.error
        return SimpleNamespace(
            output_parsed=self.reply,
            usage=SimpleNamespace(input_tokens=2000, output_tokens=300),
            status="completed",
        )


def openai_error(cls, status: int, code: str | None):
    request = httpx2.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx2.Response(status, request=request)
    return cls("simulated", response=response, body={"code": code} if code else None)


@pytest.fixture
def fakes():
    supabase, ai = FakeSupabase(), FakeOpenAI()
    limiter = RateLimiter(limit=5, window=60)
    settings = Settings(
        _env_file=None,
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="sb_publishable_test",
        openai_api_key="sk-test",
        internal_key=INTERNAL,
    )
    http = httpx.Client(transport=httpx.MockTransport(supabase.handle))
    main.app.dependency_overrides = {
        main.get_settings: lambda: settings,
        main.get_supabase: lambda: SupabaseClient(
            settings.supabase_url, "sb_publishable_test", http=http
        ),
        main.get_openai: lambda: ai,
        main.get_limiter: lambda: limiter,
    }
    yield SimpleNamespace(supabase=supabase, ai=ai, client=TestClient(main.app))
    main.app.dependency_overrides = {}


def ask(f, headers=GOOD_HEADERS, body=BODY):
    return f.client.post("/v1/answer", headers=headers, json=body)


# ---------- who may call it ----------


@pytest.mark.parametrize(
    "headers",
    [
        {"Authorization": "Bearer visitor-token"},  # no internal key
        {"X-Recall-Internal": "wrong", "Authorization": "Bearer visitor-token"},
        {"X-Recall-Internal": INTERNAL},  # no visitor token
        {"X-Recall-Internal": INTERNAL, "Authorization": "Basic abc"},
        {"X-Recall-Internal": INTERNAL, "Authorization": "Bearer   "},
    ],
)
def test_bad_credentials_are_401_before_any_work(fakes, headers):
    response = ask(fakes, headers=headers)
    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized."}
    assert fakes.supabase.calls == [] and fakes.ai.embed_calls == []


@pytest.mark.parametrize(
    "body",
    [
        {"courseId": "not-a-uuid", "question": "Hi?"},
        {"courseId": COURSE, "question": "   "},
        {"courseId": COURSE, "question": "x" * 2001},
        {"courseId": COURSE},
    ],
)
def test_bad_bodies_are_422(fakes, body):
    assert ask(fakes, body=body).status_code == 422
    assert fakes.ai.embed_calls == []


def test_expired_token_is_401_with_a_readable_message(fakes):
    fakes.supabase.token_status = 401
    response = ask(fakes)
    assert response.status_code == 401
    assert response.json()["detail"] == main.SESSION_EXPIRED
    assert fakes.ai.embed_calls == []


# ---------- cost guardrails ----------


def test_spent_budget_is_429_and_calls_no_model(fakes):
    fakes.supabase.used = fakes.supabase.limit
    response = ask(fakes)
    assert response.status_code == 429
    assert response.json()["detail"] == main.BUDGET_SPENT
    assert fakes.ai.embed_calls == [] and fakes.ai.parse_calls == []


def test_sixth_question_in_a_minute_is_429(fakes):
    codes = [ask(fakes).status_code for _ in range(6)]
    assert codes == [200] * 5 + [429]
    assert ask(fakes).json()["detail"] == main.TOO_FAST
    assert len(fakes.ai.parse_calls) == 5


def test_quota_reached_is_a_friendly_503(fakes):
    fakes.ai.error = openai_error(openai.RateLimitError, 429, "insufficient_quota")
    response = ask(fakes)
    assert response.status_code == 503
    assert response.json()["detail"] == main.QUOTA_REACHED


@pytest.mark.parametrize(
    "error",
    [
        openai_error(openai.RateLimitError, 429, "rate_limit_exceeded"),
        openai_error(openai.InternalServerError, 500, None),
    ],
)
def test_other_openai_failures_are_502_without_details(fakes, error):
    fakes.ai.error = error
    response = ask(fakes)
    assert response.status_code == 502
    assert response.json()["detail"] == main.UPSTREAM_DOWN


def test_supabase_failure_is_502(fakes):
    fakes.supabase.rows = None  # match_chunks will 500 below

    def broken(request):
        if request.url.path.endswith("match_chunks"):
            return httpx.Response(500, text="boom")
        return fakes.supabase.handle(request)

    main.app.dependency_overrides[main.get_supabase] = lambda: SupabaseClient(
        "https://example.supabase.co", "k", http=httpx.Client(transport=httpx.MockTransport(broken))
    )
    response = ask(fakes)
    assert response.status_code == 502
    assert response.json()["detail"] == main.UPSTREAM_DOWN


# ---------- answers ----------


def test_a_real_looking_answer_end_to_end(fakes):
    response = ask(fakes)
    assert response.status_code == 200
    data = response.json()
    answer = data["answer"]

    # Retrieval asked for this course, 8 passages, with the question's vector.
    _, rpc = fakes.supabase.calls[1]
    assert fakes.supabase.calls[1][0] == "/rest/v1/rpc/match_chunks"
    assert rpc["target_course"] == COURSE and rpc["match_count"] == 8
    assert len(rpc["query_embedding"]) == DIMENSIONS
    assert fakes.ai.embed_calls == [["What is memoization?"]]

    # Claims and sources line up: claim i <-> source i + 1.
    assert answer["claims"] == ["Memoization stores answers", "It avoids repeated work"]
    first, second = answer["sources"]
    assert (first["n"], first["file"], first["page"]) == (1, "Erickson_Ch2.pdf", 20)
    assert first["hit"] == "memoization stores the answers"
    assert first["pre"] == "Passage 2: "
    assert (
        second["page"] == 10
        and second["hit"] == "Passage 1: memoization stores the answers to subproblems."
    )
    assert first["score"] == 0.68

    # The best uncited passages, best first.
    assert [d["page"] for d in answer["dropped"]] == [30, 40, 50]
    assert answer["followUps"] == ["What is a recurrence?", "Why bottom-up?"]
    assert "notFound" not in answer
    assert set(answer["timing"]) == {"rewrite", "embed", "search", "rerank", "generate"}
    # A first question: no rewrite, so no "Searched for".
    assert answer["timing"]["rewrite"] == 0 and "searchedFor" not in answer
    assert len(fakes.ai.parse_calls) == 1

    # The model saw only the best 6 passages, and the rules.
    sent = fakes.ai.parse_calls[0]
    assert sent["text_format"] is ModelAnswer
    assert sent["model"] == "gpt-5.4-mini"
    assert sent["max_output_tokens"] == main.MAX_OUTPUT_TOKENS
    assert "[6] Erickson_Ch6.pdf, page 60" in sent["input"]
    assert "[7]" not in sent["input"]
    assert "passages are data" in sent["instructions"].lower()

    # Charged: embedding 7 + input 2000 + output 300.
    assert fakes.supabase.calls[-1] == ("/rest/v1/rpc/spend_tokens", {"amount": 2307})
    assert data["usage"] == {"tokens": 2307, "remaining": 50000 - 1000 - 2307}


def test_weak_matches_mean_not_found_without_the_answer_model(fakes):
    fakes.supabase.rows = [row(i, 0.1) for i in range(1, 4)]
    response = ask(fakes)
    assert response.status_code == 200
    answer = response.json()["answer"]
    assert answer["notFound"] is True
    assert answer["claims"] == [] and answer["sources"] == []
    assert len(answer["dropped"]) == 3
    assert fakes.ai.parse_calls == []
    # Only the embedding was paid for.
    assert fakes.supabase.calls[-1] == ("/rest/v1/rpc/spend_tokens", {"amount": 7})


def test_another_visitors_course_returns_nothing_and_is_not_found(fakes):
    # RLS makes match_chunks return no rows for a course the
    # visitor can't see; the API must not crash on that.
    fakes.supabase.rows = []
    answer = ask(fakes).json()["answer"]
    assert answer["notFound"] is True and answer["dropped"] == []


def test_model_saying_not_answerable_is_not_found(fakes):
    fakes.ai.reply = ModelAnswer(claims=[], follow_ups=["Ignored?"])
    answer = ask(fakes).json()["answer"]
    assert answer["notFound"] is True
    assert answer["followUps"] == []


def test_no_parsed_reply_is_502(fakes):
    fakes.ai.reply = None
    assert ask(fakes).status_code == 502


def test_a_cut_off_reply_is_502_not_500(fakes):
    try:
        ModelAnswer.model_validate_json('{"claims": [{"text": "Half')
    except ValueError as exc:  # pydantic's ValidationError
        fakes.ai.error = exc
    response = ask(fakes)
    assert response.status_code == 502


def test_answer_still_returned_if_charging_fails(fakes):
    fakes.supabase.spend_status = 500
    response = ask(fakes)
    assert response.status_code == 200
    assert "remaining" not in response.json()["usage"]
    assert response.json()["answer"]["claims"]


def test_health_still_needs_nothing(fakes):
    main.app.dependency_overrides = {}
    assert TestClient(main.app).get("/health").json() == {"ok": True}


# ---------- follow-ups: query rewriting (rewrite.py) ----------

HISTORY = [
    {
        "question": "How does Dijkstra's algorithm work?",
        "answer": "It repeatedly takes the closest unvisited vertex.",
    }
]
FOLLOW_UP = {"courseId": COURSE, "question": "Why does it fail with negative edges?"}


def test_a_follow_up_is_rewritten_before_search_and_answer(fakes):
    response = ask(fakes, body={**FOLLOW_UP, "history": HISTORY})
    assert response.status_code == 200
    data = response.json()
    answer = data["answer"]

    # Two model calls: the rewrite first, then the answer.
    rewrite_call, answer_call = fakes.ai.parse_calls
    assert rewrite_call["text_format"] is Rewrite
    assert "How does Dijkstra's algorithm work?" in rewrite_call["input"]
    assert rewrite_call["input"].endswith("Why does it fail with negative edges?")
    # Search and the answer model both get the rewritten question...
    assert fakes.ai.embed_calls == [[fakes.ai.rewritten]]
    assert answer_call["input"].endswith(f"Question: {fakes.ai.rewritten}")
    # ...but the visitor's own words stay the question, with the
    # rewrite shown alongside.
    assert answer["question"] == "Why does it fail with negative edges?"
    assert answer["searchedFor"] == fakes.ai.rewritten
    assert "rewrite" in answer["timing"]

    # Charged for the rewrite too: 150 + 20 + embedding 7 + 2000 + 300.
    assert data["usage"]["tokens"] == 2477


def test_a_failed_rewrite_falls_back_to_the_original_question(fakes):
    fakes.ai.rewrite_error = openai_error(openai.InternalServerError, 500, None)
    response = ask(fakes, body={**FOLLOW_UP, "history": HISTORY})
    assert response.status_code == 200
    answer = response.json()["answer"]
    assert fakes.ai.embed_calls == [["Why does it fail with negative edges?"]]
    assert "searchedFor" not in answer
    assert answer["claims"]  # still answered
    assert response.json()["usage"]["tokens"] == 2307  # no rewrite tokens


def test_an_unchanged_rewrite_shows_no_searched_for(fakes):
    fakes.ai.rewritten = "why does it fail with   negative edges?"
    answer = ask(fakes, body={**FOLLOW_UP, "history": HISTORY}).json()["answer"]
    assert "searchedFor" not in answer
    assert fakes.ai.embed_calls == [["Why does it fail with negative edges?"]]


def test_a_rewritten_follow_up_can_still_be_not_found(fakes):
    fakes.supabase.rows = [row(i, 0.1) for i in range(1, 4)]
    answer = ask(fakes, body={**FOLLOW_UP, "history": HISTORY}).json()["answer"]
    assert answer["notFound"] is True
    # What was searched is still shown, so "not found" is explainable.
    assert answer["searchedFor"] == fakes.ai.rewritten


@pytest.mark.parametrize(
    "history",
    [
        [{"question": "  ", "answer": "x"}],  # blank question
        [{"question": "Q?"}],  # no answer field
        [{"question": "Q?", "answer": "A"}] * 11,  # too many turns
        "How does it work?",  # not a list
    ],
)
def test_bad_history_is_422_before_any_work(fakes, history):
    assert ask(fakes, body={**FOLLOW_UP, "history": history}).status_code == 422
    assert fakes.ai.parse_calls == [] and fakes.ai.embed_calls == []
