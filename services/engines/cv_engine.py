"""
CV Engine Module
================
Provides AI-powered CV analysis, enhancement, and job matching using Google Gemini.

Supports:
- ATS scoring (prompt-based)
- CV enhancement for specific job descriptions
- Resume building from user profile
- Career coaching chat
- Embedding-based similarity scoring (with optional caching)
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from services.core.config import settings
from services.engines.gemini_client import get_gemini_client

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"
DEFAULT_CV_EMBEDDING_CACHE = Path("cv_embedding.pkl")  # fallback if not in settings


def _load_prompt(name: str) -> str:
    """Load a prompt template from the prompts directory."""
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")


def _must_json(text: str) -> Dict[str, Any]:
    """Parse JSON from Gemini response, cleaning markdown fences if needed."""
    text = (text or "").strip()
    try:
        return json.loads(text)
    except Exception:
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)


class CVEngine:
    """Unified engine for CV/job operations using Gemini models."""

    def __init__(self) -> None:
        self.client = get_gemini_client()
        self.model = settings.GEMINI_MODEL_TEXT

    # ------------------------------------------------------------------
    # Prompt-based methods (use Gemini generative model)
    # ------------------------------------------------------------------
    def ats_score(self, cv_text: str, job_description: str) -> Dict[str, Any]:
        """Score a CV against a job description using an ATS-like prompt."""
        prompt = _load_prompt("ats_score.txt")
        contents = f"{prompt}\n\nCV_TEXT:\n{cv_text}\n\nJOB_DESCRIPTION:\n{job_description}"
        resp = self.client.models.generate_content(model=self.model, contents=contents)
        return _must_json(resp.text)

    def enhance_cv(self, cv_text: str, job_description: str) -> Dict[str, Any]:
        """Suggest improvements to a CV tailored to a specific job description."""
        prompt = _load_prompt("enhance_cv.txt")
        contents = f"{prompt}\n\nCV_TEXT:\n{cv_text}\n\nJOB_DESCRIPTION:\n{job_description}"
        resp = self.client.models.generate_content(model=self.model, contents=contents)
        return _must_json(resp.text)

    def build_resume(self, user_profile: str, target_role: str, target_market: str) -> Dict[str, Any]:
        """Generate a complete resume from a user profile for a target role and market."""
        prompt = _load_prompt("resume_builder.txt")
        contents = (
            f"{prompt}\n\nUSER_PROFILE:\n{user_profile}\n\n"
            f"TARGET_ROLE:\n{target_role}\n\nTARGET_MARKET:\n{target_market}"
        )
        resp = self.client.models.generate_content(model=self.model, contents=contents)
        return _must_json(resp.text)

    def career_coach(self, messages: List[Dict[str, str]]) -> str:
        """Career coaching conversation. Messages: [{'role': 'user|assistant', 'content': '...'}]."""
        prompt = _load_prompt("career_coach.txt")
        chat_blob = "\n".join([f'{m["role"].upper()}: {m["content"]}' for m in messages])
        contents = f"{prompt}\n\n{chat_blob}"
        resp = self.client.models.generate_content(model=self.model, contents=contents)
        return (resp.text or "").strip()

    # ------------------------------------------------------------------
    # Embedding-based similarity methods
    # ------------------------------------------------------------------
    def get_cv_embedding(self, cv_text: str, use_cache: bool = True) -> np.ndarray:
        """
        Generate (or load cached) embedding for a CV using Gemini embeddings.

        Cache path priority:
        1) settings.CV_EMBEDDING_CACHE (if exists)
        2) DEFAULT_CV_EMBEDDING_CACHE
        """
        cache_path = Path(getattr(settings, "CV_EMBEDDING_CACHE", DEFAULT_CV_EMBEDDING_CACHE))

        if use_cache and cache_path.exists():
            with open(cache_path, "rb") as f:
                return pickle.load(f)

        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)

        result = genai.embed_content(
            model="models/embedding-001",
            content=cv_text,
            task_type="retrieval_document",
        )
        embedding = np.array(result["embedding"], dtype=np.float32)

        if use_cache:
            with open(cache_path, "wb") as f:
                pickle.dump(embedding, f)

        return embedding

    def score_job(self, cv_embedding: np.ndarray, job_description: str) -> float:
        """Compute cosine similarity between a CV embedding and a job description embedding."""
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)

        result = genai.embed_content(
            model="models/embedding-001",
            content=job_description,
            task_type="retrieval_query",
        )
        job_emb = np.array(result["embedding"], dtype=np.float32)

        sim = cosine_similarity([cv_embedding], [job_emb])[0][0]
        return float(sim)

    def match_cv_to_job(self, cv_text: str, job_description: str) -> float:
        """One-shot similarity score between a CV and a job description (no cache)."""
        cv_emb = self.get_cv_embedding(cv_text, use_cache=False)
        return self.score_job(cv_emb, job_description)