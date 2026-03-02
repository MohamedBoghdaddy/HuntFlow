from __future__ import annotations

import httpx
from typing import Optional

from .base import JobProvider, ProviderResult
from ...responses.jobs import JobItem
from ...core.config import settings


class ArbeitnowProvider(JobProvider):
    name = "arbeitnow"

    async def search(self, query: str, limit: int = 50, where: Optional[str] = None) -> ProviderResult:
        url = "https://www.arbeitnow.com/api/job-board-api"
        try:
            async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_S) as client:
                r = await client.get(url)
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            return ProviderResult(provider=self.name, jobs=[], error=str(e))

        jobs: list[JobItem] = []
        for item in (data.get("data") or []):
            title = (item.get("title") or "").strip()
            company = (item.get("company_name") or "").strip()
            location = (item.get("location") or "").strip()
            apply_url = (item.get("url") or "").strip()

            if query and query.lower() not in f"{title} {company}".lower():
                continue

            jobs.append(
                JobItem(
                    source=self.name,
                    country="",
                    title=title,
                    company=company,
                    location=location,
                    description_snippet=(item.get("description") or "")[:240],
                    job_url=apply_url,
                    apply_url=apply_url,
                    posted_at=item.get("created_at"),
                    ats=None,
                )
            )
            if len(jobs) >= limit:
                break

        return ProviderResult(provider=self.name, jobs=jobs)