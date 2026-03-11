from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class CareerCoachRequest(BaseModel):
    message: str = Field(..., min_length=3, max_length=4000)
    profile_summary: Optional[str] = Field(default=None, max_length=12000)
    resume_text: Optional[str] = Field(default=None, max_length=50000)
    target_role: Optional[str] = Field(default=None, max_length=300)
    target_industry: Optional[str] = Field(default=None, max_length=300)
    target_location: Optional[str] = Field(default=None, max_length=300)
    job_description: Optional[str] = Field(default=None, max_length=20000)
    conversation_history: List[dict] = Field(default_factory=list)


class CareerCoachResponse(BaseModel):
    success: bool = True
    coach_response: str
    model: str
    assumptions: List[str] = Field(default_factory=list)
    safety_flags: List[str] = Field(default_factory=list)


class CareerCoachEngine:
    """
    Thin orchestration layer for validation, assumptions,
    and response shaping before/after the LLM call.
    """

    @staticmethod
    def derive_assumptions(payload: CareerCoachRequest) -> List[str]:
        assumptions: List[str] = []

        if not payload.target_role:
            assumptions.append("Target role was not provided, so advice is generalized.")
        if not payload.resume_text and not payload.profile_summary:
            assumptions.append("No resume or profile summary was provided, so advice is based only on the user message.")
        if not payload.job_description:
            assumptions.append("No job description was provided, so fit and application advice is broad rather than job-specific.")

        return assumptions

    @staticmethod
    def detect_safety_flags(payload: CareerCoachRequest) -> List[str]:
        text = " ".join(
            filter(
                None,
                [
                    payload.message,
                    payload.profile_summary,
                    payload.resume_text,
                    payload.job_description,
                ],
            )
        ).lower()

        flags: List[str] = []

        risky_keywords = [
            "lie on my resume",
            "fake experience",
            "fake certification",
            "cheat interview",
            "impersonate",
            "forge",
            "illegal",
        ]

        for keyword in risky_keywords:
            if keyword in text:
                flags.append(keyword)

        return flags