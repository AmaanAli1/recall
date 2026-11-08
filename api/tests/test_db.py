"""Tests for db.py, the Supabase client that acts as the visitor.

httpx.MockTransport stands in for Supabase: every request
goes to the `handler` function below instead of the network,
so we can check exactly what was sent and decide the reply.
"""

import json

import httpx
import pytest

from recall_api.db import DbAuthError, DbError, SupabaseClient

URL = "https://example.supabase.co"
KEY = "sb_publishable_test"


def client_with(handler) -> tuple[SupabaseClient, list[httpx.Request]]:
    sent: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return handler(request)

    http = httpx.Client(transport=httpx.MockTransport(record))
    return SupabaseClient(URL + "/", KEY, http=http), sent


def test_every_request_carries_the_key_and_the_visitors_token():
    db, sent = client_with(
        lambda r: httpx.Response(200, json=[{"tokens_used": 0, "token_budget": 50000}])
    )
    db.budget("visitor-token")
    assert sent[0].headers["apikey"] == KEY
    assert sent[0].headers["authorization"] == "Bearer visitor-token"
    # The trailing slash in URL didn't double up.
    assert str(sent[0].url).startswith(URL + "/rest/v1/demo_sessions?")


def test_budget_reads_the_visitors_own_row():
    db, sent = client_with(
        lambda r: httpx.Response(200, json=[{"tokens_used": 49000, "token_budget": 50000}])
    )
    budget = db.budget("t")
    assert (budget.used, budget.limit, budget.remaining) == (49000, 50000, 1000)
    assert sent[0].url.params["select"] == "tokens_used,token_budget"


def test_remaining_never_goes_below_zero():
    db, _ = client_with(
        lambda r: httpx.Response(200, json=[{"tokens_used": 50400, "token_budget": 50000}])
    )
    assert db.budget("t").remaining == 0


def test_no_row_means_no_session():
    db, _ = client_with(lambda r: httpx.Response(200, json=[]))
    with pytest.raises(DbAuthError):
        db.budget("t")


def test_401_is_an_auth_error():
    db, _ = client_with(lambda r: httpx.Response(401, json={"message": "JWT expired"}))
    with pytest.raises(DbAuthError):
        db.budget("t")


def test_403_is_our_bug_not_the_visitors():
    # A missing GRANT answers 403: that must show up in the
    # logs as a failure, not as "your session expired".
    db, _ = client_with(lambda r: httpx.Response(403, json={"code": "42501"}))
    with pytest.raises(DbError):
        db.budget("t")


def test_server_error_and_network_error_are_db_errors():
    db, _ = client_with(lambda r: httpx.Response(500, text="boom"))
    with pytest.raises(DbError, match="500"):
        db.budget("t")

    def unreachable(request):
        raise httpx.ConnectError("no route", request=request)

    db, _ = client_with(unreachable)
    with pytest.raises(DbError):
        db.budget("t")


def test_match_chunks_sends_the_vector_course_and_count():
    rows = [
        {
            "chunk_id": 7,
            "document_id": "d1",
            "document_name": "Erickson_Ch3_DynamicProgramming.pdf",
            "page": 4,
            "content": "Memoization stores answers.",
            "similarity": 0.61,
        }
    ]
    db, sent = client_with(lambda r: httpx.Response(200, json=rows))
    matches = db.match_chunks("t", [0.5, 0.25], "course-1", 8)
    assert sent[0].method == "POST"
    assert sent[0].url.path == "/rest/v1/rpc/match_chunks"
    assert json.loads(sent[0].content) == {
        "query_embedding": [0.5, 0.25],
        "target_course": "course-1",
        "match_count": 8,
    }
    assert matches[0].page == 4
    assert matches[0].document_name == "Erickson_Ch3_DynamicProgramming.pdf"
    assert matches[0].similarity == 0.61


@pytest.mark.parametrize(("asked", "sent_amount"), [(3, 3), (0, 1), (-5, 1), (25000, 20000)])
def test_spend_tokens_clamps_to_what_the_sql_function_accepts(asked, sent_amount):
    db, sent = client_with(lambda r: httpx.Response(200, json=46512))
    assert db.spend_tokens("t", asked) == 46512
    assert sent[0].url.path == "/rest/v1/rpc/spend_tokens"
    assert json.loads(sent[0].content) == {"amount": sent_amount}
