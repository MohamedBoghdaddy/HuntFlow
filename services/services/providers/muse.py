from __future__ import annotations

import httpx
from typing import Optional

from .base import JobProvider, ProviderResult
from ...responses.jobs import JobItem
from ...core.config import settings


class MuseProvider(JobProvider):
    name = "muse"

    async def search(self, query: str, limit: int = 50, where: Optional[str] = None) -> ProviderResult:
        # The Muse API requires page param, 20 results per page
        base_url = "https://www.themuse.com/api/public/jobs"

        api_key = getattr(settings, "THEMUSE_API_KEY", None) or getattr(settings, "MUSE_API_KEY", None)
        # api_key is optional for testing, but recommended for higher rate limits

        per_page = 20
        pages = max(1, (min(limit, 200) + per_page - 1) // per_page)

        jobs: list[JobItem] = []
        try:
            async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_S) as client:
                for page in range(pages):
                    params = {
                        "page": page,
                    }
                    # The Muse supports filters like: company, category, level, location
                    # But it doesn’t have a generic “search” param in the same way.
                    # We fetch and then filter locally by query.
                    if where:
                        params["location"] = where
                    if api_key:
                        params["api_key"] = api_key

                    r = await client.get(base_url, params=params)
                    r.raise_for_status()
                    data = r.json()
                    results = data.get("results") or []

                    for item in results:
                        title = (item.get("name") or "").strip()
                        company = ((item.get("company") or {}).get("name") or "").strip()

                        # Local query filter (since API isn’t a full text search)
                        if query and query.lower() not in f"{title} {company}".lower():
                            continue

                        # Locations
                        locs = item.get("locations") or []
                        location = ", ".join([(x.get("name") or "").strip() for x in locs if x.get("name")]) or "Remote"

                        # Apply / job URL
                        job_url = (item.get("refs") or {}).get("landing_page") or ""
                        job_url = job_url.strip()

                        # Short snippet
                        contents = (item.get("contents") or "")
                        snippet = " ".join(contents.split())[:240]

                        jobs.append(
                            JobItem(
                                source=self.name,
                                country="",
                                title=title,
                                company=company,
                                location=location,
                                description_snippet=snippet,
                                job_url=job_url,
                                apply_url=job_url,
                                posted_at=None,
                                ats=None,
                            )
                        )

                        if len(jobs) >= limit:
                            break

                    if len(jobs) >= limit:
                        break

            return ProviderResult(provider=self.name, jobs=jobs[:limit])
        except Exception as e:
            return ProviderResult(provider=self.name, jobs=[], error=str(e))