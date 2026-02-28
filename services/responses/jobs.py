from pydantic import BaseModel
from typing import Optional, List


class JobItem(BaseModel):
    source: str
    country: str
    title: str
    company: str
    location: str
    description_snippet: str = ""
    job_url: str = ""
    apply_url: str = ""
    posted_at: Optional[str] = None


class JobSearchResponse(BaseModel):
    query: str
    countries: List[str]
    count: int
    jobs: List[JobItem]


class JobExtractedResponse(BaseModel):
    count: int
    jobs: List[JobItem]