"""Tests for the health check.

TestClient calls the app in-process: no server, no
network, so the test is fast and needs no setup.
"""

from fastapi.testclient import TestClient

from recall_api.main import app

client = TestClient(app)


def test_health_says_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_health_needs_no_settings(monkeypatch):
    # The load balancer must get an answer even if a
    # secret is missing, so /health may not read settings.
    for name in ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "OPENAI_API_KEY", "INTERNAL_KEY"):
        monkeypatch.delenv(name, raising=False)

    assert client.get("/health").status_code == 200
