from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from prompt_builder import build_cv_analysis_prompt, build_chat_prompt
from gemini_service import call_gemini, safe_parse_analysis, safe_parse_chat

app = FastAPI()

class AnalyzeCvRequest(BaseModel):
    profile: Optional[Dict[str, Any]] = None
    cv_text: str

class CareerChatRequest(BaseModel):
    profile: Optional[Dict[str, Any]] = None
    cv_analysis: Optional[Dict[str, Any]] = None
    history: List[Dict[str, str]] = []
    message: str

@app.get("/")
def root():
    return {"status": "ok", "service": "career-coach-ai"}

@app.post("/analyze-cv")
def analyze_cv(payload: AnalyzeCvRequest):
    prompt = build_cv_analysis_prompt(payload.profile or {}, payload.cv_text)
    raw = call_gemini(prompt)
    parsed = safe_parse_analysis(raw)
    return parsed

@app.post("/career-chat")
def career_chat(payload: CareerChatRequest):
    prompt = build_chat_prompt(
        payload.profile or {},
        payload.cv_analysis or {},
        payload.history,
        payload.message,
    )
    raw = call_gemini(prompt)
    parsed = safe_parse_chat(raw)
    return parsed