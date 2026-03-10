import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")


def call_gemini(prompt: str):
    response = model.generate_content(prompt)
    return response.text


def safe_parse_analysis(text: str):
    try:
        return json.loads(text)
    except Exception:
        return {
            "strengths": [],
            "weaknesses": [],
            "missingSkills": [],
            "recommendedRoles": [],
            "rewriteSuggestions": [],
            "atsScore": 65,
            "summary": text,
        }


def safe_parse_chat(text: str):
    try:
        return json.loads(text)
    except Exception:
        return {
            "reply": text,
            "suggestions": [
                "Improve your CV summary",
                "Ask for interview preparation",
                "Ask for a weekly roadmap",
            ],
        }