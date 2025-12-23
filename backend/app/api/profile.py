from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pathlib import Path

from app.auth import get_current_user
from app.deps import get_db
from app.models import User, CV, UserPreference, JobSearchRun, UserJobNotification, JobListing, UserJobVisit, UserJobBlacklist, UserAnalysisCache
from app.schemas import ProfileOut, ProfileUpdate
from app.security import hash_password
from app.api.auth import _sanitize_password
from app.services.matching import clear_all_jobs

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut)
def get_profile(user: User = Depends(get_current_user)):
    return ProfileOut(
        id=user.id,
        email=user.email,
        notifications_enabled=user.notifications_enabled,
        created_at=user.created_at,
    )


@router.delete("", status_code=status.HTTP_200_OK)
def delete_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Supprime CVs + fichiers uploadés
    cvs = db.query(CV).filter(CV.user_id == user.id).all()
    upload_dir = Path("uploads")
    for cv in cvs:
        if cv.filename:
            file_path = upload_dir / cv.filename
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception:
                pass
        db.delete(cv)

    # Préférences, runs, notifications
    db.query(UserPreference).filter(UserPreference.user_id == user.id).delete()
    db.query(JobSearchRun).filter(JobSearchRun.user_id == user.id).delete()
    db.query(UserJobNotification).filter(UserJobNotification.user_id == user.id).delete()
    db.query(UserJobVisit).filter(UserJobVisit.user_id == user.id).delete()
    db.query(UserJobBlacklist).filter(UserJobBlacklist.user_id == user.id).delete()
    db.query(UserAnalysisCache).filter(UserAnalysisCache.user_id == user.id).delete()

    # Offres : ici on les supprime toutes pour garantir qu'aucune entrée associée ne subsiste
    db.query(JobListing).delete()

    # Supprime l'utilisateur
    db.delete(user)
    db.commit()
    clear_all_jobs(db)
    return {"deleted": True}


@router.put("", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.email and payload.email != user.email:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        user.email = payload.email

    if payload.password:
        safe_pwd = _sanitize_password(payload.password)
        user.password_hash = hash_password(safe_pwd)

    if payload.notifications_enabled is not None:
        user.notifications_enabled = payload.notifications_enabled

    db.add(user)
    db.commit()
    db.refresh(user)

    return ProfileOut(
        id=user.id,
        email=user.email,
        notifications_enabled=user.notifications_enabled,
        created_at=user.created_at,
    )
