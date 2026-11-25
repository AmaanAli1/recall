"""Tests for the Dyno run script, with a fake embedder and a fake search.

The real run (OpenAI + the staging database) is checked
by hand on the laptop, like the ingest script. Everything
around it is tested here: scoring, the saved JSON, and the
refusals.
"""

import json
from types import SimpleNamespace

import pytest

from recall_api.dyno.golden import GoldenSet, Question, Turn
from recall_api.scripts.dyno_run import (
    NOT_FOUND_BELOW,
    TOP_K,
    documents_needed,
    main,
    run,
    score,
)

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


def no_rewrite(history, question):
    raise AssertionError("core questions are never rewritten")


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
        GOLDEN,
        client=client,
        search=FakeSearch(),
        rewrite=no_rewrite,
        change="Baseline",
        runs_path=runs,
        out=print,
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
    # Only core questions here: no follow-up or off-topic sections.
    assert "followUps" not in saved and "offTopic" not in saved
    assert saved["rewriteTokens"] == 0


def test_a_second_run_is_appended_and_the_first_kept(tmp_path):
    runs = tmp_path / "dyno-runs.json"
    for change in ("Baseline", "Reranker"):
        client = SimpleNamespace(embeddings=FakeEmbeddings())
        run(
            GOLDEN,
            client=client,
            search=FakeSearch(),
            rewrite=no_rewrite,
            change=change,
            runs_path=runs,
            out=print,
        )

    saved = json.loads(runs.read_text(encoding="utf-8"))

    assert [(r["id"], r["change"]) for r in saved] == [("R1", "Baseline"), ("R2", "Reranker")]


def test_dry_run_needs_no_secrets(monkeypatch, tmp_path, capsys):
    monkeypatch.chdir(tmp_path)  # so no real api/.env is read

    assert main(["--dry-run"]) == 0
    out = capsys.readouterr().out
    assert "Golden set: 33 questions." in out
    assert "off-topic: expect not found" in out
    assert "(after: 'How does quicksort work?')" in out


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


# ---------- follow-ups and off-topic (PR H) ----------

HISTORY = (Turn("How does Bellman-Ford work?", "It relaxes every edge V - 1 times."),)
MIXED = GoldenSet(
    course_id=COURSE,
    questions=[
        Question("rec-01", "q1", CH1, (6,), ""),  # core
        Question("fu-08", "How can it tell?", CH8, (20,), "", history=HISTORY),
        Question("fu-07", "How fast?", CH8, (16,), "", history=HISTORY),
        Question("off-01", "Bread?", "", (), "", expect="not_found"),
        Question("off-04", "TCP?", "", (), "", expect="not_found"),
    ],
)
# The embedding order is: core, follow-ups as typed, follow-ups
# rewritten (or as typed if the rewrite kept them), off-topic.
# FakeEmbeddings numbers them 1, 2, 3...: 1 = q1; 2, 3 = typed;
# 4, 5 = rewritten; 6, 7 = off-topic.
MIXED_RESULTS = {
    1.0: [(CH1, 6, 0.61)],  # core rank 1, best 0.61
    2.0: [(CH1, 3, 0.3), (CH8, 20, 0.2)],  # fu-08 as typed: rank 2
    3.0: [(CH1, 4, 0.3)],  # fu-07 as typed: miss
    4.0: [(CH8, 20, 0.7)],  # fu-08 rewritten: rank 1
    5.0: [(CH1, 4, 0.3)],  # fu-07 "rewritten" (kept as typed): still a miss
    6.0: [(CH1, 2, 0.12)],  # off-01: below 0.25 -> not found (right)
    7.0: [(CH8, 9, 0.31)],  # off-04: above 0.25 -> would answer
}


class Rewriter:
    """fu-08 gets rewritten; fu-07's rewrite comes back unchanged (None)."""

    def __init__(self):
        self.calls = []

    def __call__(self, history, question):
        self.calls.append((history, question))
        if question == "How can it tell?":
            return "How can Bellman-Ford tell there's a negative cycle?", 40
        return None, 35


def run_mixed(tmp_path):
    client = SimpleNamespace(embeddings=FakeEmbeddings())
    rewriter = Rewriter()
    saved = run(
        MIXED,
        client=client,
        search=lambda vector, course_id, k: MIXED_RESULTS[vector[0]],
        rewrite=rewriter,
        change="Query rewriting",
        runs_path=tmp_path / "runs.json",
        out=print,
    )
    return saved, client.embeddings.calls, rewriter.calls


