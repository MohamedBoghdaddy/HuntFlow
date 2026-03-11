# utils/rate_limiter.py
"""
Per-provider rate-limit policies.

Tier A – Official JSON APIs (fast, cheap to hit): 1–2.5 s gap
    adzuna, remotive, himalayas, jobicy

Tier B – Semi-structured public APIs (moderate): 3–6 s gap
    arbeitnow, muse, usajobs

Tier C – HTML scrapers / heavy adapters (slow/fragile): 8–14 s gap
    remoteok, jobspy

The default (unknown key) falls into Tier B so we are conservative with
anything not explicitly listed.
"""

from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass, field
from typing import Dict, Optional
from urllib.parse import urlparse


@dataclass
class RateLimitPolicy:
    min_delay_s: float = 3.0
    max_delay_s: float = 6.0
    jitter_s: float = 1.0


# ── Per-provider policies ─────────────────────────────────────────────────────

# Tier A: Official REST APIs – low delay is usually safe
_TIER_A = RateLimitPolicy(min_delay_s=1.0, max_delay_s=2.5, jitter_s=0.5)

# Tier B: Public but rate-limited endpoints
_TIER_B = RateLimitPolicy(min_delay_s=3.0, max_delay_s=6.0, jitter_s=1.0)

# Tier C: Scrapers / heavy clients – be polite
_TIER_C = RateLimitPolicy(min_delay_s=8.0, max_delay_s=14.0, jitter_s=2.0)


PROVIDER_POLICIES: Dict[str, RateLimitPolicy] = {
    # Tier A
    "provider:adzuna": _TIER_A,
    "provider:remotive": _TIER_A,
    "provider:himalayas": _TIER_A,
    "provider:jobicy": _TIER_A,

    # Tier B
    "provider:arbeitnow": _TIER_B,
    "provider:muse": _TIER_B,
    "provider:usajobs": _TIER_B,

    # Tier C
    "provider:remoteok": _TIER_C,
    "provider:jobspy": _TIER_C,
}


@dataclass
class RateLimiter:
    default_policy: RateLimitPolicy = field(default_factory=lambda: _TIER_B)
    policies: Dict[str, RateLimitPolicy] = field(
        default_factory=lambda: dict(PROVIDER_POLICIES)
    )
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
        """
        Enforce the gap between consecutive calls to the same provider/host.
        Returns the actual sleep time in seconds.
        """
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