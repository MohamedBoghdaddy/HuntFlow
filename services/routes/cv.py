from fastapi import APIRouter
from engines.cv_engine import CVEngine
from requests.cv import ATSScoreRequest, EnhanceCVRequest, ResumeBuildRequest, CareerCoachRequest
from responses.cv import JSONResponse, TextResponse


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
    data = engine.build_resume(payload.user_profile, payload.target_role, payload.target_market)
    return JSONResponse(data=data)


@router.post("/coach", response_model=TextResponse)
def coach(payload: CareerCoachRequest) -> TextResponse:
    text = engine.career_coach(payload.messages)
    return TextResponse(text=text)