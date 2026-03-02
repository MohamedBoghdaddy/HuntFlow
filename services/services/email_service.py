from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from typing import Optional

from ..core.config import settings


class EmailServiceError(Exception):
    pass


async def send_email(to: str, subject: str, body: str, attachment_path: Optional[str] = None) -> None:
    # Synchronous SMTP – run in thread pool if needed
    try:
        msg = EmailMessage()
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)

        if attachment_path and os.path.exists(attachment_path):
            with open(attachment_path, "rb") as f:
                msg.add_attachment(f.read(), maintype="application", subtype="octet-stream", filename=os.path.basename(attachment_path))

        with smtplib.SMTP(settings.SMTP_HOST, 587) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(msg)
    except Exception as e:
        raise EmailServiceError(f"Failed to send email: {e}")