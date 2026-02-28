from pydantic import BaseModel, Field
from typing import List, Optional, Literal

CountryToken = Literal["eg", "ae", "sa", "eu"]
SortBy = Literal["relevance", "date"]

JobType = Literal["full_time", "part_time", "contract", "permanent", "internship"]


class JobSearchRequest(BaseModel):
    query: str = Field(min_length=2)
    countries: List[CountryToken] = Field(default_factory=lambda: ["eg", "ae", "sa", "eu"])

    pages: int = Field(default=1, ge=1, le=10)
    results_per_page: int = Field(default=20, ge=5, le=50)

    remote_only: bool = False

    # Filters
    sort_by: SortBy = "relevance"              # maps to Adzuna sort_by
    max_days_old: Optional[int] = Field(default=None, ge=1, le=365)  # past 1, 7, 30, etc

    job_types: List[JobType] = Field(default_factory=list)  # full_time, part_time, contract, permanent, internship
    where: Optional[str] = None                              # city or area text
    salary_min: Optional[int] = Field(default=None, ge=0)
    salary_max: Optional[int] = Field(default=None, ge=0)


class JobExtractRequest(BaseModel):
    urls: List[str] = Field(min_length=1, max_length=50)