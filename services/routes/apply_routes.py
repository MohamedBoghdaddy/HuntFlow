"""
apply_routes.py
===============
FastAPI routes for the job application automation worker.
"""

import logging
import time
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, status
from pydantic import BaseModel, Field

from services.automation.automation_worker import (
    AutomationWorker,
    Job,
    JobDetails,
    Applicant,
)
from services.services.email_service import send_email

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/apply", tags=["apply"])


class JobDetailsModel(BaseModel):
    location: Optional[str] = None
    salary: Optional[str] = None
    description: Optional[str] = None
    hiring_manager_name: Optional[str] = None
    hiring_manager_email: Optional[str] = None


class JobModel(BaseModel):
    title: str
    company: str
    posting_url: Optional[str] = None
    apply_url: Optional[str] = None
    recruiter_email: Optional[str] = None
    ats: Optional[dict] = None
    details: JobDetailsModel = Field(default_factory=JobDetailsModel)
    site: Optional[str] = None


class ApplicantModel(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    resume: Optional[str] = None
    cover_letter: Optional[str] = None


class ApplicationRequest(BaseModel):
    jobs: List[JobModel]
    applicant: ApplicantModel


class ApplicationResponse(BaseModel):
    message: str
    task_id: str


async def send_application_started_email(email: str, job_labels: List[str]) -> None:
    """Send a notification email when the application process has started."""
    if not email:
        return
    try:
        job_list_html = "".join(f"<li>{label}</li>" for label in job_labels)
        body = (
            "Hi there,\n\n"
            "Your HuntFlow application process has started for the following jobs:\n\n"
            + "\n".join(f"  - {label}" for label in job_labels)
            + "\n\nWe will notify you as each application progresses.\n\nGood luck!\n\nThe HuntFlow Team"
        )
        await send_email(
            to=email,
            subject="Your HuntFlow applications have started",
            body=body,
        )
    except Exception as exc:
        logger.warning("Failed to send application-started email to %s: %s", email, exc)


async def run_application(jobs: List[Job], applicant: Applicant):
    worker = AutomationWorker()

    for job in jobs:
        try:
            await worker.process_job(job, applicant)
        except Exception as e:
            logger.error(f"Failed to process job {job.title} at {job.company}: {e}")


@router.post(
    "/",
    response_model=ApplicationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def apply_to_jobs(
    request: ApplicationRequest,
    background_tasks: BackgroundTasks,
):
    jobs: List[Job] = []

    for j in request.jobs:
        job_details = JobDetails(
            location=j.details.location,
            salary=j.details.salary,
            description=j.details.description,
            hiring_manager_name=j.details.hiring_manager_name,
            hiring_manager_email=j.details.hiring_manager_email,
        )

        job = Job(
            title=j.title,
            company=j.company,
            posting_url=j.posting_url,
            apply_url=j.apply_url,
            recruiter_email=j.recruiter_email,
            ats=j.ats,
            details=job_details,
            site=j.site,
        )
        jobs.append(job)

    applicant = Applicant(
        first_name=request.applicant.first_name,
        last_name=request.applicant.last_name,
        email=request.applicant.email,
        phone=request.applicant.phone,
        resume=request.applicant.resume,
        cover_letter=request.applicant.cover_letter,
    )

    background_tasks.add_task(run_application, jobs, applicant)
    background_tasks.add_task(
        send_application_started_email,
        applicant.email,
        [j.title + " at " + j.company for j in jobs],
    )

    task_id = f"task_{int(time.time())}"

    return ApplicationResponse(
        message="Application process started in the background.",
        task_id=task_id,
    )


@router.get("/health")
async def health_check():
    return {"status": "ok"}