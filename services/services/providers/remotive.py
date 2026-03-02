from __future__ import annotations

import httpx
from typing import Optional

from .base import JobProvider, ProviderResult
from ...responses.jobs import JobItem
from ...core.config import settings


class RemotiveProvider(JobProvider):
    name = "remotive"

    async def search(self, query: str, limit: int = 50, where: Optional[str] = None) -> ProviderResult:
        url = "https://remotive.io/api/remote-jobs"
        try:
            async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_S) as client:
                r = await client.get(url, params={"search": query})
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            return ProviderResult(provider=self.name, jobs=[], error=str(e))

        jobs: list[JobItem] = []
        for item in (data.get("jobs") or []):
            jobs.append(
                JobItem(
                    source=self.name,
                    country="",
                    title=(item.get("title") or "").strip(),
                    company=(item.get("company_name") or "").strip(),
                    location=(item.get("candidate_required_location") or "Remote").strip(),
                    description_snippet=(item.get("description") or "")[:240],
                    job_url=(item.get("url") or "").strip(),
                    apply_url=(item.get("url") or "").strip(),
                    posted_at=item.get("publication_date"),
                    ats=None,
                )
            )
            if len(jobs) >= limit:
                break

        return ProviderResult(provider=self.name, jobs=jobs)