"""Gemini API key pool with cooldown-based fallback.

Google applies rate limits per Cloud project (not per API key). A second key helps when it
belongs to a different project, or when the primary key is invalid / temporarily exhausted.
See: https://ai.google.dev/gemini-api/docs/rate-limits
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from enum import Enum
from threading import Lock


class KeyFailureReason(str, Enum):
    QUOTA = "quota"
    RATE_LIMIT = "rate_limit"
    AUTH = "auth"
    SERVER = "server"
    OTHER = "other"


@dataclass
class KeySlot:
    label: str
    api_key: str
    cooldown_until: float = 0.0
    last_failure: KeyFailureReason | None = None


class GeminiKeyPool:
    def __init__(
        self,
        keys: list[tuple[str, str]],
        *,
        quota_cooldown_seconds: int,
        rate_limit_cooldown_seconds: int,
        auth_cooldown_seconds: int,
    ) -> None:
        self.quota_cooldown_seconds = max(60, quota_cooldown_seconds)
        self.rate_limit_cooldown_seconds = max(5, rate_limit_cooldown_seconds)
        self.auth_cooldown_seconds = max(300, auth_cooldown_seconds)
        self._slots: list[KeySlot] = [
            KeySlot(label=label, api_key=key) for label, key in keys
        ]
        self._lock = Lock()

    @property
    def configured_count(self) -> int:
        return len(self._slots)

    def available_slots(self) -> list[KeySlot]:
        now = time.time()
        with self._lock:
            return [s for s in self._slots if s.cooldown_until <= now]

    def mark_failed(
        self,
        slot: KeySlot,
        reason: KeyFailureReason,
        *,
        retry_after_seconds: float | None = None,
    ) -> None:
        if reason == KeyFailureReason.QUOTA:
            cooldown = float(self.quota_cooldown_seconds)
        elif reason == KeyFailureReason.RATE_LIMIT:
            cooldown = float(
                retry_after_seconds or self.rate_limit_cooldown_seconds
            )
        elif reason == KeyFailureReason.AUTH:
            cooldown = float(self.auth_cooldown_seconds)
        elif reason == KeyFailureReason.SERVER:
            cooldown = min(120.0, float(retry_after_seconds or 15))
        else:
            cooldown = 30.0

        with self._lock:
            slot.cooldown_until = time.time() + cooldown
            slot.last_failure = reason

    def status_summary(self) -> dict[str, int]:
        available = self.available_slots()
        return {
            "api_keys_configured": self.configured_count,
            "api_keys_available": len(available),
        }


_pool: GeminiKeyPool | None = None


def reset_key_pool() -> None:
    global _pool
    _pool = None


def get_key_pool(
    keys: list[tuple[str, str]],
    quota_cooldown_seconds: int,
    rate_limit_cooldown_seconds: int,
    auth_cooldown_seconds: int,
) -> GeminiKeyPool:
    global _pool
    if _pool is None and keys:
        _pool = GeminiKeyPool(
            keys,
            quota_cooldown_seconds=quota_cooldown_seconds,
            rate_limit_cooldown_seconds=rate_limit_cooldown_seconds,
            auth_cooldown_seconds=auth_cooldown_seconds,
        )
    elif _pool is None:
        _pool = GeminiKeyPool(
            [],
            quota_cooldown_seconds=quota_cooldown_seconds,
            rate_limit_cooldown_seconds=rate_limit_cooldown_seconds,
            auth_cooldown_seconds=auth_cooldown_seconds,
        )
    return _pool
