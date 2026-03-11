# services/main.py
import logging

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from services.routes.jobs import router as jobs_router
from services.routes.cv import router as cv_router
from services.huntflow_job_runner import run_automation_pipeline
from services.ai_service.main import app as ai_service_app
from services.routes.career_coach import router as career_coach_router

try:
    from services.routes.applications import router as applications_router
except ImportError:
    applications_router = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="HuntFlow API", version="0.1.0")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "https://hunterflow.netlify.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs_router)
app.include_router(cv_router)
app.include_router(career_coach_router)

if applications_router:
    app.include_router(applications_router)

app.mount("/api/ai", ai_service_app)


@app.get("/health")
def health():
    return {"ok": True, "service": "huntflow-main"}


@app.post("/trigger-automation")
async def trigger_automation(
    background_tasks: BackgroundTasks,
    query: str = "python developer",
    limit: int = 5,
):
    background_tasks.add_task(run_automation_pipeline, query, limit)
    return {"message": f"Automation started for '{query}' (max {limit} jobs)"}