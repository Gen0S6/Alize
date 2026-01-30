from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import UserPreference, User


def _ensure_notification_columns(db: Session) -> None:
    inspector = inspect(db.bind)
    try:
        columns = {col["name"] for col in inspector.get_columns("user_preferences")}
    except Exception:
        return

    dialect = db.bind.dialect.name
    statements: list[str] = []

    if "notification_frequency" not in columns:
        statements.append(
            "ALTER TABLE user_preferences "
            "ADD COLUMN notification_frequency VARCHAR(20) "
            "DEFAULT 'every_3_days' NOT NULL"
        )

    if "send_empty_digest" not in columns:
        default_value = "TRUE" if dialect == "postgresql" else "1"
        statements.append(
            "ALTER TABLE user_preferences "
            f"ADD COLUMN send_empty_digest BOOLEAN DEFAULT {default_value} NOT NULL"
        )

    if statements:
        for statement in statements:
            db.execute(text(statement))
        db.commit()


def get_or_create_pref(user: User, db: Session) -> UserPreference:
    _ensure_notification_columns(db)
    pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if not pref:
        pref = UserPreference(user_id=user.id)
        db.add(pref)
        try:
            db.commit()
            db.refresh(pref)
            return pref
        except IntegrityError:
            # Race condition: another request created the preference
            db.rollback()
            pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
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
