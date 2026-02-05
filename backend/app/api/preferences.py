import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.auth import get_current_user
from app.deps import get_db
from app.models import User
from app.schemas import PreferenceIn, PreferenceOut
from app.services.preferences import get_or_create_pref
from app.services.matching import clear_user_job_data

log = logging.getLogger(__name__)

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
        notification_frequency=pref.notification_frequency,
        send_empty_digest=pref.send_empty_digest,
        notification_max_jobs=pref.notification_max_jobs,
    )


@router.put("", response_model=PreferenceOut)
def upsert_preferences(
    payload: PreferenceIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = get_or_create_pref(user, db)

    # Track if search-related fields changed (not notification settings)
    search_fields = ["role", "location", "contract_type", "salary_min", "must_keywords", "avoid_keywords"]
    search_changed = False
    changed_fields = []

    for field, value in payload.model_dump().items():
        if value is not None:  # Only update if value is provided
            old_value = getattr(pref, field, None)
            if field in search_fields and old_value != value:
                search_changed = True
                changed_fields.append(f"{field}: {old_value!r} -> {value!r}")
            setattr(pref, field, value)

    pref.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pref)

    # Only clear job data if search-related preferences changed
    if search_changed:
        log.warning("Preferences changed for user %d: %s - clearing job data", user.id, changed_fields)
        clear_user_job_data(db, user.id)
    else:
        log.info("Preferences updated for user %d but no search fields changed", user.id)

    return PreferenceOut(
        id=pref.id,
        user_id=pref.user_id,
        role=pref.role,
        location=pref.location,
        contract_type=pref.contract_type,
        salary_min=pref.salary_min,
        must_keywords=pref.must_keywords,
        avoid_keywords=pref.avoid_keywords,
        notification_frequency=pref.notification_frequency,
        send_empty_digest=pref.send_empty_digest,
        notification_max_jobs=pref.notification_max_jobs,
    )