def test_follow_ups_are_rewritten_with_their_history_and_embedded_in_one_call(tmp_path):
    _, embed_calls, rewrite_calls = run_mixed(tmp_path)
    assert rewrite_calls == [(HISTORY, "How can it tell?"), (HISTORY, "How fast?")]
    assert embed_calls == [
        [
            "q1",
            "How can it tell?",
            "How fast?",
            "How can Bellman-Ford tell there's a negative cycle?",
            "How fast?",  # kept as typed (the rewrite returned None)
            "Bread?",
            "TCP?",
        ]
    ]


def test_core_metrics_stay_core_only(tmp_path):
    saved, _, _ = run_mixed(tmp_path)
    # n, metrics and questions describe the core group alone, so
    # this run compares with run 1 (and the site's check holds).
    assert saved["n"] == 1 and [q["id"] for q in saved["questions"]] == ["rec-01"]
    assert saved["metrics"]["recall5"]["value"] == 1.0


def test_follow_ups_are_scored_as_typed_and_rewritten(tmp_path):
    saved, _, _ = run_mixed(tmp_path)
    fu = saved["followUps"]
    assert fu["n"] == 2
    q8, q7 = fu["questions"]
    assert (q8["id"], q8["rankAsTyped"], q8["rank"]) == ("fu-08", 2, 1)
    assert q8["rewritten"] == "How can Bellman-Ford tell there's a negative cycle?"
    assert (q7["rankAsTyped"], q7["rank"], q7["rewritten"]) == (None, None, None)
    # As typed: MRR (1/2 + 0) / 2; rewritten: (1 + 0) / 2.
    assert fu["asTyped"]["mrr"]["value"] == pytest.approx(0.25)
    assert fu["rewritten"]["mrr"]["value"] == pytest.approx(0.5)
    assert fu["asTyped"]["recall5"]["value"] == fu["rewritten"]["recall5"]["value"] == 0.5
    assert saved["rewriteTokens"] == 75
    assert saved["tokens"] == 70  # 7 embedded texts x 10 (embedding only)


def test_off_topic_uses_the_api_threshold_and_records_the_margin(tmp_path):
    saved, _, _ = run_mixed(tmp_path)
    off = saved["offTopic"]
    assert off["threshold"] == NOT_FOUND_BELOW == 0.25
    assert [(q["id"], q["bestScore"], q["notFound"]) for q in off["questions"]] == [
        ("off-01", 0.12, True),
        ("off-04", 0.31, False),
    ]
    assert off["notFound"] == 1 and off["n"] == 2
    # The closest off-topic question vs the weakest real one.
    assert (off["highestScore"], off["lowestCoreScore"]) == (0.31, 0.61)


def test_an_empty_search_counts_as_not_found():
    from recall_api.scripts.dyno_run import score_off_topic

    (result,) = score_off_topic(
        [Question("off-01", "Bread?", "", (), "", expect="not_found")],
        [[1.0]],
        COURSE,
        lambda vector, course_id, k: [],
    )
    assert (result["bestScore"], result["notFound"], result["top"]) == (0.0, True, [])


def test_the_setup_names_the_rewriting_model(tmp_path):
    saved, _, _ = run_mixed(tmp_path)
    assert saved["setup"]["rewriting"] == "gpt-5.4-mini, follow-ups only"


def test_not_found_is_strictly_below_the_threshold_like_the_api():
    from recall_api.scripts.dyno_run import score_off_topic

    # /v1/answer answers when similarity >= 0.25, so exactly 0.25 is NOT "not found".
    scores = {1.0: 0.249, 2.0: 0.25, 3.0: 0.3}
    questions = [Question(f"off-0{i}", "?", "", (), "", expect="not_found") for i in (1, 2, 3)]
    results = score_off_topic(
        questions,
        [[1.0], [2.0], [3.0]],
        COURSE,
        lambda vector, course_id, k: [(CH1, 1, scores[vector[0]])],
    )
    assert [r["notFound"] for r in results] == [True, False, False]


def test_the_margin_uses_the_weakest_core_and_the_strongest_off_topic():
    from recall_api.scripts.dyno_run import summarize_off_topic

    core = [
        {"id": "a", "rank": 1, "top": [{"file": CH1, "page": 1, "score": 0.61}]},
        {"id": "b", "rank": 2, "top": [{"file": CH1, "page": 2, "score": 0.38}]},
        {"id": "c", "rank": None, "top": []},  # nothing retrieved: not counted
    ]
    off = [
        {"id": "x", "bestScore": 0.12, "notFound": True, "top": []},
        {"id": "y", "bestScore": 0.31, "notFound": False, "top": []},
    ]
    summary = summarize_off_topic(off, core)
    assert (summary["highestScore"], summary["lowestCoreScore"]) == (0.31, 0.38)


def test_off_topic_questions_need_no_loaded_document():
    # Found by the end-to-end run: "" counted as a missing document,
    # so every real run refused.
    assert documents_needed(MIXED) == {CH1, CH8}
