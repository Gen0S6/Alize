import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.deps import get_db
from app.models import User
from app.schemas import RegisterIn, LoginIn, TokenOut, ProfileOut
from app.security import hash_password, verify_password, create_access_token
from app.rate_limit import limiter, AUTH_RATE_LIMIT

router = APIRouter(prefix="/auth", tags=["auth"])

# Admin simple : emails séparés par des virgules dans ADMIN_EMAILS
ADMIN_EMAILS = [
    e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()
]


def _sanitize_password(pwd: str) -> str:
    """
    Validate password strength following NIST guidelines.
    - Minimum 8 characters (recommended for security)
    - Maximum 128 characters
    - Allow all printable characters including special chars
    - Check against common weak passwords
    """
    cleaned = (pwd or "").strip()
    if len(cleaned) < 8:
        raise HTTPException(
            status_code=400,
            detail="Mot de passe trop court (8 caractères minimum)"
        )
    if len(cleaned) > 128:
        raise HTTPException(status_code=400, detail="Mot de passe trop long")

    # Check for common weak passwords
    weak_passwords = {
        "password", "password1", "password12", "password123", "password1234",
        "12345678", "123456789", "1234567890", "qwerty123", "azerty123",
        "motdepasse", "admin123", "user1234", "welcome1", "letmein1"
    }
    if cleaned.lower() in weak_passwords:
        raise HTTPException(
            status_code=400,
            detail="Ce mot de passe est trop courant. Choisissez-en un plus sécurisé."
        )

    return cleaned


@router.post("/register", response_model=TokenOut)
@limiter.limit(AUTH_RATE_LIMIT)
def register(request: Request, payload: RegisterIn, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    safe_pwd = _sanitize_password(payload.password)

    user = User(
        email=payload.email,
        password_hash=hash_password(safe_pwd),
        notifications_enabled=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=TokenOut)
@limiter.limit(AUTH_RATE_LIMIT)
def login(request: Request, payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    # Check if user is OAuth-only (no password set)
    if user.password_hash is None:
        provider = user.oauth_provider or "social"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ce compte utilise la connexion {provider.title()}. Utilisez le bouton correspondant.",
        )
    try:
        safe_pwd = _sanitize_password(payload.password)
    except HTTPException:
        # pour éviter de révéler le motif exact côté login
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not verify_password(safe_pwd, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    token = create_access_token(user.id)

    return {"access_token": token, "token_type": "bearer"}


@router.get("/users", response_model=List[ProfileOut])
def list_users(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste tous les comptes ; réservé aux emails déclarés dans ADMIN_EMAILS."""
    if not ADMIN_EMAILS or user.email.lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    users = db.query(User).order_by(User.id).all()
    return [
        ProfileOut(
            id=u.id,
            email=u.email,
            notifications_enabled=u.notifications_enabled,
            created_at=u.created_at,
        )
        for u in users
    ]
