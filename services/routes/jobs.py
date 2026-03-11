"""
routes/jobs.py

Changes:
  - /search checks the 1-hour job cache before hitting Adzuna
  - /multi-search uses JobSearchEngine with built-in ROI order + cache
  - /extract supports safe fallback per URL
  - cache admin endpoints added
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from services.core.config import settings
from services.engines.job_search_engine import JobSearchEngine
from services.services.adzuna_client import AdzunaClient
from services.services.job_url_extractor import extract_job
from services.utils.job_cache import get_default_cache

log = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])
engine = JobSearchEngine()
_cache = get_default_cache()


class JobItem(BaseModel):
    source: str = "unknown"
    country: str = ""
    title: str = ""
    company: str = ""
    location: str = ""
    description_snippet: str = ""
    job_url: str = ""
    apply_url: str = ""
    posted_at: Optional[datetime] = None

    @property
    def stable_key(self) -> str:
        url = (self.apply_url or self.job_url or "").strip().lower()
        if url:
            return url
        return f"{self.title}|{self.company}|{self.location}".strip().lower()


class JobSearchRequest(BaseModel):
    query: str = Field(min_length=2)
    where: Optional[str] = None
    countries: List[str] = Field(default_factory=lambda: ["eg"])
    pages: int = Field(default=1, ge=1, le=10)
    results_per_page: int = Field(default=20, ge=5, le=50)
    sort_by: Optional[str] = None
    max_days_old: Optional[int] = Field(default=None, ge=1, le=365)
    job_types: Optional[List[str]] = None
    salary_min: Optional[int] = Field(default=None, ge=0)
    salary_max: Optional[int] = Field(default=None, ge=0)
    remote_only: bool = False

    @field_validator("countries")
    @classmethod
    def normalize_countries(cls, value: List[str]) -> List[str]:
        out: List[str] = []
        for country in value or []:
            cc = str(country).strip().lower()
            if cc:
                out.append(cc)
        return out or ["eg"]

    @model_validator(mode="after")
    def salary_range_ok(self):
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                raise ValueError("salary_min cannot be greater than salary_max")
        return self


class MultiSourceSearchRequest(BaseModel):
    query: str = Field(min_length=2)
    where: Optional[str] = None
    limit: int = Field(default=60, ge=5, le=200)
    min_results: int = Field(default=25, ge=1, le=200)
    providers: Optional[List[str]] = None
    batch_size: int = Field(default=3, ge=1, le=10)
    per_provider_limit: int = Field(default=40, ge=5, le=200)


class JobSearchResponse(BaseModel):
    query: str
    countries: List[str]
    count: int
    cached: bool = False
    jobs: List[JobItem]


class JobExtractRequest(BaseModel):
    urls: List[str] = Field(min_length=1, max_length=200)

    @field_validator("urls")
    @classmethod
    def normalize_urls(cls, value: List[str]) -> List[str]:
        out: List[str] = [str(url).strip() for url in (value or []) if str(url).strip()]
        if not out:
            raise ValueError("urls cannot be empty")
        return out


class JobExtractedResponse(BaseModel):
    count: int
    jobs: List[JobItem]


COUNTRY_MAP: Dict[str, List[str]] = {
    "eg": ["eg"],
    "ae": ["ae"],
    "sa": ["sa"],
    "eu": settings.eu_country_list,
}


def expand_countries(tokens: List[str]) -> List[str]:
    expanded: List[str] = []
    for token in tokens:
        normalized = token.strip().lower()
        expanded.extend(COUNTRY_MAP.get(normalized, [normalized]))

    seen: Set[str] = set()
    out: List[str] = []
    for country in expanded:
        if country and country not in seen:
            seen.add(country)
            out.append(country)
    return out


def dedupe_jobs(jobs: List[JobItem], cap: Optional[int] = None) -> List[JobItem]:
    seen: Set[str] = set()
    out: List[JobItem] = []

    for job in jobs:
        key = job.stable_key
        if key in seen:
            continue
        seen.add(key)
        out.append(job)

        if cap is not None and len(out) >= cap:
            break

    return out


def safe_job_fallback(url: str) -> JobItem:
    return JobItem(
        source="url",
        country="",
        title="",
        company="",
        location="",
        description_snippet="",
        job_url=url,
        apply_url="",
        posted_at=None,
    )


def normalize_job_item(item: Any) -> JobItem:
    if isinstance(item, JobItem):
        return item

    if item is None:
        return JobItem()

    if hasattr(item, "model_dump"):
        data = item.model_dump()
        if isinstance(data, dict):
            return JobItem(**data)

    if isinstance(item, dict):
        return JobItem(**item)

    if hasattr(item, "dict"):
        data = item.dict()
        if isinstance(data, dict):
            return JobItem(**data)

    return JobItem(
        source=str(getattr(item, "source", "unknown") or "unknown"),
        country=str(getattr(item, "country", "") or ""),
        title=str(getattr(item, "title", "") or ""),
        company=str(getattr(item, "company", "") or ""),
        location=str(getattr(item, "location", "") or ""),
        description_snippet=str(getattr(item, "description_snippet", "") or ""),
        job_url=str(getattr(item, "job_url", getattr(item, "url", "")) or ""),
        apply_url=str(getattr(item, "apply_url", "") or ""),
        posted_at=getattr(item, "posted_at", None),
    )


@router.post("/search", response_model=JobSearchResponse)
async def search_jobs(payload: JobSearchRequest) -> JobSearchResponse:
    """
    Adzuna-backed search with cache per request fingerprint.
    """
    countries = expand_countries(payload.countries)
    if not countries:
        raise HTTPException(status_code=400, detail="No valid countries provided")

    cache_key_providers = [f"adzuna:{c}" for c in sorted(countries)]
    cached_data = _cache.get(
        query=payload.query,
        where=payload.where,
        providers=cache_key_providers,
    )

    if cached_data is not None:
        log.info("job_cache: /search HIT for query=%r where=%r", payload.query, payload.where)
        jobs = [normalize_job_item(j) for j in cached_data.get("jobs", [])]
        return JobSearchResponse(
            query=payload.query,
            countries=countries,
            count=len(jobs),
            cached=True,
            jobs=jobs,
        )

    client = AdzunaClient()
    jobs: List[JobItem] = []
    per_country_limit = settings.MAX_JOBS_PER_COUNTRY

    for country in countries:
        country_jobs: List[JobItem] = []

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
            except (httpx.HTTPStatusError, httpx.TimeoutException, Exception) as exc:
                log.warning(
                    "adzuna search failed for country=%s query=%r page=%d: %s",
                    country,
                    payload.query,
                    page,
                    exc,
                )
                continue

            for item in chunk or []:
                try:
                    country_jobs.append(normalize_job_item(item))
                except Exception as exc:
                    log.warning("job normalization failed: %s", exc)
                    continue

            if len(country_jobs) >= per_country_limit:
                break

        jobs.extend(dedupe_jobs(country_jobs, cap=per_country_limit))

    jobs = dedupe_jobs(jobs, cap=per_country_limit * len(countries))

    _cache.set(
        query=payload.query,
        where=payload.where,
        providers=cache_key_providers,
        data={"jobs": [j.model_dump() for j in jobs]},
    )

    return JobSearchResponse(
        query=payload.query,
        countries=countries,
        count=len(jobs),
        cached=False,
        jobs=jobs,
    )


@router.post("/multi-search")
async def multi_source_search(payload: MultiSourceSearchRequest):
    """
    Multi-provider search. Cache is handled inside JobSearchEngine.
    """
    try:
        result = await engine.search(
            query=payload.query,
            where=payload.where,
            limit=payload.limit,
            min_results=payload.min_results,
            providers=payload.providers,
            batch_size=payload.batch_size,
            per_provider_limit=payload.per_provider_limit,
        )
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Multi-source search failed: {exc}",
        ) from exc


@router.post("/extract", response_model=JobExtractedResponse)
async def extract_apply_links(payload: JobExtractRequest) -> JobExtractedResponse:
    out: List[JobItem] = []

    for url in payload.urls:
        try:
            item = await extract_job(url)
            out.append(normalize_job_item(item))
        except Exception:
            out.append(safe_job_fallback(url))

    out = dedupe_jobs(out, cap=200)
    return JobExtractedResponse(count=len(out), jobs=out)


@router.delete("/cache")
async def clear_job_cache():
    removed = _cache.clear_all()
    return {"removed": removed}


@router.post("/cache/prune")
async def prune_expired_cache():
    pruned = _cache.prune_expired()
    return {"pruned": pruned}