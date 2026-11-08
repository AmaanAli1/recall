"""At most N questions per minute per visitor (cost layer 4, D5).

Kept in this process's memory: v1 runs one container, so
that's enough. It resets when the service restarts or a new
version is deployed, which is fine for a demo. With several
containers we'd move it to a shared store (Redis, or a
table).

"Sliding window": remember the time of each recent request;
a new one is allowed if fewer than `limit` happened in the
last `window` seconds.
"""

import threading
import time
from collections import deque
from collections.abc import Callable

# Forget idle visitors once this many keys pile up.
SWEEP_AT = 1_000


class RateLimiter:
    def __init__(
        self,
        limit: int = 5,
        window: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.limit = limit
        self.window = window
        # monotonic, not time.time(): it never jumps backwards
        # when the computer's clock is changed. Tests pass a
        # fake clock instead of sleeping.
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        # FastAPI runs plain `def` endpoints in a thread pool,
        # so two requests can be in here at the same time.
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = self._clock()
        with self._lock:
            if len(self._hits) >= SWEEP_AT:
                self._sweep(now)
            hits = self._hits.setdefault(key, deque())
            # Drop the requests that left the window.
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True

    def _sweep(self, now: float) -> None:
        idle = [k for k, hits in self._hits.items() if not hits or now - hits[-1] >= self.window]
        for key in idle:
            del self._hits[key]
