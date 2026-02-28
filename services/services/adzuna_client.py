from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import re

import httpx

from core.config import settings
from responses.jobs import JobItem


ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs"


def _snip(text: str, n: int = 240) -> str:
    text = re.sub(r"\s+", " ", (text or "")).strip()
    return text[:n]


def _to_01(x: bool) -> int:
    return 1 if x else 0


@dataclass
class AdzunaClient:
    timeout_s: int = settings.REQUEST_TIMEOUT_S

    async def search(
        self,
        country_code: str,
        query: str,
        page: int,
        results_per_page: int,
        where: Optional[str] = None,
        sort_by: str = "relevance",
        max_days_old: Optional[int] = None,
        job_types: Optional[List[str]] = None,
        salary_min: Optional[int] = None,
        salary_max: Optional[int] = None,
        remote_only: bool = False,
    ) -> List[JobItem]:
        if not settings.ADZUNA_APP_ID or not settings.ADZUNA_APP_KEY:
            raise RuntimeError("Missing ADZUNA_APP_ID or ADZUNA_APP_KEY")

        # Build query modifiers
        q = (query or "").strip()
        if remote_only and "remote" not in q.lower():
            q = f"{q} remote".strip()

        # "internship" is not a native Adzuna boolean in all markets
        # we treat it as a keyword modifier so it works everywhere
        jt = set(job_types or [])
        if "internship" in jt and not re.search(r"\b(intern|internship|trainee)\b", q, re.I):
            q = f"{q} internship".strip()

        url = f"{ADZUNA_BASE}/{country_code}/search/{page}"

        params: Dict[str, Any] = {
            "app_id": settings.ADZUNA_APP_ID,
            "app_key": settings.ADZUNA_APP_KEY,
            "results_per_page": results_per_page,
            "what": q,
            "content-type": "application/json",
        }

        if where:
            params["where"] = where.strip()

        if sort_by in {"relevance", "date"}:
            params["sort_by"] = sort_by

        if max_days_old:
            params["max_days_old"] = max_days_old

        if salary_min is not None:
            params["salary_min"] = salary_min

        if salary_max is not None:
            params["salary_max"] = salary_max

        # Job type flags (supported by Adzuna in many markets)
        # If a market ignores one, it will just behave like no filter
        params["full_time"] = _to_01("full_time" in jt)
        params["part_time"] = _to_01("part_time" in jt)
        params["contract"] = _to_01("contract" in jt)
        params["permanent"] = _to_01("permanent" in jt)

        headers = {"User-Agent": "HuntFlow/1.0", "Accept": "application/json"}

        async with httpx.AsyncClient(timeout=self.timeout_s, headers=headers, follow_redirects=True) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data: Dict[str, Any] = r.json()

        jobs: List[JobItem] = []
        for item in (data.get("results") or []):
            title = (item.get("title") or "").strip()
            company = ""
            if isinstance(item.get("company"), dict):
                company = (item["company"].get("display_name") or "").strip()

            location = ""
            if isinstance(item.get("location"), dict):
                location = (item["location"].get("display_name") or "").strip()

            redirect_url = (item.get("redirect_url") or "").strip()
            created = (item.get("created") or "").strip()
            desc = _snip(item.get("description") or "")

            jobs.append(
                JobItem(
                    source="adzuna",
                    country=country_code,
                    title=title,
                    company=company,
                    location=location,
                    description_snippet=desc,
                    job_url=redirect_url,
                    apply_url=redirect_url,
                    posted_at=created or None,
                )
            )

        return jobs