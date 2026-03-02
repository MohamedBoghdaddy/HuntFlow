from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass, field
from typing import Dict, Optional
from urllib.parse import urlparse


@dataclass
class RateLimitPolicy:
    min_delay_s: float = 6.0
    max_delay_s: float = 14.0
    jitter_s: float = 2.0


@dataclass
class RateLimiter:
    default_policy: RateLimitPolicy = field(default_factory=RateLimitPolicy)
    policies: Dict[str, RateLimitPolicy] = field(default_factory=dict)
    _last_hit: Dict[str, float] = field(default_factory=dict)

    def _policy_for(self, key: str) -> RateLimitPolicy:
        return self.policies.get(key, self.default_policy)

    @staticmethod
    def _key_from_url(url: Optional[str]) -> str:
        if not url:
            return "unknown"
        try:
            host = urlparse(url).netloc.lower()
            return host or "unknown"
        except Exception:
            return "unknown"

    async def wait(self, *, url: Optional[str] = None, key: Optional[str] = None) -> float:
        k = key or self._key_from_url(url)
        policy = self._policy_for(k)

        now = time.monotonic()
        last = self._last_hit.get(k, 0.0)
        base = random.uniform(policy.min_delay_s, policy.max_delay_s)
        jitter = random.uniform(0.0, policy.jitter_s)
        target_gap = base + jitter

        elapsed = now - last
        sleep_s = max(0.0, target_gap - elapsed)

        if sleep_s > 0:
            await asyncio.sleep(sleep_s)

        self._last_hit[k] = time.monotonic()
        return sleep_s