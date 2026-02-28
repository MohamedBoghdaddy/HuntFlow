from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.jobs import router as jobs_router
from routes.cv import router as cv_router

app = FastAPI(title="HuntFlow API", version="0.1.0")

# Frontend origins that are allowed to call FastAPI
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # add your deployed frontend origin here if different from backend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,  # required because you use withCredentials: true
    allow_methods=["*"],     # includes POST and OPTIONS
    allow_headers=["*"],     # includes Authorization and Content-Type
)

app.include_router(jobs_router)
app.include_router(cv_router)

@app.get("/health")
def health():
    return {"ok": True}