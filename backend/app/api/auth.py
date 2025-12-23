from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import re

from app.deps import get_db
from app.models import User
from app.schemas import RegisterIn, LoginIn, TokenOut
from app.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


def _sanitize_password(pwd: str) -> str:
    cleaned = (pwd or "").strip()
    if len(cleaned) < 6:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (6 caractères minimum)")
    if len(cleaned) > 128:
        raise HTTPException(status_code=400, detail="Mot de passe trop long")
    if not re.fullmatch(r"[A-Za-z0-9]+", cleaned):
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir uniquement des lettres et chiffres.")
    return cleaned


@router.post("/register", response_model=TokenOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
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
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
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
