from google import genai
from core.config import settings


def get_gemini_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing. Put it in .env or your environment variables.")
    return genai.Client(api_key=settings.GEMINI_API_KEY)