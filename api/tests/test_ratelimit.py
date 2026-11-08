"""Tests for the per-visitor rate limit, with a fake clock.

The fake clock is a number we move by hand, so "a minute
later" takes no time at all.
"""

from recall_api.ratelimit import SWEEP_AT, RateLimiter


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def test_allows_the_limit_then_refuses():
    limiter = RateLimiter(limit=5, window=60, clock=Clock())
    assert [limiter.allow("a") for _ in range(6)] == [True] * 5 + [False]


def test_a_slot_frees_up_when_the_oldest_request_leaves_the_window():
    clock = Clock()
    limiter = RateLimiter(limit=2, window=60, clock=clock)
    assert limiter.allow("a")
    clock.now += 30
    assert limiter.allow("a")
    assert not limiter.allow("a")
    clock.now += 30  # the first request is now 60 s old
    assert limiter.allow("a")
    assert not limiter.allow("a")


def test_visitors_have_separate_limits():
    limiter = RateLimiter(limit=1, window=60, clock=Clock())
    assert limiter.allow("a")
    assert not limiter.allow("a")
    assert limiter.allow("b")


def test_refused_requests_dont_count():
    # Otherwise a visitor who keeps clicking would stay
    # locked out forever.
    clock = Clock()
    limiter = RateLimiter(limit=1, window=60, clock=clock)
    limiter.allow("a")
    for _ in range(10):
        clock.now += 5
        limiter.allow("a")
    clock.now += 11  # 50 + 11 = 61 s after the one allowed request
    assert limiter.allow("a")


def test_idle_visitors_are_forgotten():
    clock = Clock()
    limiter = RateLimiter(limit=1, window=60, clock=clock)
    for i in range(SWEEP_AT):
        limiter.allow(f"visitor-{i}")
    clock.now += 61
    limiter.allow("newcomer")
    assert len(limiter._hits) == 1
