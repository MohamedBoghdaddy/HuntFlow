"""
CV Engine Module
================
AI-powered CV analysis, enhancement, resume building, career coaching, and
embedding-based similarity scoring.

Upgrades (fullest, production-minded MVP):
- Robust Gemini call wrapper with retries, backoff, and graceful fallback on 503 overload
- Strict, safe JSON parsing with markdown cleanup + "best-effort JSON extraction"
- Prompt loading with caching and clear errors
- Input normalization + optional truncation guards to keep requests stable
- Embedding caching keyed by content hash (not a single global pickle)
- Job embedding caching keyed by content hash
- Optional in-memory cache layer for hot paths
- Consistent logging + structured payload metadata for debugging
- Keeps dependencies minimal and compatible with your existing get_gemini_client()

Assumptions:
- get_gemini_client() returns a client supporting: client.models.generate_content(model=..., contents=...)
- settings provides GEMINI_API_KEY, GEMINI_MODEL_TEXT, REQUEST_TIMEOUT_S (optional)
"""

from __future__ import annotations

import json
import logging
import pickle
import random
import re
import time
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from services.core.config import settings
from services.engines.gemini_client import get_gemini_client

log = logging.getLogger(__name__)

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"

DEFAULT_EMBED_MODEL = "models/embedding-001"

# Disk cache dir (embeddings + prompt cache metadata)
DEFAULT_CACHE_DIR = Path(getattr(settings, "CV_CACHE_DIR", ".cv_cache"))
DEFAULT_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Guardrails for long inputs (prevents request explosions)
DEFAULT_MAX_CHARS_CV = int(getattr(settings, "MAX_CV_CHARS", 12000))
DEFAULT_MAX_CHARS_JD = int(getattr(settings, "MAX_JD_CHARS", 12000))
DEFAULT_MAX_MESSAGES = int(getattr(settings, "MAX_COACH_MESSAGES", 30))
DEFAULT_MAX_MESSAGE_CHARS = int(getattr(settings, "MAX_COACH_MESSAGE_CHARS", 2500))

# Retry policy for Gemini
DEFAULT_RETRIES = int(getattr(settings, "GEMINI_RETRIES", 3))
DEFAULT_MAX_BACKOFF_S = float(getattr(settings, "GEMINI_MAX_BACKOFF_S", 8.0))

# Optional quick in-memory cache for recent prompt loads and embeddings
IN_MEMORY_PROMPT_CACHE: Dict[str, str] = {}
IN_MEMORY_EMB_CACHE: Dict[str, np.ndarray] = {}
IN_MEMORY_EMB_CACHE_MAX = int(getattr(settings, "IN_MEMORY_EMB_CACHE_MAX", 200))


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def _load_prompt(name: str) -> str:
    """Load a prompt template from the prompts directory (cached in-memory)."""
    if name in IN_MEMORY_PROMPT_CACHE:
        return IN_MEMORY_PROMPT_CACHE[name]

    path = PROMPTS_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")

    text = path.read_text(encoding="utf-8")
    IN_MEMORY_PROMPT_CACHE[name] = text
    return text


