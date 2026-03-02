<<<<<<< HEAD
"""
CV Engine Module
================
Provides AI‑powered CV analysis, enhancement, and job matching using Google Gemini.
Supports:
- ATS scoring (prompt‑based)
- CV enhancement for specific job descriptions
- Resume building from user profile
- Career coaching chat
- Embedding‑based similarity scoring (with caching)
"""

from __future__ import annotations

import json
import os
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
CV_EMBEDDING_CACHE = Path("cv_embedding.pkl")   # can be overridden in settings


def _load_prompt(name: str) -> str:
    """Load a prompt template from the prompts directory."""
=======
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from core.config import settings
from engines.gemini_client import get_gemini_client


PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"


def _load_prompt(name: str) -> str:
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")


def _must_json(text: str) -> Dict[str, Any]:
<<<<<<< HEAD
    """Parse JSON from Gemini response, cleaning markdown fences if needed."""
=======
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
    text = (text or "").strip()
    try:
        return json.loads(text)
    except Exception:
        # common model mistake: wraps in markdown fences
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)


class CVEngine:
<<<<<<< HEAD
    """
    Unified engine for CV/job operations using Gemini models.
    """

=======
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
    def __init__(self) -> None:
        self.client = get_gemini_client()
        self.model = settings.GEMINI_MODEL_TEXT

<<<<<<< HEAD
    # ------------------------------------------------------------------
    # Prompt‑based methods (use Gemini generative model)
    # ------------------------------------------------------------------
    def ats_score(self, cv_text: str, job_description: str) -> Dict[str, Any]:
        """
        Score a CV against a job description using an ATS‑like prompt.
        Returns a dict with score, matching keywords, and suggestions.
        """
=======
    def ats_score(self, cv_text: str, job_description: str) -> Dict[str, Any]:
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
        prompt = _load_prompt("ats_score.txt")
        contents = f"{prompt}\n\nCV_TEXT:\n{cv_text}\n\nJOB_DESCRIPTION:\n{job_description}"
        resp = self.client.models.generate_content(model=self.model, contents=contents)
        return _must_json(resp.text)

    def enhance_cv(self, cv_text: str, job_description: str) -> Dict[str, Any]:
<<<<<<< HEAD
        """
        Suggest improvements to a CV tailored to a specific job description.
        Returns a dict with enhanced sections and explanations.
        """
=======
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
        prompt = _load_prompt("enhance_cv.txt")
        contents = f"{prompt}\n\nCV_TEXT:\n{cv_text}\n\nJOB_DESCRIPTION:\n{job_description}"
        resp = self.client.models.generate_content(model=self.model, contents=contents)
        return _must_json(resp.text)

    def build_resume(self, user_profile: str, target_role: str, target_market: str) -> Dict[str, Any]:
<<<<<<< HEAD
        """
        Generate a complete resume from a user profile for a target role and market.
        Returns a structured resume.
        """
=======
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
        prompt = _load_prompt("resume_builder.txt")
        contents = f"{prompt}\n\nUSER_PROFILE:\n{user_profile}\n\nTARGET_ROLE:\n{target_role}\n\nTARGET_MARKET:\n{target_market}"
        resp = self.client.models.generate_content(model=self.model, contents=contents)
        return _must_json(resp.text)

    def career_coach(self, messages: List[Dict[str, str]]) -> str:
<<<<<<< HEAD
        """
        Have a career coaching conversation.
        Messages is a list of dicts with 'role' and 'content'.
        Returns the assistant's reply.
        """
=======
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
        prompt = _load_prompt("career_coach.txt")
        chat_blob = "\n".join([f'{m["role"].upper()}: {m["content"]}' for m in messages])
        contents = f"{prompt}\n\n{chat_blob}"
        resp = self.client.models.generate_content(model=self.model, contents=contents)
<<<<<<< HEAD
        return (resp.text or "").strip()

    # ------------------------------------------------------------------
    # Embedding‑based similarity methods
    # ------------------------------------------------------------------
    def get_cv_embedding(self, cv_text: str, use_cache: bool = True) -> np.ndarray:
        """
        Generate (or load cached) embedding for a CV using Gemini's embedding model.
        The cache is a simple pickle file – consider using a more robust cache in production.
        """
        cache_path = Path(settings.CV_EMBEDDING_CACHE) if hasattr(settings, 'CV_EMBEDDING_CACHE') else CV_EMBEDDING_CACHE
        if use_cache and cache_path.exists():
            with open(cache_path, "rb") as f:
                return pickle.load(f)

        # Import genai directly – it's already configured with API key from settings
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)

        result = genai.embed_content(
            model="models/embedding-001",
            content=cv_text,
            task_type="retrieval_document"
        )
        embedding = np.array(result["embedding"])

        if use_cache:
            with open(cache_path, "wb") as f:
                pickle.dump(embedding, f)

        return embedding

    def score_job(self, cv_embedding: np.ndarray, job_description: str) -> float:
        """
        Compute cosine similarity between a pre‑computed CV embedding and a job description.
        """
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)

        result = genai.embed_content(
            model="models/embedding-001",
            content=job_description,
            task_type="retrieval_query"
        )
        job_emb = np.array(result["embedding"])

        sim = cosine_similarity([cv_embedding], [job_emb])[0][0]
        return float(sim)

    # Convenience method that combines both steps
    def match_cv_to_job(self, cv_text: str, job_description: str) -> float:
        """
        One‑shot similarity score between a CV and a job description.
        (Generates CV embedding internally, does not cache.)
        """
        cv_emb = self.get_cv_embedding(cv_text, use_cache=False)
        return self.score_job(cv_emb, job_description)
=======
        return (resp.text or "").strip()
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
