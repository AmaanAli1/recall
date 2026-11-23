"""Tests for the Dyno run script, with a fake embedder and a fake search.

The real run (OpenAI + the staging database) is checked
by hand on the laptop, like the ingest script. Everything
around it is tested here: scoring, the saved JSON, and the
refusals.
"""

import json
from types import SimpleNamespace

import pytest

from recall_api.dyno.golden import GoldenSet, Question
from recall_api.scripts.dyno_run import TOP_K, main, run, score

COURSE = "00000000-0000-0000-0000-00000000c001"
CH1 = "Erickson_Ch1_Recursion.pdf"
CH8 = "Erickson_Ch8_ShortestPaths.pdf"

GOLDEN = GoldenSet(
    course_id=COURSE,
    questions=[
        Question("rec-01", "q1", CH1, (6,), ""),
        Question("sssp-04", "q2", CH8, (16,), ""),
        Question("sssp-05", "q3", CH8, (20,), ""),
    ],
)

# What the fake database returns for each question's
# vector (the vector's first number says which question).
RESULTS = {
    1.0: [(CH1, 6, 0.61), (CH1, 5, 0.52)],  # rank 1
    2.0: [(CH8, 15, 0.55), (CH1, 16, 0.5), (CH8, 16, 0.49)],  # rank 3 (CH1 p16 isn't it)
    3.0: [(CH8, 2, 0.3)],  # miss
}


class FakeEmbeddings:
    def __init__(self):
        self.calls = []

    def create(self, model, input):
        self.calls.append(input)
        data = [
            SimpleNamespace(index=i, embedding=[float(i + 1)] + [0.0] * 1535)
            for i in range(len(input))
        ]
        return SimpleNamespace(data=data, usage=SimpleNamespace(total_tokens=10 * len(input)))


class FakeSearch:
    def __init__(self):
        self.calls = []

    def __call__(self, vector, course_id, k):
        self.calls.append((course_id, k))
        return RESULTS[vector[0]]


def test_score_ranks_each_question():
    search = FakeSearch()

    results = score(GOLDEN, [[1.0], [2.0], [3.0]], search)

    assert [r["rank"] for r in results] == [1, 3, None]
    assert search.calls == [(COURSE, TOP_K)] * 3  # the golden set's course, top 10
    assert results[0]["top"][0] == {"file": CH1, "page": 6, "score": 0.61}


def test_mrr_looks_past_the_top_5():
    # The right page at rank 7: a miss for recall@5, but MRR
    # still counts it (1/7), so all 10 results get ranked.
    one = GoldenSet(course_id=COURSE, questions=[Question("sssp-05", "q", CH8, (20,), "")])
    hits = [(CH1, page, 0.5) for page in range(1, 7)] + [(CH8, 20, 0.4)]

    results = score(one, [[1.0]], lambda vector, course_id, k: hits)

    assert results[0]["rank"] == 7
    assert len(results[0]["top"]) == 5  # only the top 5 are saved for reading


def test_a_run_embeds_once_scores_and_saves(tmp_path):
    client = SimpleNamespace(embeddings=FakeEmbeddings())
    runs = tmp_path / "data" / "dyno-runs.json"  # folder doesn't exist yet

    saved = run(
        GOLDEN, client=client, search=FakeSearch(), change="Baseline", runs_path=runs, out=print
    )

    assert client.embeddings.calls == [["q1", "q2", "q3"]]  # one call, plain questions
    on_disk = json.loads(runs.read_text(encoding="utf-8"))
    assert on_disk == [saved]
    assert saved["id"] == "R1"
    assert saved["change"] == "Baseline"
    assert saved["n"] == 3
    assert saved["tokens"] == 30
    # recall@5: ranks 1 and 3 are in, the miss isn't: 2/3.
    assert saved["metrics"]["recall5"]["value"] == pytest.approx(0.667)
    # MRR: (1 + 1/3 + 0) / 3 = 0.444.
    assert saved["metrics"]["mrr"]["value"] == pytest.approx(0.444)
    assert saved["questions"][2] == {
        "id": "sssp-05",
        "rank": None,
        "top": [{"file": CH8, "page": 2, "score": 0.3}],
    }
    assert saved["setup"]["embedModel"] == "text-embedding-3-small"


def test_a_second_run_is_appended_and_the_first_kept(tmp_path):
    runs = tmp_path / "dyno-runs.json"
    for change in ("Baseline", "Reranker"):
        client = SimpleNamespace(embeddings=FakeEmbeddings())
        run(GOLDEN, client=client, search=FakeSearch(), change=change, runs_path=runs, out=print)

    saved = json.loads(runs.read_text(encoding="utf-8"))

    assert [(r["id"], r["change"]) for r in saved] == [("R1", "Baseline"), ("R2", "Reranker")]


def test_dry_run_needs_no_secrets(monkeypatch, tmp_path, capsys):
    monkeypatch.chdir(tmp_path)  # so no real api/.env is read

    assert main(["--dry-run"]) == 0
    assert "Golden set: 20 questions." in capsys.readouterr().out


def test_a_real_run_needs_a_change_label(monkeypatch, tmp_path, capsys):
    monkeypatch.chdir(tmp_path)

    assert main(["--ref", "sikrkiebrudfqylhgdlu"]) == 2
    assert "--change" in capsys.readouterr().out


def test_a_real_run_refuses_a_mismatched_ref(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv(
        "ADMIN_DATABASE_URL",
        "postgresql://postgres.sikrkiebrudfqylhgdlu:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
    )
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-not-real")
    monkeypatch.chdir(tmp_path)
    runs = tmp_path / "dyno-runs.json"

    code = main(["--ref", "ztulgqetgkzyecohcfgh", "--change", "Baseline", "--runs", str(runs)])

    assert code == 2
    assert "Refusing" in capsys.readouterr().out
    assert not runs.exists()  # nothing written


def test_a_broken_golden_set_is_an_error(monkeypatch, tmp_path, capsys):
    monkeypatch.chdir(tmp_path)
    bad = tmp_path / "golden.toml"
    bad.write_text('course_id = "not-a-uuid"\n', encoding="utf-8")

    assert main(["--dry-run", "--golden", str(bad)]) == 1
    assert "Error:" in capsys.readouterr().out
