"""
Rate limiting configuration for the API.
Uses slowapi to implement rate limiting on sensitive endpoints.
"""
import os
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse


def get_client_ip(request: Request) -> str:
    """
    Get client IP address, respecting X-Forwarded-For header for proxied requests.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP in the chain (original client)
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


# Rate limits configuration (can be overridden via env vars)
AUTH_RATE_LIMIT = os.getenv("AUTH_RATE_LIMIT", "5/minute")
API_RATE_LIMIT = os.getenv("API_RATE_LIMIT", "60/minute")

# Disable rate limiting in test environment
IS_TESTING = os.getenv("ENVIRONMENT") == "test"

# Create the limiter instance
limiter = Limiter(key_func=get_client_ip, enabled=not IS_TESTING)

# CORS allowed origins for exception handlers - built once at startup
def _build_allowed_origins() -> set[str]:
    """Build the set of allowed CORS origins at startup."""
    origins = {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://alizejobfinder.com",
        "https://www.alizejobfinder.com",
    }
    extra_origins = os.getenv("CORS_ORIGINS", "")
    if extra_origins:
        origins.update(o.strip() for o in extra_origins.split(",") if o.strip())
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        origins.add(frontend_url)
    return origins

CORS_ALLOWED_ORIGINS = _build_allowed_origins()


def _get_cors_headers(request: Request) -> dict[str, str]:
    """Get CORS headers for the response based on request origin."""
    origin = request.headers.get("origin", "")

    if origin in CORS_ALLOWED_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Origin, X-Requested-With",
        }
    return {}


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """
    Custom handler for rate limit exceeded errors.
    Returns a JSON response with proper error details and CORS headers.
    """
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Trop de requêtes. Veuillez patienter avant de réessayer.",
            "error": "rate_limit_exceeded",
            "retry_after": exc.detail,
        },
        headers=_get_cors_headers(request),
    )
