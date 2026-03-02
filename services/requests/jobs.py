from __future__ import annotations

from typing import List, Optional, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from engines.job_search_engine import JobSearchEngine
from ..responses.jobs import JobItem

# ----------------------------------------------------------------------
# Existing models and endpoints (multi‑source search)
# ----------------------------------------------------------------------

router = APIRouter(prefix="/jobs", tags=["jobs"])
engine = JobSearchEngine()


class MultiSourceSearchRequest(BaseModel):
    query: str = Field(min_length=2)
    where: Optional[str] = None
    limit: int = Field(default=60, ge=5, le=200)
    min_results: int = Field(default=25, ge=1, le=200)
    providers: Optional[List[str]] = None  # if passed, forces these sources only


@router.post("/search")
async def multi_source_search(payload: MultiSourceSearchRequest):
    return await engine.search(
        query=payload.query,
        where=payload.where,
        limit=payload.limit,
        min_results=payload.min_results,
        providers=payload.providers,
        batch_size=2,
        per_provider_limit=40,
    )


# ----------------------------------------------------------------------
# Additional models (can be used for other endpoints, e.g. advanced search)
# ----------------------------------------------------------------------

CountryToken = Literal["eg", "ae", "sa", "eu"]
SortBy = Literal["relevance", "date"]
JobType = Literal["full_time", "part_time", "contract", "permanent", "internship"]


class JobSearchRequest(BaseModel):
    query: str = Field(min_length=2)
    countries: List[CountryToken] = Field(default_factory=lambda: ["eg", "ae", "sa", "eu"])
    pages: int = Field(default=1, ge=1, le=10)
    results_per_page: int = Field(default=20, ge=5, le=50)
    remote_only: bool = False
    sort_by: SortBy = "relevance"  # maps to Adzuna sort_by
    max_days_old: Optional[int] = Field(default=None, ge=1, le=365)
    job_types: List[JobType] = Field(default_factory=list)
    where: Optional[str] = None
    salary_min: Optional[int] = Field(default=None, ge=0)
    salary_max: Optional[int] = Field(default=None, ge=0)


class JobExtractRequest(BaseModel):
    urls: List[str] = Field(min_length=1, max_length=50)