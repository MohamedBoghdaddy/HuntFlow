"""
notify.py
=========
FastAPI router for sending email notifications about application status changes.
"""

import logging
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from services.services.email_service import send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notify", tags=["notify"])

STATUS_LABELS = {
    "saved": "Saved",
    "queued": "Queued for Application",
    "applied": "Applied",
    "interview": "Interview Scheduled",
    "offer": "Offer Received",
    "rejected": "Application Rejected",
}


class ApplicationStatusPayload(BaseModel):
    email: str
    jobTitle: Optional[str] = None
    company: Optional[str] = None
    status: Optional[str] = None


@router.post("/application-status")
async def notify_application_status(payload: ApplicationStatusPayload):
    """
    Send an email notification when an application status changes.
    """
    if not payload.email:
        return {"ok": False, "reason": "No email provided"}

    job_title = payload.jobTitle or "your job"
    company = payload.company or "the company"
    status = payload.status or "updated"
    status_label = STATUS_LABELS.get(status, status.capitalize())

    subject = f"HuntFlow Update: {status_label} — {job_title} at {company}"

    body = (
        f"Hi there,\n\n"
        f"Your application status has been updated.\n\n"
        f"Job: {job_title}\n"
        f"Company: {company}\n"
        f"New Status: {status_label}\n\n"
        + _get_status_message(status)
        + "\n\nBest of luck!\n\nThe HuntFlow Team"
    )

    try:
        await send_email(to=payload.email, subject=subject, body=body)
        return {"ok": True}
    except Exception as exc:
        logger.warning(
            "Failed to send application-status email to %s: %s",
            payload.email,
            exc,
        )
        return {"ok": False, "reason": str(exc)}


def _get_status_message(status: str) -> str:
    messages = {
        "saved": "You have saved this job to your pipeline. Good first step!",
        "queued": "This application has been queued and will be submitted soon.",
        "applied": "Your application has been submitted. Fingers crossed!",
        "interview": (
            "Congratulations! You have been invited for an interview. "
            "Review the job description and prepare your answers."
        ),
        "offer": (
            "Amazing news — you have received an offer! "
            "Take your time to review it carefully."
        ),
        "rejected": (
            "Unfortunately, this application did not move forward. "
            "Don't be discouraged — keep applying and stay positive!"
        ),
    }
    return messages.get(status, f"Your application status is now: {status}.")
