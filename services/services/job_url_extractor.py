from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from core.config import settings
from responses.jobs import JobItem


APPLY_WORDS = re.compile(r"\b(apply|apply now|submit application|easy apply|quick apply)\b", re.I)


def _snip(text: str, n: int = 240) -> str:
    text = re.sub(r"\s+", " ", (text or "")).strip()
    return text[:n]


def _extract_jsonld_jobposting(soup: BeautifulSoup) -> Dict[str, Any]:
    for s in soup.select('script[type="application/ld+json"]'):
        raw = s.get_text(strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue

        candidates = data if isinstance(data, list) else [data] if isinstance(data, dict) else []
        for obj in candidates:
            if not isinstance(obj, dict):
                continue
            t = obj.get("@type")
            if isinstance(t, list):
                ok = any(str(x).lower() == "jobposting" for x in t)
            else:
                ok = str(t).lower() == "jobposting"
            if ok:
                return obj
    return {}


def _pick_meta(soup: BeautifulSoup, key: str) -> str:
    tag = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key})
    return (tag.get("content") or "").strip() if tag else ""


def _find_apply_link(soup: BeautifulSoup, base_url: str) -> str:
    for a in soup.find_all("a", href=True):
        text = " ".join(a.stripped_strings)
        attrs = " ".join(
            filter(None, [
                a.get("aria-label", ""),
                a.get("id", ""),
                a.get("data-testid", ""),
                " ".join(a.get("class", [])) if isinstance(a.get("class"), list) else "",
            ])
        )
        if APPLY_WORDS.search(f"{text} {attrs}"):
            href = (a.get("href") or "").strip()
            if href and not href.lower().startswith("javascript:"):
                return urljoin(base_url, href)

    for btn in soup.find_all(["button", "div"], attrs=True):
        text = " ".join(btn.stripped_strings)
        attrs = " ".join(
            filter(None, [
                str(btn.get("aria-label") or ""),
                str(btn.get("data-testid") or ""),
                " ".join(btn.get("class", [])) if isinstance(btn.get("class"), list) else "",
            ])
        )
        if APPLY_WORDS.search(f"{text} {attrs}"):
            for key in ["data-href", "data-url", "data-apply-url", "data-link"]:
                val = btn.get(key)
                if val:
                    return urljoin(base_url, str(val).strip())

    return ""


async def extract_job(url: str) -> JobItem:
    headers = {
        "User-Agent": "HuntFlow/1.0",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    }

    async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_S, headers=headers, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
        final_url = str(r.url)
        soup = BeautifulSoup(r.text, "lxml")

    job = _extract_jsonld_jobposting(soup)

    title = (job.get("title") or "").strip() or _pick_meta(soup, "og:title") or (soup.title.get_text(strip=True) if soup.title else "")
    company = ""
    org = job.get("hiringOrganization")
    if isinstance(org, dict):
        company = (org.get("name") or "").strip()
    if not company:
        company = _pick_meta(soup, "og:site_name")

    location = ""
    jl = job.get("jobLocation")
    if isinstance(jl, dict):
        addr = jl.get("address")
        if isinstance(addr, dict):
            parts = [addr.get("addressLocality"), addr.get("addressRegion"), addr.get("addressCountry")]
            location = ", ".join([p.strip() for p in parts if isinstance(p, str) and p.strip()])

    desc = (job.get("description") or "").strip() or _pick_meta(soup, "description")
    apply_url = _find_apply_link(soup, final_url)

    return JobItem(
        source="url",
        country="",
        title=title,
        company=company,
        location=location,
        description_snippet=_snip(desc),
        job_url=final_url,
        apply_url=apply_url,
        posted_at=(job.get("datePosted") or None),
    )