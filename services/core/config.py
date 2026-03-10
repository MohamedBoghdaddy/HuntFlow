import os
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH)


def load_cv_text() -> str:
    cv_path = os.getenv("CV_FILE_PATH")
    if cv_path and os.path.exists(cv_path):
        with open(cv_path, "r", encoding="utf-8") as f:
            return f.read()
    return os.getenv("CV_TEXT", "")


CV_TEXT = load_cv_text()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    CV_TEXT: str = Field(default=CV_TEXT)
    CV_EMBEDDING_CACHE: str = Field(default="cv_embedding.pkl")

    ADZUNA_APP_ID: str = Field(default="")
    ADZUNA_APP_KEY: str = Field(default="")
    USAJOBS_API_KEY: str = Field(default="")

    TWOCAPTCHA_API_KEY: str = Field(default="")
    ANTICAPTCHA_API_KEY: str = Field(default="")

    GEMINI_API_KEY: str = Field(default="")
    GEMINI_MODEL_TEXT: str = Field(default="gemini-1.5-flash")

    REQUEST_TIMEOUT_S: int = Field(default=25)
    MAX_JOBS_PER_COUNTRY: int = Field(default=60)
    HEADLESS: bool = Field(default=True)

    EU_COUNTRIES: str = Field(default="fr,de,nl,it,es,pl,ie,be,at,pt,ro,gr,se,dk,fi,cz,hu")

    SMTP_HOST: str = Field(default="")
    SMTP_USER: str = Field(default="")
    SMTP_PASS: str = Field(default="")
    SMTP_FROM: str = Field(default="")

    APPLICANT_FIRST_NAME: str = Field(default="John", alias="APPLICANT_FIRST_NAME")
    APPLICANT_LAST_NAME: str = Field(default="Doe", alias="APPLICANT_LAST_NAME")
    APPLICANT_EMAIL: str = Field(default="john.doe@example.com", alias="APPLICANT_EMAIL")
    APPLICANT_PHONE: str = Field(default="+1234567890", alias="APPLICANT_PHONE")
    APPLICANT_RESUME_PATH: Optional[str] = Field(default=None, alias="APPLICANT_RESUME_PATH")
    APPLICANT_COVER_LETTER: Optional[str] = Field(default=None, alias="APPLICANT_COVER_LETTER")

    @property
    def eu_country_list(self) -> list[str]:
        return [c.strip().lower() for c in self.EU_COUNTRIES.split(",") if c.strip()]

    @property
    def applicant(self) -> Dict[str, Any]:
        return {
            "first_name": self.APPLICANT_FIRST_NAME,
            "last_name": self.APPLICANT_LAST_NAME,
            "email": self.APPLICANT_EMAIL,
            "phone": self.APPLICANT_PHONE,
            "resume": self.APPLICANT_RESUME_PATH,
            "cover_letter": self.APPLICANT_COVER_LETTER,
        }


settings = Settings()

REQUEST_TIMEOUT_S = settings.REQUEST_TIMEOUT_S
MAX_JOBS_PER_COUNTRY = settings.MAX_JOBS_PER_COUNTRY
USAJOBS_API_KEY = settings.USAJOBS_API_KEY
THEMUSE_API_KEY = ""
TWOCAPTCHA_API_KEY = settings.TWOCAPTCHA_API_KEY
ANTICAPTCHA_API_KEY = settings.ANTICAPTCHA_API_KEY
HEADLESS = settings.HEADLESS
SMTP_HOST = settings.SMTP_HOST
SMTP_USER = settings.SMTP_USER
SMTP_PASS = settings.SMTP_PASS
SMTP_FROM = settings.SMTP_FROM
APPLICANT = settings.applicant