"""
engines/job_search_engine.py

Fix:
- Run providers tier-by-tier (sequential tiers)
- Provider plan adapts to search parameters (query, where)
- Tier-specific batch size and per-provider limits (Tier 1 can be larger)
- Keep cache, retries, dedupe, rate limiter
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Optional, List, Dict, Tuple

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

# ── ROI-ranked provider order (base) ─────────────────────────────────────────
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
TIER3_PROVIDERS = {"remoteok", "muse", "usajobs"}

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


def _normalize_text(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _looks_remote(text: str) -> bool:
    if not text:
        return False
    return any(k in text for k in ["remote", "work from home", "wfh", "distributed"])


def _looks_eu(text: str) -> bool:
    if not text:
        return False
    # lightweight signals only
    return any(k in text for k in ["europe", "eu", "germany", "france", "netherlands", "spain", "italy"])


def _looks_us(text: str) -> bool:
    if not text:
        return False
    return any(k in text for k in ["united states", "usa", "us ", " u.s", "washington", "california", "new york"])


def _tier_of(p: str) -> int:
    if p in TIER1_PROVIDERS:
        return 1
    if p in TIER2_PROVIDERS:
        return 2
    return 3


def _build_provider_plan(
    base_order: List[str],
    query: str,
    where: Optional[str],
    providers_override: Optional[List[str]],
) -> List[List[str]]:
    """
    Returns providers grouped into tiers, ordered sequentially.
    The tier order is adapted based on the search parameters.
    """
    q = _normalize_text(query)
    w = _normalize_text(where)
    combined = f"{q} {w}".strip()

    # Start with override or default, keep only known providers
    order = providers_override or base_order
    order = [p for p in order if p in PROVIDER_MAP]

    # Make sure adzuna is always present (it is your highest-yield structured source)
    if "adzuna" not in order:
        order = ["adzuna", *order]

    # Base grouping
    tier1 = [p for p in order if p in TIER1_PROVIDERS]
    tier2 = [p for p in order if p in TIER2_PROVIDERS]
    tier3 = [p for p in order if p in TIER3_PROVIDERS]

    # Adapt tier ordering based on intent
    remote_intent = _looks_remote(combined)
    eu_intent = _looks_eu(combined)
    us_intent = _looks_us(combined)

    # Heuristics:
    # - Remote intent: remote-focused Tier 1 first, then RemoteOK earlier inside Tier 3
    # - EU intent: Arbeitnow earlier inside Tier 2
    # - US intent: USAJobs earlier inside Tier 3
    if remote_intent:
        # reorder tier1 to bias remote providers after adzuna
        if "adzuna" in tier1:
            tier1 = ["adzuna"] + [p for p in tier1 if p != "adzuna"]
        # bring remoteok forward inside tier3
        tier3 = (["remoteok"] if "remoteok" in tier3 else []) + [p for p in tier3 if p != "remoteok"]

    if eu_intent:
        tier2 = (["arbeitnow"] if "arbeitnow" in tier2 else []) + [p for p in tier2 if p != "arbeitnow"]

    if us_intent:
        tier3 = (["usajobs"] if "usajobs" in tier3 else []) + [p for p in tier3 if p != "usajobs"]

    # Final sequential tiers
    tiers: List[List[str]] = []
    if tier1:
        tiers.append(tier1)
    if tier2:
        tiers.append(tier2)
    if tier3:
        tiers.append(tier3)

    return tiers


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
        Tier-sequential provider search with caching.

        Behavior:
        - cache first
        - build a tier plan based on query/where
        - run Tier 1, then Tier 2, then Tier 3 (sequential tiers)
        - within each tier, run providers in batches (tier-aware concurrency)
        - stop when min_results reached or providers exhausted
        - cap final jobs to `limit`
        """

        tiers = _build_provider_plan(
            base_order=self.provider_order,
            query=query,
            where=where,
            providers_override=providers,
        )

        flat_order = [p for tier in tiers for p in tier]

        cached = self._cache.get(query=query, where=where, providers=flat_order)
        if cached is not None:
            log.info("job_cache: returning cached result for query=%r where=%r", query, where)
            return cached

        all_jobs: List[JobItem] = []
        results: List[ProviderResult] = []

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

        # Tier-by-tier execution
        for tier in tiers:
            if len(all_jobs) >= min_results:
                break

            # Tier-aware concurrency
            tier_num = _tier_of(tier[0]) if tier else 3
            tier_batch_size = batch_size

            # Tier 1 can run larger concurrent batches
            if tier_num == 1:
                tier_batch_size = max(batch_size, 4)
            elif tier_num == 2:
                tier_batch_size = max(2, min(batch_size, 3))
            else:
                tier_batch_size = 1  # Tier 3 tends to be noisier, keep it sequential

            idx = 0
            while idx < len(tier) and len(all_jobs) < min_results:
                batch = tier[idx: idx + tier_batch_size]
                idx += tier_batch_size

                batch_results = await asyncio.gather(
                    *[search_provider(p) for p in batch],
                    return_exceptions=True,
                )

                for p_name, result in zip(batch, batch_results):
                    if isinstance(result, Exception):
                        log.warning("provider %s failed: %s", p_name, result)
                        results.append(ProviderResult(provider=p_name, jobs=[], error=str(result)))
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
            "providers_plan": tiers,
            "providers_used": [r.provider for r in results if r.jobs],
            "provider_errors": {r.provider: r.error for r in results if r.error},
            "count": len(all_jobs),
            "jobs": all_jobs,
        }

        self._cache.set(query=query, where=where, providers=flat_order, data=payload)

        log.info(
            "job_search: fetched %d jobs from %s for query=%r where=%r",
            len(all_jobs),
            payload["providers_used"],
            query,
            where,
        )

        return payload