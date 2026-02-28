from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    ADZUNA_APP_ID: str = Field(default="")
    ADZUNA_APP_KEY: str = Field(default="")

    GEMINI_API_KEY: str = Field(default="")
    GEMINI_MODEL_TEXT: str = Field(default="gemini-3-flash-preview")

    EU_COUNTRIES: str = Field(default="fr,de,nl,it,es,pl,ie,be,at,pt,ro,gr,se,dk,fi,cz,hu")

    REQUEST_TIMEOUT_S: int = Field(default=25)
    MAX_JOBS_PER_COUNTRY: int = Field(default=60)

    @property
    def eu_country_list(self) -> list[str]:
        return [c.strip().lower() for c in self.EU_COUNTRIES.split(",") if c.strip()]


settings = Settings()