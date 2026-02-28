# requests/cv.py
from pydantic import BaseModel, Field
from typing import List, Literal, Dict


Market = Literal["EG", "UAE", "Saudi", "EU"]


class ATSScoreRequest(BaseModel):
    cv_text: str = Field(min_length=50)
    job_description: str = Field(min_length=50)


class EnhanceCVRequest(BaseModel):
    cv_text: str = Field(min_length=50)
    job_description: str = Field(min_length=50)


class ResumeBuildRequest(BaseModel):
    user_profile: str = Field(min_length=50)
    target_role: str = Field(min_length=2)
    target_market: Market = "EG"


class CareerCoachRequest(BaseModel):
    messages: List[Dict[str, str]] = Field(min_length=1)