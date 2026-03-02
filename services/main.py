# services/main.py
import logging

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from services.routes.jobs import router as jobs_router
from services.routes.cv import router as cv_router

# Optional: applications router (only included if the file exists)
try:
    from services.routes.applications import router as applications_router
except ImportError:
    applications_router = None

# Import the automation runner function (to be called as a background task)
from services.huntflow_job_runner import run_automation_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="HuntFlow API", version="0.1.0")

# Frontend origins that are allowed to call FastAPI
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    # Add deployed frontend origin(s) here
    "https://hunterflow.netlify.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(jobs_router)
app.include_router(cv_router)
if applications_router:
    app.include_router(applications_router)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/trigger-automation")
async def trigger_automation(
    background_tasks: BackgroundTasks,
    query: str = "python developer",
    limit: int = 5,
):
    """
    Start the job search + application pipeline in the background.
    Accepts optional query and limit parameters.
    """
    background_tasks.add_task(run_automation_pipeline, query, limit)
    return {"message": f"Automation started for '{query}' (max {limit} jobs)"}