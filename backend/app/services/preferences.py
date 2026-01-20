from sqlalchemy.orm import Session

from app.models import UserPreference, User


def get_or_create_pref(user: User, db: Session) -> UserPreference:
    pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if not pref:
        pref = UserPreference(user_id=user.id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
        return pref
    updated = False
    if not pref.notification_frequency:
        pref.notification_frequency = "every_3_days"
        updated = True
    if pref.send_empty_digest is None:
        pref.send_empty_digest = True
        updated = True
    if updated:
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref
