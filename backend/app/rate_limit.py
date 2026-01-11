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

# Create the limiter instance
limiter = Limiter(key_func=get_client_ip)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """
    Custom handler for rate limit exceeded errors.
    Returns a JSON response with proper error details.
    """
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Trop de requêtes. Veuillez patienter avant de réessayer.",
            "error": "rate_limit_exceeded",
            "retry_after": exc.detail,
        },
    )
