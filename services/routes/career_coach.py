from __future__ import annotations

from fastapi import APIRouter, HTTPException

from services.engines.career_coach_engine import CareerCoachRequest, CareerCoachResponse
from services.services.career_coach_service import CareerCoachService

router = APIRouter(tags=["career-coach"])

career_coach_service = CareerCoachService()


@router.post("/career-chat", response_model=CareerCoachResponse)
async def career_coach_chat(payload: CareerCoachRequest) -> CareerCoachResponse:
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="message is required")

    return career_coach_service.generate(payload)


@router.get("/career-chat/health")
async def career_coach_health():
    return {
        "ok": True,
        "service": "career-coach",
    }