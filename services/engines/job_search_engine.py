from __future__ import annotations

import asyncio
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

DEFAULT_PROVIDER_ORDER = [
    "jobspy",      # best coverage if installed
    "arbeitnow",
    "himalayas",
    "jobicy",
    "remoteok",
    "usajobs",
    "remotive",
]

PROVIDER_MAP = {
    "jobspy": JobSpyProvider,
    "arbeitnow": ArbeitnowProvider,
    "himalayas": HimalayasProvider,
    "jobicy": JobicyProvider,
    "muse": MuseProvider,
    "remoteok": RemoteOKProvider,
    "usajobs": USAJobsProvider,
    "remotive": RemotiveProvider,
}


class JobSearchEngine:
    def __init__(self, provider_order: Optional[List[str]] = None, limiter: Optional[RateLimiter] = None) -> None:
        self.provider_order = provider_order or DEFAULT_PROVIDER_ORDER
        self.limiter = limiter or RateLimiter()

    async def search(
        self,
        query: str,
        where: Optional[str] = None,
        limit: int = 60,
        min_results: int = 25,
        providers: Optional[List[str]] = None,
        batch_size: int = 2,
        per_provider_limit: int = 40,
    ) -> dict:
        """
        Fallback logic:
        - Try providers in order
        - Run in small concurrent batches
        - Stop when we have >= min_results OR we exhausted providers
        """
        order = providers or self.provider_order
        order = [p for p in order if p in PROVIDER_MAP]

        all_jobs: List[JobItem] = []
        results: List[ProviderResult] = []

        idx = 0
        while idx < len(order) and len(all_jobs) < min_results:
            batch = order[idx : idx + batch_size]
            idx += batch_size

            async def search_provider(p_name: str) -> ProviderResult:
                # Rate limit per provider (by name)
                await self.limiter.wait(key=f"provider:{p_name}")
                provider = PROVIDER_MAP[p_name]()
                return await with_retries(
                    lambda: provider.search(query=query, where=where, limit=per_provider_limit),
                    tries=3,
                    base_delay_s=2,
                    max_delay_s=20,
                )

            tasks = [search_provider(p) for p in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for p_name, r in zip(batch, batch_results):
                if isinstance(r, Exception):
                    results.append(ProviderResult(provider=p_name, jobs=[], error=str(r)))
                    continue
                results.append(r)
                all_jobs.extend(r.jobs)

            all_jobs = dedupe_jobs(all_jobs)
            if len(all_jobs) >= limit:
                all_jobs = all_jobs[:limit]
                break

        return {
            "query": query,
            "where": where,
            "providers_used": [r.provider for r in results if r.jobs],
            "provider_errors": {r.provider: r.error for r in results if r.error},
            "count": len(all_jobs),
            "jobs": all_jobs,
        }