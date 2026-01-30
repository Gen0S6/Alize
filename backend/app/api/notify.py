import os
import logging

from fastapi import APIRouter, Depends, HTTPException, status
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

log = logging.getLogger("alize.notify")

# Admin emails from environment variable
ADMIN_EMAILS = [
    e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()
]

router = APIRouter(prefix="/notify", tags=["notify"])


@router.get("/config")
def notify_config(user: User = Depends(get_current_user)):
    """
    Check email configuration status (without exposing sensitive values).
    Useful for debugging email delivery issues.
    """
    resend_key = os.getenv("RESEND_API_KEY", "")
    resend_from = os.getenv("RESEND_FROM", "")

    return {
        "resend_configured": bool(resend_key and resend_from),
        "resend_api_key_set": bool(resend_key),
        "resend_api_key_preview": f"{resend_key[:8]}...{resend_key[-4:]}" if len(resend_key) > 12 else "too_short_or_empty",
        "resend_from": resend_from,
        "smtp_configured": bool(
            os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASS")
        ),
        "smtp_host": os.getenv("SMTP_HOST"),
        "smtp_port": os.getenv("SMTP_PORT", "587"),
        "notify_enabled": os.getenv("NOTIFY_ENABLED", "true"),
        "user_notifications_enabled": user.notifications_enabled,
        "user_email": user.email,
    }


@router.post("/test")
def notify_test(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Test l'envoi d'email - envoie un email simple à l'utilisateur."""
    to_email = os.getenv("NOTIFY_EMAIL_TO") or user.email

    # Simple test email
    subject = "Test Alizè - Email de test"
    body_text = "Ceci est un email de test envoyé depuis Alizè. Si vous recevez ce message, la configuration email fonctionne correctement."
    body_html = """
    <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Test Alizè</h2>
        <p>Ceci est un email de test envoyé depuis Alizè.</p>
        <p>Si vous recevez ce message, la configuration email fonctionne correctement.</p>
    </div>
    """

    log.info("Testing email send to %s", to_email)

    # Test Resend
    resend_result = send_email_via_resend(to_email, subject, body_text, body_html)
    log.info("Resend result: %s", resend_result)

    if resend_result:
        return {
            "success": True,
            "method": "resend",
            "to_email": to_email,
            "message": "Email envoyé via Resend"
        }

    # Test SMTP if Resend failed
    smtp_result = send_email_via_smtp(to_email, subject, body_text, body_html)
    log.info("SMTP result: %s", smtp_result)

    if smtp_result:
        return {
            "success": True,
            "method": "smtp",
            "to_email": to_email,
            "message": "Email envoyé via SMTP"
        }

    # Both failed
    return {
        "success": False,
        "method": None,
        "to_email": to_email,
        "message": "Échec de l'envoi - ni Resend ni SMTP n'ont fonctionné. Vérifiez les logs et la configuration.",
        "config": {
            "resend_api_key_set": bool(os.getenv("RESEND_API_KEY")),
            "resend_from_set": bool(os.getenv("RESEND_FROM")),
            "smtp_host_set": bool(os.getenv("SMTP_HOST")),
        }
    }


@router.post("/run")
def notify_run(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Notifie tous les utilisateurs - réservé aux admins."""
    if not ADMIN_EMAILS or user.email.lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
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
