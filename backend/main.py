import logging
import os
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.openapi.docs import get_swagger_ui_html, get_swagger_ui_oauth2_redirect_html
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response

# Charger l'env avant tout import interne qui lit os.getenv
load_dotenv()

from app.api.ai_routes import router as ai_router
from app.api.auth import router as auth_router
from app.api.cv import router as cv_router
from app.api.matches import router as matches_router
from app.api.notify import router as notify_router
from app.api.password_reset import router as password_reset_router
from app.api.preferences import router as preferences_router
from app.api.profile import router as profile_router
from app.db import Base, SessionLocal, engine
from app.services.matching import cv_keywords, ensure_linkedin_sample, list_matches_for_user
from app.services.notifications import notify_all_users
from app.services.preferences import get_or_create_pref
from app.rate_limit import limiter, rate_limit_exceeded_handler

Base.metadata.create_all(bind=engine)

SWAGGER_FAVICON_URL = "/static/swagger-favicon.svg"

app = FastAPI(title="Alizè", docs_url=None, redoc_url=None)

# Log startup configuration
log = logging.getLogger("alize")
logging.basicConfig(level=logging.INFO)
log.info("Starting Alizè API...")
log.info("Database URL: %s", os.getenv("DATABASE_URL", "sqlite:///./app.db")[:20] + "...")
log.info("Frontend URL: %s", os.getenv("FRONTEND_URL", "not set"))

# Setup rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

STATIC_DIR = Path("static")
STATIC_DIR.mkdir(exist_ok=True)

# CORS: autorise le frontend (localhost:3000) à appeler l'API (localhost:8000)
# Autorise localhost (dev) pour le frontend
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    # Prod frontends
    "https://alizejobfinder.com",
    "https://www.alizejobfinder.com",
]

# Add additional origins from environment variable (comma-separated)
extra_origins = os.getenv("CORS_ORIGINS", "")
if extra_origins:
    ALLOWED_ORIGINS.extend([o.strip() for o in extra_origins.split(",") if o.strip()])

# Also allow Vercel preview deployments
vercel_url = os.getenv("VERCEL_URL")
if vercel_url:
    ALLOWED_ORIGINS.append(f"https://{vercel_url}")

# Allow frontend URL from env
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    ALLOWED_ORIGINS.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Routes
app.include_router(auth_router)
app.include_router(password_reset_router)
app.include_router(matches_router)
app.include_router(ai_router)
app.include_router(cv_router)
app.include_router(preferences_router)
app.include_router(notify_router)
app.include_router(profile_router)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - Swagger UI",
        swagger_favicon_url=SWAGGER_FAVICON_URL,
    )


@app.get("/docs/oauth2-redirect", include_in_schema=False)
async def swagger_ui_redirect():
    return get_swagger_ui_oauth2_redirect_html()


SCHEDULER_ENABLED = True
scheduler = BackgroundScheduler()
NOTIFY_ENABLED = os.getenv("NOTIFY_ENABLED", "true").lower() == "true"
SCHEDULER_INTERVAL_MINUTES = int(os.getenv("SCHEDULER_INTERVAL_MINUTES", "60"))


def refresh_jobs_task():
    try:
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
    except Exception as e:
        log.error("Scheduler task failed: %s", e, exc_info=True)


if SCHEDULER_ENABLED:
    # Check frequently; per-user cooldown is enforced in notify_all_users
    scheduler.add_job(
        refresh_jobs_task,
        "interval",
        minutes=SCHEDULER_INTERVAL_MINUTES,
        id="refresh_jobs",
        coalesce=True,
        max_instances=1,
    )
    try:
        # éviter double démarrage en mode reload
        if os.environ.get("SCHEDULER_STARTED") != "1":
            scheduler.start()
            os.environ["SCHEDULER_STARTED"] = "1"
            log.info("Scheduler started")
    except Exception as exc:
        log.error("Scheduler failed to start: %s", exc)
