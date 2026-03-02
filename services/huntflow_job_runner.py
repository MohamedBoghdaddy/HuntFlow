# huntflow_job_runner.py
import asyncio
import logging
import random
from services.engines.job_search_engine import JobSearchEngine
from services.automation.automation_worker import AutomationWorker
from services.core.config import settings
from services.engines.cv_engine import get_cv_embedding, score_job

logger = logging.getLogger(__name__)

# Similarity threshold – tune this value (0.0 to 1.0)
SIMILARITY_THRESHOLD = 0.6

async def run_automation_pipeline(query: str = "python developer", limit: int = 5):
    # 1. Load CV text (you need to store it somewhere)
    cv_text = settings.CV_TEXT  # Add this to config or read from file
    if not cv_text:
        logger.error("No CV text found. Set CV_TEXT in config or provide a file.")
        return

    # 2. Get CV embedding (cached)
    cv_embedding = get_cv_embedding(cv_text)

    # 3. Search jobs
    search_engine = JobSearchEngine()
    search_results = await search_engine.search(
        query=query,
        where="remote",
        limit=limit * 3,  # fetch more to allow filtering
        min_results=limit,
    )

    jobs = search_results["jobs"]
    logger.info(f"Found {len(jobs)} jobs. Scoring relevance...")

    # 4. Score each job and keep only those above threshold
    scored_jobs = []
    for job in jobs:
        description = job.description_snippet or ""  # Use full description if available
        if not description:
            continue
        score = score_job(cv_embedding, description)
        if score >= SIMILARITY_THRESHOLD:
            scored_jobs.append((score, job))

    # Sort by score descending
    scored_jobs.sort(reverse=True, key=lambda x: x[0])
    top_jobs = [job for _, job in scored_jobs[:limit]]

    logger.info(f"Selected {len(top_jobs)} jobs above threshold.")

    # 5. Process them with automation worker
    applicant = settings.APPLICANT
    worker = AutomationWorker()

    for job in top_jobs:
        job_dict = job.dict()
        await worker.process_job(job_dict, applicant)
        await asyncio.sleep(random.randint(10, 30))

if __name__ == "__main__":
    asyncio.run(run_automation_pipeline())