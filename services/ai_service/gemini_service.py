import json
from typing import Any, Dict

from google import genai

from services.core.config import settings


def _get_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def call_gemini(prompt: str) -> str:
    client = _get_client()
    response = client.models.generate_content(
        model=settings.GEMINI_MODEL_TEXT,
        contents=prompt,
    )
    return (getattr(response, "text", "") or "").strip()


def _safe_load_json(text: str) -> Dict[str, Any]:
    raw = (text or "").strip()
    for candidate in (raw, raw.replace("```json", "").replace("```", "").strip()):
        try:
            return json.loads(candidate)
        except Exception:
            continue
    return {}


def safe_parse_analysis(text: str) -> Dict[str, Any]:
    parsed = _safe_load_json(text)
    if parsed:
        return parsed
    return {
        "strengths": [],
        "weaknesses": [],
        "missingSkills": [],
        "recommendedRoles": [],
        "rewriteSuggestions": [],
        "atsScore": 65,
        "summary": text,
    }


def safe_parse_chat(text: str) -> Dict[str, Any]:
    parsed = _safe_load_json(text)
    if parsed:
        return parsed
    return {
        "reply": text,
        "suggestions": [
            "Improve your CV summary",
            "Ask for interview preparation",
            "Ask for a weekly roadmap",
        ],
    }