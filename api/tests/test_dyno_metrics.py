"""Tests for the retrieval metrics, on cases small enough to work out by hand."""

import pytest

from recall_api.dyno.golden import Question
from recall_api.dyno.metrics import bootstrap_ci, first_hit_rank, hit_at_k, reciprocal_rank

CH1 = "Erickson_Ch1_Recursion.pdf"
CH8 = "Erickson_Ch8_ShortestPaths.pdf"
Q = Question("rec-01", "How many moves?", CH1, (6, 7), "")


def test_rank_of_the_first_labelled_page():
    retrieved = [(CH1, 2), (CH1, 7), (CH1, 6)]

    assert first_hit_rank(Q, retrieved) == 2  # counted from 1, first hit wins


def test_the_right_page_of_the_wrong_chapter_is_not_a_hit():
    assert first_hit_rank(Q, [(CH8, 6), (CH1, 6)]) == 2


def test_no_hit_is_none():
    assert first_hit_rank(Q, [(CH1, 1), (CH8, 6)]) is None
    assert first_hit_rank(Q, []) is None


def test_hit_at_k_includes_rank_k():
    assert hit_at_k(5, 5) == 1.0
    assert hit_at_k(6, 5) == 0.0
    assert hit_at_k(None, 5) == 0.0


def test_reciprocal_rank():
    assert reciprocal_rank(1) == 1.0
    assert reciprocal_rank(4) == 0.25
    assert reciprocal_rank(None) == 0.0


def test_mrr_by_hand():
    # Ranks 1, 2 and a miss: (1 + 0.5 + 0) / 3 = 0.5.
    scores = [reciprocal_rank(r) for r in (1, 2, None)]

    assert bootstrap_ci(scores).value == pytest.approx(0.5)


def test_bootstrap_is_repeatable_with_a_seed():
    # 20 different MRR-like scores: different random picks
    # would almost surely give a different interval.
    scores = [1 / rank for rank in range(1, 21)]

    assert bootstrap_ci(scores, seed=0) == bootstrap_ci(scores, seed=0)
    assert bootstrap_ci(scores, seed=0) != bootstrap_ci(scores, seed=1)


def test_bootstrap_brackets_the_mean():
    scores = [1.0] * 17 + [0.0] * 3  # recall 0.85

    first = bootstrap_ci(scores)

    assert first.value == pytest.approx(0.85)
    assert first.low < first.value < first.high
    # With 20 questions the interval is wide: that's the point.
    assert first.high - first.low > 0.2


def test_bootstrap_of_identical_scores_has_no_spread():
    assert bootstrap_ci([1.0] * 20) == bootstrap_ci([1.0] * 20, seed=7)
    e = bootstrap_ci([1.0] * 20)
    assert (e.low, e.value, e.high) == (1.0, 1.0, 1.0)


def test_bootstrap_needs_scores():
    with pytest.raises(ValueError):
        bootstrap_ci([])
