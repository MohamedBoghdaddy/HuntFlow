from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel
from services.engines.cv_engine import CVEngine
from services.requests.cv import (
    ATSScoreRequest,
    EnhanceCVRequest,
    ResumeBuildRequest,
    CareerCoachRequest,
)
from services.responses.cv import JSONResponse, TextResponse

router = APIRouter(prefix="/cv", tags=["cv"])
engine = CVEngine()


@router.post("/ats-score", response_model=JSONResponse)
def ats_score(payload: ATSScoreRequest) -> JSONResponse:
    data = engine.ats_score(payload.cv_text, payload.job_description)
    return JSONResponse(data=data)


@router.post("/enhance", response_model=JSONResponse)
def enhance(payload: EnhanceCVRequest) -> JSONResponse:
    data = engine.enhance_cv(payload.cv_text, payload.job_description)
    return JSONResponse(data=data)


@router.post("/resume", response_model=JSONResponse)
def resume(payload: ResumeBuildRequest) -> JSONResponse:
    data = engine.build_resume(
        payload.user_profile,
        payload.target_role,
        payload.target_market,
    )
    return JSONResponse(data=data)


@router.post("/coach", response_model=TextResponse)
def coach(payload: CareerCoachRequest) -> TextResponse:
    text = engine.career_coach(payload.messages)
    return TextResponse(text=text)


# ---------------------------------------------------------------------------
# Cover Letter
# ---------------------------------------------------------------------------

class CoverLetterRequest(BaseModel):
    cv_text: str
    job_title: str
    company: str
    job_description: str


class CoverLetterResponse(BaseModel):
    cover_letter: str


@router.post("/cover-letter", response_model=CoverLetterResponse)
def cover_letter(payload: CoverLetterRequest) -> CoverLetterResponse:
    text = engine.generate_cover_letter(
        payload.cv_text,
        payload.job_title,
        payload.company,
        payload.job_description,
    )
    return CoverLetterResponse(cover_letter=text)


# ---------------------------------------------------------------------------
# Match Jobs
# ---------------------------------------------------------------------------

class MatchJobsRequest(BaseModel):
    cv_text: str
    jobs: List[Dict[str, Any]]


class MatchJobsResponse(BaseModel):
    jobs: List[Dict[str, Any]]


@router.post("/match-jobs", response_model=MatchJobsResponse)
def match_jobs(payload: MatchJobsRequest) -> MatchJobsResponse:
    scored: List[Dict[str, Any]] = []
    for job in payload.jobs:
        description = job.get("description_snippet") or job.get("description") or ""
        score = engine.match_cv_to_job(payload.cv_text, description)
        enriched = dict(job)
        enriched["match_score"] = round(score, 4)
        enriched["match_percent"] = int(round(score * 100))
        scored.append(enriched)

    scored.sort(key=lambda j: j["match_score"], reverse=True)
    return MatchJobsResponse(jobs=scored)