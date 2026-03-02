from __future__ import annotations

import httpx
from typing import Optional

from .base import JobProvider, ProviderResult
from ...responses.jobs import JobItem
from ...core.config import settings


class RemoteOKProvider(JobProvider):
    name = "remoteok"

    async def search(self, query: str, limit: int = 50, where: Optional[str] = None) -> ProviderResult:
        url = "https://remoteok.com/api"
        try:
            async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_S, headers={"User-Agent": "HuntFlow/1.0"}) as client:
                r = await client.get(url)
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            return ProviderResult(provider=self.name, jobs=[], error=str(e))

        jobs: list[JobItem] = []
        for item in data[1:]:  # first entry is metadata
            title = (item.get("position") or "").strip()
            company = (item.get("company") or "").strip()
            tags = " ".join(item.get("tags") or [])
            if query and query.lower() not in f"{title} {company} {tags}".lower():
                continue

            apply_url = (item.get("apply_url") or item.get("url") or "").strip()
            jobs.append(
                JobItem(
                    source=self.name,
                    country="",
                    title=title,
                    company=company,
                    location=(item.get("location") or "Remote").strip(),
                    description_snippet=(item.get("description") or "")[:240],
                    job_url=apply_url,
                    apply_url=apply_url,
                    posted_at=str(item.get("date")) if item.get("date") else None,
                    ats=None,
                )
            )
            if len(jobs) >= limit:
                break

        return ProviderResult(provider=self.name, jobs=jobs)