def _clean_markdown_fences(text: str) -> str:
    t = (text or "").strip()
    # remove fenced blocks but keep content
    t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*```$", "", t)
    return t.strip()


def _extract_first_json_object(text: str) -> str:
    """
    Best-effort: extract the first top-level JSON object or array found in text.
    Useful when models wrap JSON with commentary.
    """
    t = _clean_markdown_fences(text)
    # Find first "{" or "[" and try to balance braces
    start_obj = t.find("{")
    start_arr = t.find("[")
    if start_obj == -1 and start_arr == -1:
        return t

    start = start_obj if (start_obj != -1 and (start_arr == -1 or start_obj < start_arr)) else start_arr
    opener = t[start]
    closer = "}" if opener == "{" else "]"

    depth = 0
    for i in range(start, len(t)):
        ch = t[i]
        if ch == opener:
            depth += 1
        elif ch == closer:
            depth -= 1
            if depth == 0:
                return t[start : i + 1]

    # If unbalanced, return cleaned text; json.loads will fail with a clear error
    return t


def _must_json(text: str) -> Dict[str, Any]:
    """Parse JSON from Gemini response, cleaning markdown and extracting object if needed."""
    raw = (text or "").strip()
    cleaned = _extract_first_json_object(raw)

    try:
        val = json.loads(cleaned)
    except Exception as e:
        # Provide helpful context
        snippet = cleaned[:4000]
        raise ValueError(f"Failed to parse JSON from model output. Snippet: {snippet}") from e

    if not isinstance(val, dict):
        # Normalize arrays to a dict wrapper so API is consistent
        return {"data": val}
    return val


def _hash_text(s: str) -> str:
    return sha256((s or "").encode("utf-8", errors="ignore")).hexdigest()


def _clip_text(s: str, max_chars: int) -> str:
    s = s or ""
    if len(s) <= max_chars:
        return s
    # keep head+tail to preserve key info
    head = s[: int(max_chars * 0.7)]
    tail = s[-int(max_chars * 0.3) :]
    return f"{head}\n...\n{tail}"


def _normalize_messages(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Enforces max count and per-message length. Keeps most recent messages.
    Expected shape: {"role": "...", "content": "..."}.
    """
    msgs = messages or []
    # Keep last N messages
    msgs = msgs[-DEFAULT_MAX_MESSAGES :]

    out: List[Dict[str, str]] = []
    for m in msgs:
        role = str(m.get("role", "user")).strip().lower()
        if role not in ("user", "assistant", "system"):
            role = "user"
        content = _clip_text(str(m.get("content", "")), DEFAULT_MAX_MESSAGE_CHARS)
        out.append({"role": role, "content": content})
    return out


def _format_chat_blob(messages: List[Dict[str, str]]) -> str:
    return "\n".join([f'{m["role"].upper()}: {m["content"]}' for m in messages])


@dataclass
class GeminiCallMeta:
    feature: str
    model: str
    attempts: int
    elapsed_s: float
    last_error: Optional[str] = None


class CVEngine:
    """Unified engine for CV/job operations using Gemini models."""

    def __init__(self) -> None:
        self.client = get_gemini_client()
        self.model = getattr(settings, "GEMINI_MODEL_TEXT", "gemini-3-flash-preview")

        # Dedicated cache dirs
        self.cache_dir = Path(getattr(settings, "CV_CACHE_DIR", DEFAULT_CACHE_DIR))
        self.emb_dir = self.cache_dir / "embeddings"
        self.emb_dir.mkdir(parents=True, exist_ok=True)

        self.job_emb_dir = self.cache_dir / "job_embeddings"
        self.job_emb_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Gemini generation wrapper
    # ------------------------------------------------------------------
    def _generate_text(
        self,
        *,
        contents: str,
        feature: str,
        retries: int = DEFAULT_RETRIES,
    ) -> Tuple[str, GeminiCallMeta]:
        """
        Calls Gemini with retries and backoff for transient overload.
        Returns (text, meta).
        """
        start = time.time()
        last_err = None

        for attempt in range(1, retries + 1):
            try:
                resp = self.client.models.generate_content(model=self.model, contents=contents)
                text = (getattr(resp, "text", None) or "").strip()
                meta = GeminiCallMeta(
                    feature=feature,
                    model=self.model,
                    attempts=attempt,
                    elapsed_s=time.time() - start,
                )
                return text, meta

            except Exception as e:
                last_err = str(e)

                # Best-effort detect overload / 503 / high demand
                msg = str(e).lower()
                is_overload = ("503" in msg) or ("unavailable" in msg) or ("high demand" in msg)

                if attempt < retries and is_overload:
                    backoff = min((2 ** attempt) + random.random(), DEFAULT_MAX_BACKOFF_S)
                    log.warning(
                        "gemini overload (%s) feature=%s attempt=%d/%d backoff=%.2fs",
                        last_err,
                        feature,
                        attempt,
                        retries,
                        backoff,
                    )
                    time.sleep(backoff)
                    continue

                # No more retries or non-transient error
                meta = GeminiCallMeta(
                    feature=feature,
                    model=self.model,
                    attempts=attempt,
                    elapsed_s=time.time() - start,
                    last_error=last_err,
                )
                raise RuntimeError(f"Gemini call failed for feature={feature}: {last_err}") from e

        # Should never hit
        meta = GeminiCallMeta(
            feature=feature,
            model=self.model,
            attempts=retries,
            elapsed_s=time.time() - start,
            last_error=last_err,
        )
        raise RuntimeError(f"Gemini call failed for feature={feature}: {last_err}")

    # ------------------------------------------------------------------
    # Prompt-based methods (use Gemini generative model)
    # ------------------------------------------------------------------
    def ats_score(self, cv_text: str, job_description: str) -> Dict[str, Any]:
        """
        Score a CV against a job description using an ATS-like prompt.
        Output: dict (parsed JSON).
        """
        prompt = _load_prompt("ats_score.txt")
        cv = _clip_text(cv_text, DEFAULT_MAX_CHARS_CV)
        jd = _clip_text(job_description, DEFAULT_MAX_CHARS_JD)

        contents = f"{prompt}\n\nCV_TEXT:\n{cv}\n\nJOB_DESCRIPTION:\n{jd}"
        text, meta = self._generate_text(contents=contents, feature="ats_score")

        try:
            data = _must_json(text)
        except Exception as e:
            log.error("ats_score json parse failed: %s | meta=%s", e, meta)
            # Safe fallback payload to keep API stable
            return {"error": "invalid_json", "raw": text[:2000], "meta": meta.__dict__}

        data.setdefault("meta", meta.__dict__)
        return data

    def enhance_cv(self, cv_text: str, job_description: str) -> Dict[str, Any]:
        """
        Suggest improvements to a CV tailored to a specific job description.
        Output: dict (parsed JSON).
        """
        prompt = _load_prompt("enhance_cv.txt")
        cv = _clip_text(cv_text, DEFAULT_MAX_CHARS_CV)
        jd = _clip_text(job_description, DEFAULT_MAX_CHARS_JD)

        contents = f"{prompt}\n\nCV_TEXT:\n{cv}\n\nJOB_DESCRIPTION:\n{jd}"
        text, meta = self._generate_text(contents=contents, feature="enhance_cv")

        try:
            data = _must_json(text)
        except Exception as e:
            log.error("enhance_cv json parse failed: %s | meta=%s", e, meta)
            return {"error": "invalid_json", "raw": text[:2000], "meta": meta.__dict__}

        data.setdefault("meta", meta.__dict__)
        return data

    def build_resume(self, user_profile: Any, target_role: str, target_market: str) -> Dict[str, Any]:
        """
        Generate a complete resume from a user profile for a target role and market.
        user_profile may be dict or str.
        Output: dict (parsed JSON).
        """
        prompt = _load_prompt("resume_builder.txt")

        if isinstance(user_profile, dict):
            up = json.dumps(user_profile, ensure_ascii=False, indent=2)
        else:
            up = str(user_profile or "")

        up = _clip_text(up, DEFAULT_MAX_CHARS_CV)  # profile can get long too
        contents = (
            f"{prompt}\n\nUSER_PROFILE:\n{up}\n\n"
            f"TARGET_ROLE:\n{target_role}\n\nTARGET_MARKET:\n{target_market}"
        )

        text, meta = self._generate_text(contents=contents, feature="resume_builder")

        try:
            data = _must_json(text)
        except Exception as e:
            log.error("build_resume json parse failed: %s | meta=%s", e, meta)
            return {"error": "invalid_json", "raw": text[:2000], "meta": meta.__dict__}

        data.setdefault("meta", meta.__dict__)
        return data

    def career_coach(self, messages: List[Dict[str, str]]) -> str:
        """
        Career coaching conversation.
        Messages: [{'role': 'user|assistant|system', 'content': '...'}].
        Output: plain text.
        """
        prompt = _load_prompt("career_coach.txt")
        msgs = _normalize_messages(messages)
        chat_blob = _format_chat_blob(msgs)
        contents = f"{prompt}\n\n{chat_blob}"

        try:
            text, _meta = self._generate_text(contents=contents, feature="career_coach")
            return (text or "").strip()
        except Exception as e:
            # Graceful fallback if provider overload or other transient errors
            log.warning("career_coach fallback due to error: %s", e)
            return (
                "The AI coach is busy right now. Try again in a minute.\n\n"
                "Quick checklist you can apply now:\n"
                "- Rewrite your summary to 2–3 outcome lines\n"
                "- Add metrics to your top 3 bullets\n"
                "- Move strongest projects to the top\n"
                "- Tailor skills to the target role\n"
            )

    # ------------------------------------------------------------------
    # Embedding-based similarity methods (Gemini embeddings)
    # ------------------------------------------------------------------
    def _embedding_cache_path(self, kind: str, text_hash: str) -> Path:
        # kind: "cv" or "job"
        base = self.emb_dir if kind == "cv" else self.job_emb_dir
        return base / f"{text_hash}.pkl"

    def _load_embedding_from_disk(self, path: Path) -> Optional[np.ndarray]:
        if not path.exists():
            return None
        try:
            with open(path, "rb") as f:
                emb = pickle.load(f)
            if isinstance(emb, np.ndarray):
                return emb.astype(np.float32)
            return None
        except Exception:
            return None

    def _save_embedding_to_disk(self, path: Path, embedding: np.ndarray) -> None:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "wb") as f:
                pickle.dump(embedding.astype(np.float32), f)
        except Exception as e:
            log.warning("failed to persist embedding cache at %s: %s", path, e)

    def _embed_content(self, text: str, task_type: str) -> np.ndarray:
        """
        Uses google.generativeai embedding API (lightweight and stable for embeddings).
        """
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)

        result = genai.embed_content(
            model=DEFAULT_EMBED_MODEL,
            content=text,
            task_type=task_type,  # retrieval_document or retrieval_query
        )
        return np.array(result["embedding"], dtype=np.float32)

    def get_cv_embedding(self, cv_text: str, use_cache: bool = True) -> np.ndarray:
        """
        Generate (or load cached) embedding for a CV using Gemini embeddings.
        Cache key is hash(cv_text), not a single global pickle.
        """
        cv = _clip_text(cv_text, DEFAULT_MAX_CHARS_CV)
        key = _hash_text(cv)

        # In-memory cache
        if use_cache and key in IN_MEMORY_EMB_CACHE:
            return IN_MEMORY_EMB_CACHE[key]

        disk_path = self._embedding_cache_path("cv", key)
        if use_cache:
            disk = self._load_embedding_from_disk(disk_path)
            if disk is not None:
                # memoize
                IN_MEMORY_EMB_CACHE[key] = disk
                if len(IN_MEMORY_EMB_CACHE) > IN_MEMORY_EMB_CACHE_MAX:
                    IN_MEMORY_EMB_CACHE.pop(next(iter(IN_MEMORY_EMB_CACHE)))
                return disk

        emb = self._embed_content(cv, task_type="retrieval_document")

        if use_cache:
            self._save_embedding_to_disk(disk_path, emb)
            IN_MEMORY_EMB_CACHE[key] = emb
            if len(IN_MEMORY_EMB_CACHE) > IN_MEMORY_EMB_CACHE_MAX:
                IN_MEMORY_EMB_CACHE.pop(next(iter(IN_MEMORY_EMB_CACHE)))

        return emb

    def get_job_embedding(self, job_description: str, use_cache: bool = True) -> np.ndarray:
        jd = _clip_text(job_description, DEFAULT_MAX_CHARS_JD)
        key = _hash_text(jd)

        # In-memory cache key namespaced
        mem_key = f"job:{key}"
        if use_cache and mem_key in IN_MEMORY_EMB_CACHE:
            return IN_MEMORY_EMB_CACHE[mem_key]

        disk_path = self._embedding_cache_path("job", key)
        if use_cache:
            disk = self._load_embedding_from_disk(disk_path)
            if disk is not None:
                IN_MEMORY_EMB_CACHE[mem_key] = disk
                if len(IN_MEMORY_EMB_CACHE) > IN_MEMORY_EMB_CACHE_MAX:
                    IN_MEMORY_EMB_CACHE.pop(next(iter(IN_MEMORY_EMB_CACHE)))
                return disk

        emb = self._embed_content(jd, task_type="retrieval_query")

        if use_cache:
            self._save_embedding_to_disk(disk_path, emb)
            IN_MEMORY_EMB_CACHE[mem_key] = emb
            if len(IN_MEMORY_EMB_CACHE) > IN_MEMORY_EMB_CACHE_MAX:
                IN_MEMORY_EMB_CACHE.pop(next(iter(IN_MEMORY_EMB_CACHE)))

        return emb

    def score_job(self, cv_embedding: np.ndarray, job_description: str, use_cache: bool = True) -> float:
        """Compute cosine similarity between a CV embedding and a job description embedding."""
        job_emb = self.get_job_embedding(job_description, use_cache=use_cache)
        sim = cosine_similarity([cv_embedding], [job_emb])[0][0]
        return float(sim)

    def match_cv_to_job(self, cv_text: str, job_description: str, use_cache: bool = True) -> float:
        """One-shot similarity score between a CV and a job description."""
        cv_emb = self.get_cv_embedding(cv_text, use_cache=use_cache)
        return self.score_job(cv_emb, job_description, use_cache=use_cache)

    def generate_cover_letter(
        self,
        cv_text: str,
        job_title: str,
        company: str,
        job_description: str,
    ) -> str:
        """
        Generate a tailored cover letter based on the candidate's CV and job details.
        Returns plain text.
        """
        prompt = _load_prompt("cover_letter.txt")
        cv = _clip_text(cv_text, DEFAULT_MAX_CHARS_CV)
        jd = _clip_text(job_description, DEFAULT_MAX_CHARS_JD)

        contents = (
            prompt
            .replace("{cv_text}", cv)
            .replace("{job_title}", job_title or "")
            .replace("{company}", company or "")
            .replace("{job_description}", jd)
        )

        try:
            text, _meta = self._generate_text(contents=contents, feature="cover_letter")
            return (text or "").strip()
        except Exception as e:
            log.warning("generate_cover_letter fallback due to error: %s", e)
            return (
                f"Dear Hiring Manager at {company},\n\n"
                "I am writing to express my interest in the "
                f"{job_title} position at {company}. "
                "Based on my experience and skills detailed in my CV, "
                "I believe I would be a strong fit for this role.\n\n"
                "I look forward to discussing how I can contribute to your team.\n\n"
                "Sincerely,\n[Your Name]"
            )