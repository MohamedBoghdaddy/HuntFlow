"""
engines/job_search_engine.py

Improvements:
  1. ROI-ranked provider order
  2. Per-provider rate-limit tiers via updated RateLimiter
  3. 1-hour disk cache – same query skips network calls for 60 min
  4. Tier-1 providers can run in larger concurrent batches
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional, List

from services.responses.jobs import JobItem
from services.services.providers.base import dedupe_jobs, ProviderResult
from services.services.providers.arbeitnow import ArbeitnowProvider
from services.services.providers.himalayas import HimalayasProvider
from services.services.providers.jobicy import JobicyProvider
from services.services.providers.remoteok import RemoteOKProvider
from services.services.providers.remotive import RemotiveProvider
from services.services.providers.usajobs import USAJobsProvider
from services.services.providers.jobspy_adapter import JobSpyProvider
from services.services.providers.muse import MuseProvider
from services.utils.rate_limiter import RateLimiter
from services.utils.retry import with_retries
from services.utils.job_cache import get_default_cache

log = logging.getLogger(__name__)

# ── ROI-ranked provider order ────────────────────────────────────────────────
#
# Tier 1 – Official APIs, query-aware, high yield, fast:
#   adzuna    → structured API, best data, direct apply URLs
#   remotive  → direct search param, good yield for remote tech
#   himalayas → remote-focused, clean API with query param
#   jobicy    → query param supported, consistent JSON
#
# Tier 2 – Good coverage but may need client-side filtering or extra hops:
#   arbeitnow → EU-heavy, client-side title filter
#   jobspy    → broad reach but slower / optional dependency
#
# Tier 3 – Niche / noisy / lower hit rate for most queries:
#   remoteok  → bulk fetch then local filter
#   muse      → client-side filter only
#   usajobs   → narrow niche
#
DEFAULT_PROVIDER_ORDER = [
    # Tier 1
    "adzuna",
    "remotive",
    "himalayas",
    "jobicy",
    # Tier 2
    "arbeitnow",
    "jobspy",
    # Tier 3
    "remoteok",
    "muse",
    "usajobs",
]

TIER1_PROVIDERS = {"adzuna", "remotive", "himalayas", "jobicy"}
TIER2_PROVIDERS = {"arbeitnow", "jobspy"}

PROVIDER_MAP = {
    "jobspy": JobSpyProvider,
    "arbeitnow": ArbeitnowProvider,
    "himalayas": HimalayasProvider,
    "jobicy": JobicyProvider,
    "muse": MuseProvider,
    "remoteok": RemoteOKProvider,
    "usajobs": USAJobsProvider,
    "remotive": RemotiveProvider,
    "adzuna": None,  # lazy import
}


def _get_provider(name: str):
    cls = PROVIDER_MAP.get(name)
    if cls is None and name == "adzuna":
        from services.services.providers.adzuna import AdzunaProvider
        return AdzunaProvider()
    if cls is None:
        raise KeyError(f"Unknown provider: {name}")
    return cls()


class JobSearchEngine:
    def __init__(
        self,
        provider_order: Optional[List[str]] = None,
        limiter: Optional[RateLimiter] = None,
        cache_ttl_s: float = 3600.0,
    ) -> None:
        self.provider_order = provider_order or DEFAULT_PROVIDER_ORDER
        self.limiter = limiter or RateLimiter()
        self._cache = get_default_cache()
        self._cache.ttl_s = cache_ttl_s

    async def search(
        self,
        query: str,
        where: Optional[str] = None,
        limit: int = 60,
        min_results: int = 25,
        providers: Optional[List[str]] = None,
        batch_size: int = 3,
        per_provider_limit: int = 40,
    ) -> dict:
        """
        ROI-first provider search with caching.

        Behavior:
        - checks cache first
        - searches providers in ranked order
        - runs providers in small concurrent batches
        - stops when min_results is reached or providers are exhausted
        - caps final jobs to `limit`
        """
        order = providers or self.provider_order
        order = [p for p in order if p in PROVIDER_MAP]

        cached = self._cache.get(query=query, where=where, providers=order)
        if cached is not None:
            log.info("job_cache: returning cached result for query=%r where=%r", query, where)
            return cached

        all_jobs: List[JobItem] = []
        results: List[ProviderResult] = []

        idx = 0
        while idx < len(order) and len(all_jobs) < min_results:
            batch = order[idx: idx + batch_size]
            idx += batch_size

            async def search_provider(p_name: str) -> ProviderResult:
                await self.limiter.wait(key=f"provider:{p_name}")
                provider = _get_provider(p_name)
                return await with_retries(
                    lambda: provider.search(
                        query=query,
                        where=where,
                        limit=per_provider_limit,
                    ),
                    tries=3,
                    base_delay_s=2,
                    max_delay_s=20,
                )

            tasks = [search_provider(p) for p in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for p_name, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    log.warning("provider %s failed: %s", p_name, result)
                    results.append(
                        ProviderResult(provider=p_name, jobs=[], error=str(result))
                    )
                    continue

                results.append(result)
                all_jobs.extend(result.jobs)

            all_jobs = dedupe_jobs(all_jobs)

            if len(all_jobs) >= limit:
                all_jobs = all_jobs[:limit]
                break

        payload = {
            "query": query,
            "where": where,
            "providers_used": [r.provider for r in results if r.jobs],
            "provider_errors": {r.provider: r.error for r in results if r.error},
            "count": len(all_jobs),
            "jobs": all_jobs,
        }

        self._cache.set(query=query, where=where, providers=order, data=payload)

        log.info(
            "job_search: fetched %d jobs from %s for query=%r where=%r",
            len(all_jobs),
            payload["providers_used"],
            query,
            where,
        )

        return payload