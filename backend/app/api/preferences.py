from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.auth import get_current_user
from app.deps import get_db
from app.models import User, UserPreference
from app.schemas import PreferenceIn, PreferenceOut
from app.services.preferences import get_or_create_pref
from app.services.matching import clear_user_job_data

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("", response_model=PreferenceOut)
def get_preferences(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = get_or_create_pref(user, db)
    return PreferenceOut(
        id=pref.id,
        user_id=pref.user_id,
        role=pref.role,
        location=pref.location,
        contract_type=pref.contract_type,
        salary_min=pref.salary_min,
        must_keywords=pref.must_keywords,
        avoid_keywords=pref.avoid_keywords,
    )


@router.put("", response_model=PreferenceOut)
def upsert_preferences(
    payload: PreferenceIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if not pref:
        pref = UserPreference(user_id=user.id)
        db.add(pref)
        db.flush()

    for field, value in payload.model_dump().items():
        setattr(pref, field, value)
    pref.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pref)
    clear_user_job_data(db, user.id)

    return PreferenceOut(
        id=pref.id,
        user_id=pref.user_id,
        role=pref.role,
        location=pref.location,
        contract_type=pref.contract_type,
        salary_min=pref.salary_min,
        must_keywords=pref.must_keywords,
        avoid_keywords=pref.avoid_keywords,
    )
