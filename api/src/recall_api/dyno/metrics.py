"""Retrieval metrics: pure functions, no network, easy to test.

For each question we only need one number: the rank of
the first retrieved chunk that hits a labelled page (or
None if none of the top results did). Both metrics are
built from that rank:

  recall@k: 1 if rank <= k, else 0     ("was it in the top k?")
  MRR:      1 / rank, or 0 if missing  ("how near the top?")

Averaged over the golden set, each gets a 95% bootstrap
interval, because with 20 questions one question moves
recall by 0.05.
"""

import random
from collections.abc import Sequence
from dataclasses import dataclass

from recall_api.dyno.golden import Question


def first_hit_rank(question: Question, retrieved: Sequence[tuple[str, int]]) -> int | None:
    """Rank (1 = best) of the first (document, page) that answers it."""
    # start=1: ranks are counted like people count them, so
    # the best result is rank 1 and 1/rank never divides by 0.
    for rank, (document, page) in enumerate(retrieved, start=1):
        if question.is_hit(document, page):
            return rank
    return None


def hit_at_k(rank: int | None, k: int) -> float:
    """1.0 if the first hit is in the top k, else 0.0."""
    return 1.0 if rank is not None and rank <= k else 0.0


def reciprocal_rank(rank: int | None) -> float:
    """1/rank: rank 1 → 1.0, rank 2 → 0.5, missing → 0.0."""
    return 0.0 if rank is None else 1.0 / rank


@dataclass(frozen=True)
class Estimate:
    value: float  # the mean over all questions
    low: float  # 95% interval
    high: float


def bootstrap_ci(scores: Sequence[float], n_boot: int = 1000, seed: int = 0) -> Estimate:
    """The mean of `scores`, with a 95% bootstrap interval.

    Resample the per-question scores WITH replacement (the
    same question can be picked twice, another not at all),
    take each resample's mean, and read the 2.5th and 97.5th
    percentiles of those means. The fixed seed makes every
    run of the same scores give the same interval.
    """
    if not scores:
        raise ValueError("no scores to average")
    n = len(scores)
    rng = random.Random(seed)  # our own generator: no global state
    means = sorted(sum(rng.choices(scores, k=n)) / n for _ in range(n_boot))
    # Index of a percentile in the sorted list (0-based).
    low = means[round(0.025 * (n_boot - 1))]
    high = means[round(0.975 * (n_boot - 1))]
    return Estimate(value=sum(scores) / n, low=low, high=high)
