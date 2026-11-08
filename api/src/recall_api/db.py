"""Talk to Supabase AS THE VISITOR (decision D1).

Every request carries two things:
  apikey: the publishable key (public; says "this is Recall")
  Authorization: Bearer <the visitor's own token>

Supabase's REST layer (PostgREST) checks the token and runs
each query as that visitor, so the RLS policies decide what
we can see, exactly like in the Next.js route handlers.
This service holds no database password and no secret key:
if it had a bug, it still couldn't read anyone else's data.

PostgREST URLs used here:
  GET  /rest/v1/demo_sessions?select=...   a table (RLS: own row)
  POST /rest/v1/rpc/match_chunks           a SQL function
  POST /rest/v1/rpc/spend_tokens           a SQL function
"""

from dataclasses import dataclass
from typing import Any

import httpx

# spend_tokens() refuses anything outside 1..20,000 (PR #31).
MIN_SPEND = 1
MAX_SPEND = 20_000


class DbAuthError(Exception):
    """The token is missing, expired or has no demo session."""


class DbError(Exception):
    """Anything else: Supabase down, a bug in a query, a 500."""


@dataclass(frozen=True)
class Budget:
    used: int
    limit: int

    @property
    def remaining(self) -> int:
        return max(self.limit - self.used, 0)


@dataclass(frozen=True)
class Match:
    """One row from match_chunks(): a passage and how close it is."""

    chunk_id: int
    document_name: str
    page: int
    content: str
    similarity: float  # 1 = same meaning, 0 = unrelated


class SupabaseClient:
    def __init__(
        self,
        url: str,
        publishable_key: str,
        *,
        http: httpx.Client | None = None,
    ) -> None:
        self._rest = url.rstrip("/") + "/rest/v1"
        self._key = publishable_key
        # Tests pass an httpx.Client with a fake transport;
        # the real one gets a 10-second timeout so a stuck
        # Supabase can't hang the request forever.
        self._http = http or httpx.Client(timeout=10.0)

    def _send(self, method: str, path: str, token: str, **kwargs: Any) -> Any:
        headers = {"apikey": self._key, "Authorization": f"Bearer {token}"}
        try:
            response = self._http.request(method, self._rest + path, headers=headers, **kwargs)
        except httpx.HTTPError as exc:  # timeout, DNS, connection refused...
            raise DbError(f"{method} {path} failed: {exc}") from exc
        # 401 = PostgREST didn't accept the token (expired,
        # malformed, or an anonymous-role token). A 403 would
        # be a missing GRANT: our bug, so it's a DbError.
        if response.status_code == 401:
            raise DbAuthError("Supabase rejected the visitor's token.")
        if response.is_error:
            # Keep the body short: it goes to the logs only.
            raise DbError(f"{method} {path} -> {response.status_code}: {response.text[:300]}")
        return response.json()

    def budget(self, token: str) -> Budget:
        """The visitor's own token budget (RLS returns only their row)."""
        rows = self._send(
            "GET", "/demo_sessions", token, params={"select": "tokens_used,token_budget"}
        )
        if not rows:
            # A valid token whose session was cleaned up.
            raise DbAuthError("No demo session for this token.")
        return Budget(used=rows[0]["tokens_used"], limit=rows[0]["token_budget"])

    def match_chunks(
        self, token: str, embedding: list[float], course_id: str, count: int
    ) -> list[Match]:
        """The `count` passages of one course closest to the question."""
        rows = self._send(
            "POST",
            "/rpc/match_chunks",
            token,
            # A JSON list of numbers works for vector(1536):
            # PostgREST hands it over as '[0.1, ...]', which is
            # pgvector's text format.
            json={
                "query_embedding": embedding,
                "target_course": course_id,
                "match_count": count,
            },
        )
        return [
            Match(
                chunk_id=row["chunk_id"],
                document_name=row["document_name"],
                page=row["page"],
                content=row["content"],
                similarity=row["similarity"],
            )
            for row in rows
        ]

    def spend_tokens(self, token: str, amount: int) -> int:
        """Charge the visitor's budget; returns what's left."""
        # Clamp into what the SQL function accepts, so a tiny
        # not-found answer (a few tokens) or a huge one never
        # turns into an error after the work is done.
        amount = min(max(amount, MIN_SPEND), MAX_SPEND)
        # A function returning one integer comes back as a
        # bare JSON number, e.g. 46512.
        return int(self._send("POST", "/rpc/spend_tokens", token, json={"amount": amount}))
