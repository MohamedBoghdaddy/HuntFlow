from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException
from typing import List

from core.config import settings
from requests.jobs import JobSearchRequest, JobExtractRequest
from responses.jobs import JobSearchResponse, JobExtractedResponse, JobItem
from services.adzuna_client import AdzunaClient
from services.job_url_extractor import extract_job


router = APIRouter(prefix="/jobs", tags=["jobs"])

COUNTRY_MAP = {
    "eg": ["eg"],
    "ae": ["ae"],
    "sa": ["sa"],
    "eu": settings.eu_country_list,
}


@router.post("/search", response_model=JobSearchResponse)
async def search_jobs(payload: JobSearchRequest) -> JobSearchResponse:
    client = AdzunaClient()

    countries_expanded: List[str] = []
    for token in payload.countries:
        countries_expanded.extend(COUNTRY_MAP.get(token, []))

    if not countries_expanded:
        raise HTTPException(status_code=400, detail="No valid countries provided")

    jobs: List[JobItem] = []
    per_country_limit = settings.MAX_JOBS_PER_COUNTRY

    for country in countries_expanded:
        for page in range(1, payload.pages + 1):
            try:
                chunk = await client.search(
                    country_code=country,
                    query=payload.query,
                    page=page,
                    results_per_page=payload.results_per_page,
                    where=payload.where,
                    sort_by=payload.sort_by,
                    max_days_old=payload.max_days_old,
                    job_types=payload.job_types,
                    salary_min=payload.salary_min,
                    salary_max=payload.salary_max,
                    remote_only=payload.remote_only,
                )
                jobs.extend(chunk)

                if len(jobs) >= per_country_limit * len(countries_expanded):
                    break
            except httpx.HTTPStatusError:
                continue

    return JobSearchResponse(
        query=payload.query,
        countries=countries_expanded,
        count=len(jobs),
        jobs=jobs,
    )


@router.post("/extract", response_model=JobExtractedResponse)
async def extract_apply_links(payload: JobExtractRequest) -> JobExtractedResponse:
    out: List[JobItem] = []
    for u in payload.urls:
        try:
            out.append(await extract_job(u))
        except Exception:
            out.append(
                JobItem(
                    source="url",
                    country="",
                    title="",
                    company="",
                    location="",
                    description_snippet="",
                    job_url=u,
                    apply_url="",
                    posted_at=None,
                )
            )
    return JobExtractedResponse(count=len(out), jobs=out)