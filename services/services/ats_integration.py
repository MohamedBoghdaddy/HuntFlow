from __future__ import annotations

import logging
from typing import Dict, Any, Callable, Awaitable

logger = logging.getLogger(__name__)


class ATSIntegrationError(Exception):
    pass


async def apply_greenhouse(job: dict, applicant_data: dict) -> None:
    logger.info(f"Applying via Greenhouse for {job.get('title')}")
    # Implement real API call here
    raise ATSIntegrationError("Greenhouse integration not yet implemented.")


async def apply_lever(job: dict, applicant_data: dict) -> None:
    logger.info(f"Applying via Lever for {job.get('title')}")
    raise ATSIntegrationError("Lever integration not yet implemented.")


async def apply_workday(job: dict, applicant_data: dict) -> None:
    logger.info(f"Applying via Workday for {job.get('title')}")
    raise ATSIntegrationError("Workday integration not yet implemented.")


ATS_DISPATCH: Dict[str, Callable[[dict, dict], Awaitable[None]]] = {
    "Greenhouse": apply_greenhouse,
    "Lever": apply_lever,
    "Workday": apply_workday,
}


async def apply_to_job(job: dict, applicant_data: dict) -> None:
    ats_info = job.get("ats")
    if not ats_info or not ats_info.get("type"):
        raise ATSIntegrationError("No ATS type specified.")
    ats_type = ats_info["type"]
    if ats_type not in ATS_DISPATCH:
        raise ATSIntegrationError(f"Unsupported ATS type: {ats_type}")
    await ATS_DISPATCH[ats_type](job, applicant_data)