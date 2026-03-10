from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .gemini_service import call_gemini, safe_parse_analysis, safe_parse_chat
from .prompt_builder import build_chat_prompt, build_cv_analysis_prompt

app = FastAPI(title="HuntFlow Career Coach AI", version="0.1.0")


class AnalyzeCvRequest(BaseModel):
    profile: Optional[Dict[str, Any]] = None
    cv_text: str = Field(min_length=1)


class CareerChatRequest(BaseModel):
    profile: Optional[Dict[str, Any]] = None
    cv_analysis: Optional[Dict[str, Any]] = None
    history: List[Dict[str, str]] = Field(default_factory=list)
    message: str = Field(min_length=1)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "career-coach-ai"}


@app.post("/analyze-cv")
def analyze_cv(payload: AnalyzeCvRequest):
    try:
        prompt = build_cv_analysis_prompt(payload.profile or {}, payload.cv_text)
        raw = call_gemini(prompt)
        return safe_parse_analysis(raw)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"CV analysis failed: {exc}") from exc


@app.post("/career-chat")
def career_chat(payload: CareerChatRequest):
    try:
        prompt = build_chat_prompt(
            payload.profile or {},
            payload.cv_analysis or {},
            payload.history,
            payload.message,
        )
        raw = call_gemini(prompt)
        return safe_parse_chat(raw)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Career chat failed: {exc}") from exc