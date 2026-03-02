# responses/cv.py
from pydantic import BaseModel
from typing import Any, Dict


class JSONResponse(BaseModel):
    data: Dict[str, Any]


class TextResponse(BaseModel):
    text: str