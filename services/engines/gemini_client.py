from google import genai
<<<<<<< HEAD
from services.core.config import settings
=======
from core.config import settings
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70


def get_gemini_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing. Put it in .env or your environment variables.")
    return genai.Client(api_key=settings.GEMINI_API_KEY)