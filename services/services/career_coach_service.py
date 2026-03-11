from __future__ import annotations

import logging
from typing import List, Dict, Any

from google import genai

from services.core.config import settings
from services.engines.career_coach_engine import (
    CareerCoachEngine,
    CareerCoachRequest,
    CareerCoachResponse,
)
from services.prompts.career_coach_prompt import (
    CAREER_COACH_SYSTEM_PROMPT,
    build_career_coach_user_prompt,
)

logger = logging.getLogger(__name__)


class CareerCoachService:
    def __init__(self) -> None:
        # Gemini SDK reads GEMINI_API_KEY automatically if set in env,
        # but passing explicitly is also fine.
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")

    def _normalize_history(self, history: List[Dict[str, Any]]) -> str:
        """
        Gemini generate_content is easiest to keep stable here by folding
        lightweight chat history into plain text context.
        """
        parts: List[str] = []

        for item in history[-10:]:
            role = item.get("role", "user")
            content = item.get("content", "")
            if not isinstance(content, str) or not content.strip():
                continue

            if role not in {"system", "user", "assistant"}:
                role = "user"

            parts.append(f"{role.upper()}: {content.strip()}")

        return "\n\n".join(parts).strip()

    def _safe_refusal_if_needed(self, flags: List[str]) -> str | None:
        if not flags:
            return None

        return (
            "I can’t help with misleading or dishonest job-search tactics such as "
            "faking experience or certifications. I can help you present your real "
            "strengths better, reframe transferable skills, and build a truthful plan "
            "to become more competitive."
        )

    def generate(self, payload: CareerCoachRequest) -> CareerCoachResponse:
        assumptions = CareerCoachEngine.derive_assumptions(payload)
        safety_flags = CareerCoachEngine.detect_safety_flags(payload)

        refusal = self._safe_refusal_if_needed(safety_flags)
        if refusal:
            return CareerCoachResponse(
                success=True,
                coach_response=refusal,
                model="guardrail-local",
                assumptions=assumptions,
                safety_flags=safety_flags,
            )

        history_text = self._normalize_history(payload.conversation_history)

        user_prompt = build_career_coach_user_prompt(
            message=payload.message,
            profile_summary=payload.profile_summary,
            resume_text=payload.resume_text,
            target_role=payload.target_role,
            target_industry=payload.target_industry,
            target_location=payload.target_location,
            job_description=payload.job_description,
        )

        combined_prompt = f"""
{CAREER_COACH_SYSTEM_PROMPT}

Conversation history:
{history_text or "No prior conversation history."}

Current request:
{user_prompt}
""".strip()

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=combined_prompt,
            )

            content = (response.text or "").strip()
            if not content:
                raise ValueError("Empty Gemini response from career coach.")

            return CareerCoachResponse(
                success=True,
                coach_response=content,
                model=self.model,
                assumptions=assumptions,
                safety_flags=safety_flags,
            )

        except Exception as exc:
            logger.exception("CareerCoachService.generate failed: %s", exc)

            fallback = (
                "I couldn’t generate the full coaching response right now. "
                "Based on what you shared, the safest next move is to clarify your target role, "
                "match your strongest relevant skills to it, and tailor your resume bullets to measurable outcomes."
            )

            return CareerCoachResponse(
                success=False,
                coach_response=fallback,
                model=self.model,
                assumptions=assumptions,
                safety_flags=safety_flags + [f"runtime_error:{type(exc).__name__}"],
            )