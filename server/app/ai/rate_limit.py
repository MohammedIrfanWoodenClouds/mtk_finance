"""Layered rate limits: global (project quota) + per-user (fair use)."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock
from uuid import UUID

from fastapi import HTTPException

_GLOBAL_KEY = "__global__"


@dataclass(frozen=True)
class RateLimitStatus:
    rpm_limit: int
    rpd_limit: int
    min_interval_seconds: int
    requests_remaining_minute: int
    requests_remaining_day: int
    retry_after_seconds: int | None = None


class SlidingWindowLimiter:
    def __init__(
        self,
        rpm: int,
        rpd: int,
        min_interval_seconds: int = 0,
    ) -> None:
        self.rpm = max(1, rpm)
        self.rpd = max(1, rpd)
        self.min_interval_seconds = max(0, min_interval_seconds)
        self._minute_hits: dict[str, deque[float]] = defaultdict(deque)
        self._day_hits: dict[str, deque[float]] = defaultdict(deque)
        self._last_request_at: dict[str, float] = {}
        self._lock = Lock()

    def _prune(self, q: deque[float], window_sec: float, now: float) -> None:
        cutoff = now - window_sec
        while q and q[0] < cutoff:
            q.popleft()

    def status(self, bucket_id: str) -> RateLimitStatus:
        now = time.time()
        with self._lock:
            minute_q = self._minute_hits[bucket_id]
            day_q = self._day_hits[bucket_id]
            self._prune(minute_q, 60.0, now)
            self._prune(day_q, 86400.0, now)

            retry_after: int | None = None
            if self.min_interval_seconds > 0:
                last = self._last_request_at.get(bucket_id)
                if last is not None:
                    elapsed = now - last
                    if elapsed < self.min_interval_seconds:
                        retry_after = max(
                            1, int(self.min_interval_seconds - elapsed) + 1
                        )

            if len(minute_q) >= self.rpm:
                retry_after = max(
                    retry_after or 0,
                    int(60 - (now - minute_q[0])) + 1,
                )
            if len(day_q) >= self.rpd:
                retry_after = max(
                    retry_after or 0,
                    int(86400 - (now - day_q[0])) + 1,
                )

            return RateLimitStatus(
                rpm_limit=self.rpm,
                rpd_limit=self.rpd,
                min_interval_seconds=self.min_interval_seconds,
                requests_remaining_minute=max(0, self.rpm - len(minute_q)),
                requests_remaining_day=max(0, self.rpd - len(day_q)),
                retry_after_seconds=retry_after,
            )

    def enforce(self, bucket_id: str, *, scope_label: str) -> None:
        st = self.status(bucket_id)
        if st.retry_after_seconds:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"{scope_label}: too many assistant requests. "
                    f"Please wait {st.retry_after_seconds} seconds."
                ),
                headers={"Retry-After": str(st.retry_after_seconds)},
            )

    def record(self, bucket_id: str) -> None:
        now = time.time()
        with self._lock:
            if self.min_interval_seconds > 0:
                self._last_request_at[bucket_id] = now
            self._minute_hits[bucket_id].append(now)
            self._day_hits[bucket_id].append(now)


_user_limiter: SlidingWindowLimiter | None = None
_global_limiter: SlidingWindowLimiter | None = None


def get_user_rate_limiter(
    rpm: int, rpd: int, min_interval_seconds: int
) -> SlidingWindowLimiter:
    global _user_limiter
    if _user_limiter is None:
        _user_limiter = SlidingWindowLimiter(rpm, rpd, min_interval_seconds)
    return _user_limiter


def get_global_rate_limiter(rpm: int, rpd: int) -> SlidingWindowLimiter:
    global _global_limiter
    if _global_limiter is None:
        _global_limiter = SlidingWindowLimiter(rpm, rpd, min_interval_seconds=0)
    return _global_limiter


def enforce_ai_request_limits(user_id: UUID, settings) -> None:
    """Global cap first (protects Gemini project quota), then per-user fair use."""
    get_global_rate_limiter(
        settings.GEMINI_RPM_GLOBAL,
        settings.GEMINI_RPD_GLOBAL,
    ).enforce(_GLOBAL_KEY, scope_label="Service")

    get_user_rate_limiter(
        settings.GEMINI_RPM_PER_USER,
        settings.GEMINI_RPD_PER_USER,
        settings.GEMINI_MIN_INTERVAL_SECONDS,
    ).enforce(str(user_id), scope_label="Your account")


def record_ai_request(user_id: UUID, settings) -> None:
    get_global_rate_limiter(
        settings.GEMINI_RPM_GLOBAL,
        settings.GEMINI_RPD_GLOBAL,
    ).record(_GLOBAL_KEY)
    get_user_rate_limiter(
        settings.GEMINI_RPM_PER_USER,
        settings.GEMINI_RPD_PER_USER,
        settings.GEMINI_MIN_INTERVAL_SECONDS,
    ).record(str(user_id))


def combined_user_status(user_id: UUID, settings) -> RateLimitStatus:
    """Tightest limit between global pool and this user."""
    global_st = get_global_rate_limiter(
        settings.GEMINI_RPM_GLOBAL,
        settings.GEMINI_RPD_GLOBAL,
    ).status(_GLOBAL_KEY)
    user_st = get_user_rate_limiter(
        settings.GEMINI_RPM_PER_USER,
        settings.GEMINI_RPD_PER_USER,
        settings.GEMINI_MIN_INTERVAL_SECONDS,
    ).status(str(user_id))

    retry = None
    if global_st.retry_after_seconds and user_st.retry_after_seconds:
        retry = max(global_st.retry_after_seconds, user_st.retry_after_seconds)
    else:
        retry = global_st.retry_after_seconds or user_st.retry_after_seconds

    return RateLimitStatus(
        rpm_limit=min(global_st.rpm_limit, user_st.rpm_limit),
        rpd_limit=min(global_st.rpd_limit, user_st.rpd_limit),
        min_interval_seconds=user_st.min_interval_seconds,
        requests_remaining_minute=min(
            global_st.requests_remaining_minute,
            user_st.requests_remaining_minute,
        ),
        requests_remaining_day=min(
            global_st.requests_remaining_day,
            user_st.requests_remaining_day,
        ),
        retry_after_seconds=retry,
    )
