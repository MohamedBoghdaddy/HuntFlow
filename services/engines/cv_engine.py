from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from core.config import settings
from engines.gemini_client import get_gemini_client


PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")


def _must_json(text: str) -> Dict[str, Any]:
    text = (text or "").strip()
    try:
        return json.loads(text)
    except Exception:
        # common model mistake: wraps in markdown fences
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)


class CVEngine:
    def __init__(self) -> None:
        self.client = get_gemini_client()
        self.model = settings.GEMINI_MODEL_TEXT

    def ats_score(self, cv_text: str, job_description: str) -> Dict[str, Any]:
        prompt = _load_prompt("ats_score.txt")
        contents = f"{prompt}\n\nCV_TEXT:\n{cv_text}\n\nJOB_DESCRIPTION:\n{job_description}"
        resp = self.client.models.generate_content(model=self.model, contents=contents)
        return _must_json(resp.text)

    def enhance_cv(self, cv_text: str, job_description: str) -> Dict[str, Any]:
        prompt = _load_prompt("enhance_cv.txt")
        contents = f"{prompt}\n\nCV_TEXT:\n{cv_text}\n\nJOB_DESCRIPTION:\n{job_description}"
        resp = self.client.models.generate_content(model=self.model, contents=contents)
        return _must_json(resp.text)

    def build_resume(self, user_profile: str, target_role: str, target_market: str) -> Dict[str, Any]:
        prompt = _load_prompt("resume_builder.txt")
        contents = f"{prompt}\n\nUSER_PROFILE:\n{user_profile}\n\nTARGET_ROLE:\n{target_role}\n\nTARGET_MARKET:\n{target_market}"
        resp = self.client.models.generate_content(model=self.model, contents=contents)
        return _must_json(resp.text)

    def career_coach(self, messages: List[Dict[str, str]]) -> str:
        prompt = _load_prompt("career_coach.txt")
        chat_blob = "\n".join([f'{m["role"].upper()}: {m["content"]}' for m in messages])
        contents = f"{prompt}\n\n{chat_blob}"
        resp = self.client.models.generate_content(model=self.model, contents=contents)
        return (resp.text or "").strip()