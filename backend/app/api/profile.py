from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.deps import get_db
from app.models import User, CV, UserPreference, JobSearchRun, UserJob, UserAnalysisCache
from app.schemas import ProfileOut, ProfileUpdate
from app.security import hash_password, verify_password
from app.api.auth import _sanitize_password
# Note: clear_all_jobs import removed - function was incorrectly deleting ALL users' data
from app.services import storage

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut)
def get_profile(user: User = Depends(get_current_user)):
    return ProfileOut(
        id=user.id,
        email=user.email,
        notifications_enabled=user.notifications_enabled,
        email_verified=getattr(user, 'email_verified', False),
        created_at=user.created_at,
    )


@router.delete("", status_code=status.HTTP_200_OK)
def delete_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Supprime CVs + fichiers uploadés
    cvs = db.query(CV).filter(CV.user_id == user.id).all()
    for cv in cvs:
        if cv.filename:
            storage.delete_object(cv.filename)
        db.delete(cv)

    # Préférences, runs, notifications
    db.query(UserPreference).filter(UserPreference.user_id == user.id).delete()
    db.query(JobSearchRun).filter(JobSearchRun.user_id == user.id).delete()
    db.query(UserJob).filter(UserJob.user_id == user.id).delete()
    db.query(UserAnalysisCache).filter(UserAnalysisCache.user_id == user.id).delete()

    # Note: JobListings are shared resources, we don't delete them when a user is deleted
    # The UserJob entries linking the user to jobs are already deleted above

    # Supprime l'utilisateur
    db.delete(user)
    db.commit()
    # Note: clear_all_jobs() was removed - it incorrectly deleted ALL users' data
    return {"deleted": True}


@router.put("", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Update email if provided
    if payload.email and payload.email != user.email:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        user.email = payload.email
        # Mark email as unverified when changed
        user.email_verified = False

    # Update password if provided - requires current password
    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(
                status_code=400,
                detail="Le mot de passe actuel est requis pour changer de mot de passe"
            )
        # Verify current password
        if not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(
                status_code=400,
                detail="Mot de passe actuel incorrect"
            )
        # Validate and set new password
        safe_pwd = _sanitize_password(payload.new_password)
        user.password_hash = hash_password(safe_pwd)

    # Update notification preferences
    if payload.notifications_enabled is not None:
        user.notifications_enabled = payload.notifications_enabled

    db.add(user)
    db.commit()
    db.refresh(user)

    return ProfileOut(
        id=user.id,
        email=user.email,
        notifications_enabled=user.notifications_enabled,
        email_verified=getattr(user, 'email_verified', False),
        created_at=user.created_at,
    )
