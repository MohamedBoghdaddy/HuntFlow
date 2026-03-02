# services/services/providers/adzuna.py
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

from .base import JobProvider, ProviderResult
from ...core.config import settings
from ...responses.jobs import JobItem


DEFAULT_UA = "HuntFlowBot/1.0 (+https://example.com/bot; contact: you@example.com)"


def _safe_text(x: Any) -> str:
    return (x or "").strip() if isinstance(x, str) else ""


def _robots_allowed(url: str, user_agent: str = DEFAULT_UA, timeout: float = 10.0) -> bool:
    """
    Basic robots.txt check. If robots cannot be fetched, we allow by default.
    """
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        rp = RobotFileParser()
        with httpx.Client(timeout=timeout, headers={"User-Agent": user_agent}, follow_redirects=True) as client:
            r = client.get(robots_url)
            if r.status_code >= 400:
                return True
            rp.parse(r.text.splitlines())
        return rp.can_fetch(user_agent, url)
    except Exception:
        return True


def _fetch_html(url: str, user_agent: str = DEFAULT_UA, timeout: float = 20.0) -> Tuple[str, str]:
    """
    Returns (final_url, html). Raises on hard failures.
    """
    headers = {
        "User-Agent": user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    with httpx.Client(timeout=timeout, headers=headers, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        return str(resp.url), resp.text


def _extract_jsonld_jobposting(soup: BeautifulSoup) -> Dict[str, Any]:
    """
    Tries to find a JSON-LD object with @type JobPosting.
    """
    scripts = soup.select('script[type="application/ld+json"]')
    for s in scripts:
        raw = s.get_text(strip=True)
        if not raw:
            continue
        try:
            data = __import__("json").loads(raw)
        except Exception:
            continue

        candidates = []
        if isinstance(data, list):
            candidates = data
        elif isinstance(data, dict):
            candidates = [data]

        for obj in candidates:
            if not isinstance(obj, dict):
                continue
            t = obj.get("@type") or obj.get("['@type']")
            if isinstance(t, list):
                is_job = any(str(x).lower() == "jobposting" for x in t)
            else:
                is_job = str(t).lower() == "jobposting"
            if is_job:
                return obj
    return {}


def _pick_meta(soup: BeautifulSoup, prop: str) -> str:
    tag = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
    if tag and tag.get("content"):
        return tag["content"].strip()
    return ""


_APPLY_WORDS = re.compile(r"\b(apply|apply now|apply on|submit application|easy apply|quick apply)\b", re.I)


def _find_apply_link(soup: BeautifulSoup, base_url: str) -> str:
    """
    Heuristic: find the most likely "apply" link from anchors/buttons.
    """
    best = ""
    for a in soup.find_all("a", href=True):
        text = " ".join(a.stripped_strings)
        attrs = " ".join(
            filter(
                None,
                [
                    a.get("aria-label", ""),
                    " ".join(a.get("class", [])) if isinstance(a.get("class"), list) else str(a.get("class") or ""),
                    a.get("id", ""),
                    a.get("data-testid", ""),
                ],
            )
        )
        hay = f"{text} {attrs}".strip()
        if _APPLY_WORDS.search(hay):
            href = a["href"].strip()
            if href and not href.lower().startswith("javascript:"):
                best = urljoin(base_url, href)
                break

    if best:
        return best

    for btn in soup.find_all(["button", "div"], attrs=True):
        attrs = " ".join(
            [
                str(btn.get("aria-label") or ""),
                str(btn.get("data-qa") or ""),
                str(btn.get("data-testid") or ""),
                " ".join(btn.get("class", [])) if isinstance(btn.get("class"), list) else str(btn.get("class") or ""),
            ]
        )
        text = " ".join(btn.stripped_strings)
        hay = f"{text} {attrs}".strip()
        if _APPLY_WORDS.search(hay):
            for key in ["data-href", "data-url", "data-apply-url", "data-link"]:
                val = btn.get(key)
                if val:
                    return urljoin(base_url, str(val).strip())

    return ""


@dataclass
class AdzunaURLExtracted:
    final_url: str
    title: str
    company: str
    location: str
    description_snippet: str
    apply_url: str
    posted_at: str


def extract_job_from_url(
    url: str,
    user_agent: str = DEFAULT_UA,
    robots_check: bool = True,
) -> AdzunaURLExtracted:
    if robots_check and not _robots_allowed(url, user_agent=user_agent):
        return AdzunaURLExtracted(
            final_url=url,
            title="",
            company="",
            location="",
            description_snippet="",
            apply_url="",
            posted_at="",
        )

    final_url, html = _fetch_html(url, user_agent=user_agent, timeout=float(settings.REQUEST_TIMEOUT_S))
    soup = BeautifulSoup(html, "lxml")

    job = _extract_jsonld_jobposting(soup)

    title = _safe_text(job.get("title")) or _pick_meta(soup, "og:title") or (soup.title.get_text(strip=True) if soup.title else "")
    company = ""
    org = job.get("hiringOrganization")
    if isinstance(org, dict):
        company = _safe_text(org.get("name"))
    if not company:
        company = _pick_meta(soup, "og:site_name")

    location = ""
    jl = job.get("jobLocation")
    if isinstance(jl, dict):
        addr = jl.get("address")
        if isinstance(addr, dict):
            parts = [addr.get("addressLocality"), addr.get("addressRegion"), addr.get("addressCountry")]
            location = ", ".join([p for p in map(_safe_text, parts) if p])
    elif isinstance(jl, list) and jl:
        addr = jl[0].get("address") if isinstance(jl[0], dict) else None
        if isinstance(addr, dict):
            parts = [addr.get("addressLocality"), addr.get("addressRegion"), addr.get("addressCountry")]
            location = ", ".join([p for p in map(_safe_text, parts) if p])

    desc = _safe_text(job.get("description")) or _pick_meta(soup, "description")
    desc_snip = re.sub(r"\s+", " ", desc)[:240]

    apply_url = _find_apply_link(soup, final_url)
    posted_at = _safe_text(job.get("datePosted"))

    return AdzunaURLExtracted(
        final_url=final_url,
        title=title.strip(),
        company=company.strip(),
        location=location.strip(),
        description_snippet=desc_snip,
        apply_url=apply_url.strip(),
        posted_at=posted_at,
    )


class AdzunaProvider(JobProvider):
    """
    Adzuna provider for HuntFlow.
    Uses Adzuna Search endpoint (fast + scalable). It returns redirect_url
    which is usually the best apply link you can store.
    """

    name = "adzuna"

    async def search(self, query: str, limit: int = 50, where: Optional[str] = None) -> ProviderResult:
        if not settings.ADZUNA_APP_ID or not settings.ADZUNA_APP_KEY:
            return ProviderResult(provider=self.name, jobs=[], error="Missing ADZUNA_APP_ID or ADZUNA_APP_KEY")

        # Default to Egypt unless you pass country via env or extend the signature.
        country = (getattr(settings, "ADZUNA_COUNTRY", "") or "eg").strip().lower()

        base = f"https://api.adzuna.com/v1/api/jobs/{country}/search"
        headers = {"User-Agent": DEFAULT_UA, "Accept": "application/json"}

        # Paging based on limit (Adzuna max 50 per page commonly)
        results_per_page = min(50, max(5, limit))
        pages = max(1, (limit + results_per_page - 1) // results_per_page)

        jobs: list[JobItem] = []
        try:
            async with httpx.AsyncClient(timeout=30.0, headers=headers, follow_redirects=True) as client:
                for page in range(1, pages + 1):
                    params = {
                        "app_id": settings.ADZUNA_APP_ID,
                        "app_key": settings.ADZUNA_APP_KEY,
                        "results_per_page": results_per_page,
                        "what": query,
                        "content-type": "application/json",
                    }
                    if where:
                        params["where"] = where

                    url = f"{base}/{page}"
                    r = await client.get(url, params=params)
                    r.raise_for_status()
                    data = r.json()
                    results = data.get("results") or []

                    for item in results:
                        title = _safe_text(item.get("title"))
                        company = _safe_text((item.get("company") or {}).get("display_name")) if isinstance(item.get("company"), dict) else ""
                        location = _safe_text((item.get("location") or {}).get("display_name")) if isinstance(item.get("location"), dict) else ""
                        redirect_url = _safe_text(item.get("redirect_url"))
                        created = _safe_text(item.get("created"))
                        desc = _safe_text(item.get("description"))
                        desc_snip = re.sub(r"\s+", " ", desc)[:240]

                        jobs.append(
                            JobItem(
                                source=f"{self.name}:{country}",
                                country=country,
                                title=title,
                                company=company,
                                location=location,
                                description_snippet=desc_snip,
                                job_url=redirect_url or "",
                                apply_url=redirect_url or "",
                                posted_at=created or None,
                                ats=None,
                            )
                        )
                        if len(jobs) >= limit:
                            break

                    if len(jobs) >= limit:
                        break

            return ProviderResult(provider=self.name, jobs=jobs[:limit])
        except Exception as e:
            return ProviderResult(provider=self.name, jobs=[], error=str(e))