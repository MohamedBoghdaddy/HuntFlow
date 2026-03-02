from __future__ import annotations

from typing import Optional

from .base import JobProvider, ProviderResult
from ...responses.jobs import JobItem


class JobSpyProvider(JobProvider):
    name = "jobspy"

    async def search(self, query: str, limit: int = 50, where: Optional[str] = None) -> ProviderResult:
        # Optional: only works if jobspy is installed in your env
        try:
            from jobspy import scrape_jobs  # type: ignore
        except Exception as e:
            return ProviderResult(provider=self.name, jobs=[], error=f"jobspy not installed: {e}")

        try:
            df = scrape_jobs(
                site_name=["linkedin", "indeed", "glassdoor", "google", "zip_recruiter"],
                search_term=query,
                location=where or "",
                results_wanted=min(limit, 50),
                hours_old=72,
                country_indeed="usa",
            )
        except Exception as e:
            return ProviderResult(provider=self.name, jobs=[], error=str(e))

        jobs: list[JobItem] = []
        for _, row in df.iterrows():
            jobs.append(
                JobItem(
                    source=self.name,
                    country="",
                    title=str(row.get("title") or ""),
                    company=str(row.get("company") or ""),
                    location=str(row.get("location") or ""),
                    description_snippet=str(row.get("description") or "")[:240],
                    job_url=str(row.get("job_url") or ""),
                    apply_url=str(row.get("job_url") or ""),
                    posted_at=None,
                    ats=None,
                )
            )
            if len(jobs) >= limit:
                break

        return ProviderResult(provider=self.name, jobs=jobs)