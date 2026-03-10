import asyncio
import logging
import random

from services.automation.automation_worker import AutomationWorker
from services.core.config import settings
from services.engines.cv_engine import CVEngine
from services.engines.job_search_engine import JobSearchEngine

logger = logging.getLogger(__name__)
SIMILARITY_THRESHOLD = 0.6


async def run_automation_pipeline(query: str = "python developer", limit: int = 5):
    cv_text = getattr(settings, "CV_TEXT", "")
    if not cv_text:
        logger.error("No CV text found. Set CV_TEXT in config or provide a file.")
        return

    cv_engine = CVEngine()
    cv_embedding = cv_engine.get_cv_embedding(cv_text)

    search_engine = JobSearchEngine()
    search_results = await search_engine.search(
        query=query,
        where="remote",
        limit=limit * 3,
        min_results=limit,
    )

    jobs = search_results.get("jobs", [])
    logger.info("Found %s jobs. Scoring relevance...", len(jobs))

    scored_jobs = []
    for job in jobs:
        description = getattr(job, "description_snippet", "") or getattr(job, "description", "")
        if not description:
            continue

        score = cv_engine.score_job(cv_embedding, description)
        if score >= SIMILARITY_THRESHOLD:
            scored_jobs.append((score, job))

    scored_jobs.sort(reverse=True, key=lambda x: x[0])
    top_jobs = [job for score, job in scored_jobs[:limit]]

    logger.info("Selected %s jobs above threshold.", len(top_jobs))

    applicant = settings.applicant
    worker = AutomationWorker()

    for job in top_jobs:
        job_dict = job.model_dump() if hasattr(job, "model_dump") else job.dict() if hasattr(job, "dict") else dict(job)
        await worker.process_job(job_dict, applicant)
        await asyncio.sleep(random.randint(10, 30))


if __name__ == "__main__":
    asyncio.run(run_automation_pipeline())