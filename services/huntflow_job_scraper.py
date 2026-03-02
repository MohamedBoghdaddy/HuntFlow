"""
huntflow_job_scraper.py

What it does (compliant approach):
1) Pull jobs from Adzuna API (includes redirect_url you can treat as an apply link)
2) Given a public job URL, extract job details + best-guess apply link from HTML

Install:
  pip install httpx beautifulsoup4 lxml

Run:
  # 1) Search jobs via Adzuna (preferred for scale)
  export ADZUNA_APP_ID="..."
  export ADZUNA_APP_KEY="..."
  python huntflow_job_scraper.py adzuna --country gb --query "python developer" --pages 2 --out jobs.csv

  # 2) Extract apply link from a list of URLs
  python huntflow_job_scraper.py urls --in urls.txt --out extracted.csv

Notes:
- This script respects robots.txt by default (skips URLs disallowed for the user-agent).
- It will NOT bypass logins, captchas, or bot checks. If a site blocks you, use their API or another source.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import time
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup


DEFAULT_UA = "HuntFlowBot/1.0 (+https://example.com/bot; contact: you@example.com)"


@dataclass
class JobItem:
    source: str
    url: str
    title: str = ""
    company: str = ""
    location: str = ""
    description_snippet: str = ""
    apply_url: str = ""  # best guess
    posted_at: str = ""  # optional


def _safe_text(x: Any) -> str:
    return (x or "").strip() if isinstance(x, str) else ""


def _robots_allowed(url: str, user_agent: str = DEFAULT_UA, timeout: float = 10.0) -> bool:
    """
    Basic robots.txt check. If robots cannot be fetched, we allow by default.
    You can flip that behavior if you prefer strict mode.
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
            data = json.loads(raw)
        except Exception:
            # some pages embed multiple JSON objects or invalid JSON-LD
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
    # 1) Look for obvious anchor text
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

    # 2) Some sites use buttons with data-href/data-url
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

    # 3) Fallback: none found
    return ""


def extract_job_from_url(url: str, user_agent: str = DEFAULT_UA, robots_check: bool = True) -> JobItem:
    if robots_check and not _robots_allowed(url, user_agent=user_agent):
        return JobItem(source="url", url=url, title="", company="", location="", description_snippet="", apply_url="")

    final_url, html = _fetch_html(url, user_agent=user_agent)
    soup = BeautifulSoup(html, "lxml")

    # JSON-LD first (best structured signal)
    job = _extract_jsonld_jobposting(soup)

    title = _safe_text(job.get("title")) or _pick_meta(soup, "og:title") or soup.title.get_text(strip=True) if soup.title else ""
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

    # Description snippet
    desc = _safe_text(job.get("description"))
    if not desc:
        desc = _pick_meta(soup, "description")
    desc_snip = re.sub(r"\s+", " ", desc)[:240]

    apply_url = _find_apply_link(soup, final_url)

    posted_at = _safe_text(job.get("datePosted"))

    return JobItem(
        source="url",
        url=final_url,
        title=title.strip(),
        company=company.strip(),
        location=location.strip(),
        description_snippet=desc_snip,
        apply_url=apply_url.strip(),
        posted_at=posted_at,
    )


def adzuna_search(
    query: str,
    country: str,
    pages: int = 1,
    results_per_page: int = 20,
    user_agent: str = DEFAULT_UA,
    sleep_s: float = 0.3,
) -> List[JobItem]:
    """
    Uses Adzuna Search endpoint.
    Response includes redirect_url which you can store as an apply link.
    """
    app_id = os.getenv("ADZUNA_APP_ID", "").strip()
    app_key = os.getenv("ADZUNA_APP_KEY", "").strip()
    if not app_id or not app_key:
        raise RuntimeError("Missing ADZUNA_APP_ID or ADZUNA_APP_KEY env vars")

    base = f"https://api.adzuna.com/v1/api/jobs/{country}/search"
    out: List[JobItem] = []

    headers = {"User-Agent": user_agent, "Accept": "application/json"}

    with httpx.Client(timeout=30.0, headers=headers, follow_redirects=True) as client:
        for page in range(1, pages + 1):
            params = {
                "app_id": app_id,
                "app_key": app_key,
                "results_per_page": results_per_page,
                "what": query,
                "content-type": "application/json",
            }
            url = f"{base}/{page}"
            r = client.get(url, params=params)
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

                out.append(
                    JobItem(
                        source=f"adzuna:{country}",
                        url=redirect_url or "",
                        title=title,
                        company=company,
                        location=location,
                        description_snippet=desc_snip,
                        apply_url=redirect_url,
                        posted_at=created,
                    )
                )

            time.sleep(sleep_s)

    return out


def write_csv(path: str, rows: List[JobItem]) -> None:
    fieldnames = list(asdict(JobItem(source="", url="")).keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(asdict(r))


def cmd_adzuna(args: argparse.Namespace) -> None:
    jobs = adzuna_search(
        query=args.query,
        country=args.country,
        pages=args.pages,
        results_per_page=args.results_per_page,
        sleep_s=args.sleep,
    )
    write_csv(args.out, jobs)
    print(f"Wrote {len(jobs)} rows to {args.out}")


def cmd_urls(args: argparse.Namespace) -> None:
    urls: List[str] = []
    with open(args.infile, "r", encoding="utf-8") as f:
        for line in f:
            u = line.strip()
            if u and not u.startswith("#"):
                urls.append(u)

    rows: List[JobItem] = []
    for i, url in enumerate(urls, start=1):
        try:
            item = extract_job_from_url(url, robots_check=not args.no_robots)
            rows.append(item)
            print(f"[{i}/{len(urls)}] OK  {item.title[:60]}  apply={bool(item.apply_url)}")
        except Exception as e:
            rows.append(JobItem(source="url", url=url))
            print(f"[{i}/{len(urls)}] FAIL {url}  err={e}")

        time.sleep(args.sleep)

    write_csv(args.out, rows)
    print(f"Wrote {len(rows)} rows to {args.out}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("adzuna", help="Search jobs via Adzuna API and output CSV")
    p1.add_argument("--country", default="gb", help="Adzuna country code, example: gb, us, eg")
    p1.add_argument("--query", required=True, help="Search query, example: python developer")
    p1.add_argument("--pages", type=int, default=1)
    p1.add_argument("--results-per-page", type=int, default=20)
    p1.add_argument("--sleep", type=float, default=0.3)
    p1.add_argument("--out", default="adzuna_jobs.csv")
    p1.set_defaults(fn=cmd_adzuna)

    p2 = sub.add_parser("urls", help="Extract apply links from a list of public URLs")
    p2.add_argument("--in", dest="infile", required=True, help="Text file with one URL per line")
    p2.add_argument("--out", default="extracted_jobs.csv")
    p2.add_argument("--sleep", type=float, default=0.5)
    p2.add_argument("--no-robots", action="store_true", help="Disable robots.txt checks (not recommended)")
    p2.set_defaults(fn=cmd_urls)

    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()