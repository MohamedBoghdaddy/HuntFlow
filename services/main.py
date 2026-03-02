<<<<<<< HEAD
# services/main.py
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import logging

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
=======
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.jobs import router as jobs_router
from routes.cv import router as cv_router
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70

app = FastAPI(title="HuntFlow API", version="0.1.0")

# Frontend origins that are allowed to call FastAPI
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
<<<<<<< HEAD
    "http://localhost:3000",
    # Add deployed frontend origin(s) here
    # "https://your-frontend.netlify.app",
=======
    # add your deployed frontend origin here if different from backend
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
<<<<<<< HEAD
    allow_credentials=True,  # required if your frontend uses withCredentials
=======
    allow_credentials=True,  # required because you use withCredentials: true
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
    allow_methods=["*"],     # includes POST and OPTIONS
    allow_headers=["*"],     # includes Authorization and Content-Type
)

<<<<<<< HEAD
# Routers
app.include_router(jobs_router)
app.include_router(cv_router)
if applications_router:
    app.include_router(applications_router)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/trigger-automation")
async def trigger_automation(background_tasks: BackgroundTasks, query: str = "python developer", limit: int = 5):
    """
    Start the job search + application pipeline in the background.
    Accepts optional query and limit parameters.
    """
    background_tasks.add_task(run_automation_pipeline, query, limit)
    return {"message": f"Automation started for '{query}' (max {limit} jobs)"}
=======
app.include_router(jobs_router)
app.include_router(cv_router)

@app.get("/health")
def health():
    return {"ok": True}
>>>>>>> 7c3fa22b37cd9b1ad35777a3dd75ba8e86722e70
