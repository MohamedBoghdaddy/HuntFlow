from __future__ import annotations

import httpx
from typing import Optional

from .base import JobProvider, ProviderResult
from ...responses.jobs import JobItem
from ...core.config import settings


class USAJobsProvider(JobProvider):
    name = "usajobs"

    async def search(self, query: str, limit: int = 50, where: Optional[str] = None) -> ProviderResult:
        # Requires API key for higher reliability, but endpoint works with headers.
        url = "https://data.usajobs.gov/api/search"
        headers = {
            "User-Agent": "HuntFlow/1.0",
            "Authorization-Key": getattr(settings, "USAJOBS_API_KEY", "") or "",
        }
        params = {"Keyword": query}
        if where:
            params["LocationName"] = where

        try:
            async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_S, headers=headers) as client:
                r = await client.get(url, params=params)
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            return ProviderResult(provider=self.name, jobs=[], error=str(e))

        jobs: list[JobItem] = []
        items = (
            (((data.get("SearchResult") or {}).get("SearchResultItems")) or [])
        )
        for wrapper in items:
            item = (wrapper.get("MatchedObjectDescriptor") or {})
            title = (item.get("PositionTitle") or "").strip()
            org = (item.get("OrganizationName") or "").strip()
            locs = item.get("PositionLocation") or []
            location = (locs[0].get("LocationName") if locs else "USA").strip()
            apply_url = (item.get("PositionURI") or "").strip()

            jobs.append(
                JobItem(
                    source=self.name,
                    country="us",
                    title=title,
                    company=org,
                    location=location,
                    description_snippet=(item.get("UserArea", {}).get("Details", {}).get("JobSummary") or "")[:240],
                    job_url=apply_url,
                    apply_url=apply_url,
                    posted_at=item.get("PublicationStartDate"),
                    ats=None,
                )
            )
            if len(jobs) >= limit:
                break

        return ProviderResult(provider=self.name, jobs=jobs)