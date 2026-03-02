from __future__ import annotations

import httpx
from typing import Optional

from .base import JobProvider, ProviderResult
from ...responses.jobs import JobItem
from ...core.config import settings


class JobicyProvider(JobProvider):
    name = "jobicy"

    async def search(self, query: str, limit: int = 50, where: Optional[str] = None) -> ProviderResult:
        # Jobicy public API endpoint
        url = "https://jobicy.com/api/v2/remote-jobs"
        try:
            async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_S) as client:
                r = await client.get(url, params={"count": min(limit, 50), "tag": query})
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            return ProviderResult(provider=self.name, jobs=[], error=str(e))

        jobs: list[JobItem] = []
        for item in (data.get("jobs") or []):
            title = (item.get("jobTitle") or "").strip()
            company = (item.get("companyName") or "").strip()
            location = (item.get("jobGeo") or "Remote").strip()
            apply_url = (item.get("url") or item.get("jobUrl") or "").strip()

            jobs.append(
                JobItem(
                    source=self.name,
                    country="",
                    title=title,
                    company=company,
                    location=location,
                    description_snippet=(item.get("jobExcerpt") or item.get("jobDescription") or "")[:240],
                    job_url=apply_url,
                    apply_url=apply_url,
                    posted_at=item.get("pubDate"),
                    ats=None,
                )
            )
            if len(jobs) >= limit:
                break

        return ProviderResult(provider=self.name, jobs=jobs)