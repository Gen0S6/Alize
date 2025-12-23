import logging
import os
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.ai_routes import router as ai_router
from app.api.auth import router as auth_router
from app.api.cv import router as cv_router
from app.api.matches import router as matches_router
from app.api.notify import router as notify_router
from app.api.preferences import router as preferences_router
from app.api.profile import router as profile_router
from app.db import Base, SessionLocal, engine
from app.services.matching import cv_keywords, ensure_linkedin_sample, list_matches_for_user
from app.services.notifications import notify_all_users
from app.services.preferences import get_or_create_pref

load_dotenv()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Alizè")
log = logging.getLogger("alize")
logging.basicConfig(level=logging.INFO)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# CORS: autorise le frontend (localhost:3000) à appeler l'API (localhost:8000)
# Autorise localhost (dev) pour le frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Routes
app.include_router(auth_router)
app.include_router(matches_router)
app.include_router(ai_router)
app.include_router(cv_router)
app.include_router(preferences_router)
app.include_router(notify_router)
app.include_router(profile_router)


@app.get("/health")
def health():
    return {"ok": True}


SCHEDULER_ENABLED = True
scheduler = BackgroundScheduler()
NOTIFY_ENABLED = os.getenv("NOTIFY_ENABLED", "true").lower() == "true"


def refresh_jobs_task():
    with SessionLocal() as db:
        ensure_linkedin_sample(db)
        log.info("Jobs refresh task executed")
        if NOTIFY_ENABLED:
            notify_all_users(
                db,
                matches_func=lambda u, db_: list_matches_for_user(
                    db_,
                    u.id,
                    get_or_create_pref(u, db_),
                    cv_keywords(db_, u.id),
                ),
                refresh=True,
            )


if SCHEDULER_ENABLED:
    scheduler.add_job(refresh_jobs_task, "interval", hours=72, id="refresh_jobs")
    try:
        # éviter double démarrage en mode reload
        if os.environ.get("SCHEDULER_STARTED") != "1":
            scheduler.start()
            os.environ["SCHEDULER_STARTED"] = "1"
            log.info("Scheduler started")
    except Exception as exc:
        log.error("Scheduler failed to start: %s", exc)
