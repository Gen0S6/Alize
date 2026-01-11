import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.deps import get_db
from app.models import User
from app.services.matching import cv_keywords, ensure_linkedin_sample, list_matches_for_user
from app.services.notifications import (
    build_notification_body,
    notify_all_users,
    send_email_notification,
    send_email_via_resend,
    send_email_via_smtp,
    send_slack_notification,
)
from app.services.preferences import get_or_create_pref

router = APIRouter(prefix="/notify", tags=["notify"])


@router.get("/config")
def notify_config(user: User = Depends(get_current_user)):
    """
    Check email configuration status (without exposing sensitive values).
    Useful for debugging email delivery issues.
    """
    resend_configured = bool(os.getenv("RESEND_API_KEY") and os.getenv("RESEND_FROM"))
    smtp_configured = bool(
        os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASS")
    )
    return {
        "resend_configured": resend_configured,
        "resend_from": os.getenv("RESEND_FROM", "")[:30] + "..." if os.getenv("RESEND_FROM") else None,
        "smtp_configured": smtp_configured,
        "smtp_host": os.getenv("SMTP_HOST"),
        "smtp_port": os.getenv("SMTP_PORT", "587"),
        "smtp_use_ssl": os.getenv("SMTP_USE_SSL", "false"),
        "notify_enabled": os.getenv("NOTIFY_ENABLED", "true"),
        "user_notifications_enabled": user.notifications_enabled,
        "user_email": user.email,
    }


@router.post("/test")
def notify_test(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_linkedin_sample(db)
    pref = get_or_create_pref(user, db)
    user_cv = cv_keywords(db, user.id)
    matches_list = list_matches_for_user(db, user.id, pref, user_cv)
    body_text, body_html = build_notification_body(matches_list)
    to_email = os.getenv("NOTIFY_EMAIL_TO") or user.email
    email_ok = send_email_notification(to_email, "Vos matches Alizè", body_text, body_html)
    slack_ok = send_slack_notification(body_text)
    return {"sent": True, "email": email_ok, "slack": slack_ok}


@router.post("/run")
def notify_run(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Notifie tous les utilisateurs (admin light)
    notify_all_users(
        db,
        matches_func=lambda u, db_: list_matches_for_user(
            db_,
            u.id,
            get_or_create_pref(u, db_),
            cv_keywords(db_, u.id),
        ),
        refresh=True,
    )
    return {"sent": True}
