"""
utils/job_cache.py

Disk-backed job cache with a configurable TTL (default: 1 hour).

Usage:
    cache = JobCache()
    cached = cache.get(query="python developer", where="remote", providers=["remotive"])
    if cached is None:
        result = await engine.search(...)
        cache.set(query=..., where=..., providers=..., data=result)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, List, Optional

log = logging.getLogger(__name__)

# ── Default config ────────────────────────────────────────────────────────────
_DEFAULT_CACHE_DIR = Path(os.getenv("JOB_CACHE_DIR", "/tmp/huntflow_job_cache"))
_DEFAULT_TTL_S: float = float(os.getenv("JOB_CACHE_TTL_S", "3600"))   # 1 hour


class JobCache:
    """
    Simple file-based cache for job search results.

    Each cache entry is a JSON file named by a stable hash of the search
    parameters.  Expired files are replaced on the next write.
    """

    def __init__(
        self,
        cache_dir: Path = _DEFAULT_CACHE_DIR,
        ttl_s: float = _DEFAULT_TTL_S,
    ) -> None:
        self.cache_dir = Path(cache_dir)
        self.ttl_s = ttl_s
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    # ── Public API ────────────────────────────────────────────────────────────

    def get(
        self,
        query: str,
        where: Optional[str] = None,
        providers: Optional[List[str]] = None,
    ) -> Optional[Any]:
        """
        Return cached data if it exists and is not expired, else None.
        """
        path = self._path_for(query, where, providers)
        if not path.exists():
            return None

        try:
            raw = path.read_text(encoding="utf-8")
            envelope = json.loads(raw)
        except Exception as exc:
            log.warning("job_cache: corrupt entry %s – ignoring (%s)", path.name, exc)
            return None

        cached_at: float = envelope.get("cached_at", 0.0)
        age = time.time() - cached_at

        if age > self.ttl_s:
            log.debug("job_cache: stale entry (age=%.0fs > ttl=%.0fs)", age, self.ttl_s)
            return None

        log.debug("job_cache: HIT for key=%s (age=%.0fs)", path.stem[:12], age)
        return envelope.get("data")

    def set(
        self,
        query: str,
        data: Any,
        where: Optional[str] = None,
        providers: Optional[List[str]] = None,
    ) -> None:
        """
        Persist search results to disk.  Silently swallows write errors so
        that a full disk or permission issue never breaks the caller.
        """
        path = self._path_for(query, where, providers)
        envelope = {
            "cached_at": time.time(),
            "query": query,
            "where": where,
            "providers": sorted(providers or []),
            "data": data,
        }
        try:
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(envelope, default=str), encoding="utf-8")
            tmp.replace(path)   # atomic rename
            log.debug("job_cache: wrote %s", path.name)
        except Exception as exc:
            log.warning("job_cache: could not write %s – %s", path.name, exc)

    def invalidate(
        self,
        query: str,
        where: Optional[str] = None,
        providers: Optional[List[str]] = None,
    ) -> bool:
        """Delete a specific cache entry.  Returns True if the file existed."""
        path = self._path_for(query, where, providers)
        if path.exists():
            path.unlink(missing_ok=True)
            return True
        return False

    def clear_all(self) -> int:
        """Delete every cache file.  Returns how many files were removed."""
        removed = 0
        for f in self.cache_dir.glob("*.json"):
            try:
                f.unlink()
                removed += 1
            except Exception:
                pass
        return removed

    def prune_expired(self) -> int:
        """Remove expired entries.  Returns how many were pruned."""
        pruned = 0
        now = time.time()
        for f in self.cache_dir.glob("*.json"):
            try:
                envelope = json.loads(f.read_text(encoding="utf-8"))
                age = now - envelope.get("cached_at", 0.0)
                if age > self.ttl_s:
                    f.unlink()
                    pruned += 1
            except Exception:
                pass
        return pruned

    # ── Internals ─────────────────────────────────────────────────────────────

    def _cache_key(
        self,
        query: str,
        where: Optional[str],
        providers: Optional[List[str]],
    ) -> str:
        parts = {
            "query": query.strip().lower(),
            "where": (where or "").strip().lower(),
            "providers": sorted(p.strip().lower() for p in (providers or [])),
        }
        raw = json.dumps(parts, sort_keys=True)
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    def _path_for(
        self,
        query: str,
        where: Optional[str],
        providers: Optional[List[str]],
    ) -> Path:
        key = self._cache_key(query, where, providers)
        return self.cache_dir / f"{key}.json"


# ── Module-level singleton (optional convenience) ─────────────────────────────
_default_cache: Optional[JobCache] = None


def get_default_cache() -> JobCache:
    global _default_cache
    if _default_cache is None:
        _default_cache = JobCache()
    return _default_cache
