import os
import logging
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt

log = logging.getLogger("alize.security")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration - MUST be set in production
_jwt_secret = os.getenv("JWT_SECRET")
if not _jwt_secret:
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise RuntimeError("JWT_SECRET environment variable is required in production!")
    log.warning("JWT_SECRET not set - using insecure default. DO NOT USE IN PRODUCTION!")
    _jwt_secret = "dev-secret-change-me-immediately"

JWT_SECRET = _jwt_secret
JWT_ALG = "HS256"
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "10080"))  # 7 jours

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRES_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
