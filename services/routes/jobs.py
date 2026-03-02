<<<<<<< HEAD
# routes/jobs.py
# Full MVP: merged + enhanced /jobs endpoints
# - Unified router
# - Supports both:
#   1) Multi-provider search via JobSearchEngine (aggregator)
#   2) Adzuna-only search with country expansion + paging
# - Robust validation, dedupe, caps, timeouts
# - Extract apply links from URLs with safe fallbacks

from __future__ import annotations

from typing import Optional, List, Dict, Any, Set, Tuple
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from services.core.config import settings

# Your existing services/engines
from services.engines.job_search_engine import JobSearchEngine
from services.services.adzuna_client import AdzunaClient
from services.services.job_url_extractor import extract_job

# ----------------------------
# Router + engine
# ----------------------------
router = APIRouter(prefix="/jobs", tags=["jobs"])
engine = JobSearchEngine()

# ----------------------------
# Models (merged)
# ----------------------------
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
        # Prefer apply_url if present, else job_url, else title+company+location
        url = (self.apply_url or self.job_url or "").strip().lower()
        if url:
            return url
        return f"{self.title}|{self.company}|{self.location}".strip().lower()


class JobSearchRequest(BaseModel):
    query: str = Field(min_length=2)
    where: Optional[str] = None

    # country tokens: eg, ae, sa, eu, or explicit Adzuna country codes (e.g. gb, us)
    countries: List[str] = Field(default_factory=lambda: ["eg"])

    pages: int = Field(default=1, ge=1, le=10)
    results_per_page: int = Field(default=20, ge=5, le=50)

    # optional filters you already pass through
    sort_by: Optional[str] = None
    max_days_old: Optional[int] = Field(default=None, ge=1, le=365)
    job_types: Optional[List[str]] = None
    salary_min: Optional[int] = Field(default=None, ge=0)
    salary_max: Optional[int] = Field(default=None, ge=0)
    remote_only: bool = False

    @field_validator("countries")
    @classmethod
    def normalize_countries(cls, v: List[str]) -> List[str]:
        out = []
        for c in v or []:
            cc = str(c).strip().lower()
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

    # overall desired final jobs
    limit: int = Field(default=60, ge=5, le=200)

    # best-effort minimum you want back
    min_results: int = Field(default=25, ge=1, le=200)

    # providers by name (whatever your engine supports)
    providers: Optional[List[str]] = None

    # tuning knobs (safe defaults)
    batch_size: int = Field(default=2, ge=1, le=10)
    per_provider_limit: int = Field(default=40, ge=5, le=200)


class JobSearchResponse(BaseModel):
    query: str
    countries: List[str]
    count: int
    jobs: List[JobItem]


class JobExtractRequest(BaseModel):
    urls: List[str] = Field(min_length=1, max_length=200)

    @field_validator("urls")
    @classmethod
    def normalize_urls(cls, v: List[str]) -> List[str]:
        out = []
        for u in v or []:
            s = str(u).strip()
            if s:
                out.append(s)
        if not out:
            raise ValueError("urls cannot be empty")
        return out


class JobExtractedResponse(BaseModel):
    count: int
    jobs: List[JobItem]


# ----------------------------
# Helpers
# ----------------------------
COUNTRY_MAP: Dict[str, List[str]] = {
=======
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
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
    "eg": ["eg"],
    "ae": ["ae"],
    "sa": ["sa"],
    "eu": settings.eu_country_list,
}


<<<<<<< HEAD
def expand_countries(tokens: List[str]) -> List[str]:
    expanded: List[str] = []
    for token in tokens:
        if token in COUNTRY_MAP:
            expanded.extend(COUNTRY_MAP[token])
        else:
            # treat as explicit Adzuna country code
            expanded.append(token)

    # dedupe while preserving order
    seen: Set[str] = set()
    out: List[str] = []
    for c in expanded:
        c = c.strip().lower()
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def dedupe_jobs(jobs: List[JobItem], cap: Optional[int] = None) -> List[JobItem]:
    seen: Set[str] = set()
    out: List[JobItem] = []
    for j in jobs:
        key = j.stable_key
        if key in seen:
            continue
        seen.add(key)
        out.append(j)
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


# ----------------------------
# Endpoints
# ----------------------------

@router.post("/search", response_model=JobSearchResponse)
async def search_jobs(payload: JobSearchRequest) -> JobSearchResponse:
    """
    Adzuna search MVP.
    - Expands tokens: eg/ae/sa/eu, or explicit country codes (us, gb, etc)
    - Paginates and collects jobs with caps
    - Best-effort: skips bad country/page responses
    """
    countries = expand_countries(payload.countries)
    if not countries:
        raise HTTPException(status_code=400, detail="No valid countries provided")

    client = AdzunaClient()

    jobs: List[JobItem] = []
    per_country_limit = settings.MAX_JOBS_PER_COUNTRY

    for country in countries:
        country_jobs: List[JobItem] = []
=======
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
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
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
<<<<<<< HEAD
            except httpx.HTTPStatusError:
                continue
            except httpx.TimeoutException:
                continue
            except Exception:
                continue

            # coerce to JobItem if client returns dicts
            for item in chunk or []:
                country_jobs.append(item if isinstance(item, JobItem) else JobItem(**item))

            # cap per country to keep responses fast and predictable
            if len(country_jobs) >= per_country_limit:
                break

        jobs.extend(dedupe_jobs(country_jobs, cap=per_country_limit))

    # overall dedupe and cap
    jobs = dedupe_jobs(jobs, cap=per_country_limit * len(countries))

    return JobSearchResponse(
        query=payload.query,
        countries=countries,
=======
                jobs.extend(chunk)

                if len(jobs) >= per_country_limit * len(countries_expanded):
                    break
            except httpx.HTTPStatusError:
                continue

    return JobSearchResponse(
        query=payload.query,
        countries=countries_expanded,
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
        count=len(jobs),
        jobs=jobs,
    )


<<<<<<< HEAD
@router.post("/multi-search")
async def multi_source_search(payload: MultiSourceSearchRequest):
    """
    Aggregated multi-provider search via your JobSearchEngine.
    Returns whatever your engine returns (kept untyped for flexibility).
    """
    try:
        return await engine.search(
            query=payload.query,
            where=payload.where,
            limit=payload.limit,
            min_results=payload.min_results,
            providers=payload.providers,
            batch_size=payload.batch_size,
            per_provider_limit=payload.per_provider_limit,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multi-source search failed: {e}")


@router.post("/extract", response_model=JobExtractedResponse)
async def extract_apply_links(payload: JobExtractRequest) -> JobExtractedResponse:
    """
    Extract apply links (best-effort).
    - Never fails the whole batch if one URL fails
    - Returns placeholders on failures
    """
    out: List[JobItem] = []
    for u in payload.urls:
        try:
            item = await extract_job(u)
            out.append(item if isinstance(item, JobItem) else JobItem(**item))
        except Exception:
            out.append(safe_job_fallback(u))

    out = dedupe_jobs(out, cap=200)
=======
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
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
    return JobExtractedResponse(count=len(out), jobs=out)