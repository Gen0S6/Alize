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
    import json
    from urllib import request as urlrequest
    from urllib.error import HTTPError

    to_email = os.getenv("NOTIFY_EMAIL_TO") or user.email
    api_key = os.getenv("RESEND_API_KEY", "")
    from_email = os.getenv("RESEND_FROM", "")

    # Simple test email
    subject = "Test Alizè - Email de test"
    body_text = "Ceci est un email de test envoyé depuis Alizè."
    body_html = "<div><h2>Test Alizè</h2><p>Email de test.</p></div>"

    log.info("Testing email send to %s from %s", to_email, from_email)

    # Test Resend directly to capture error
    if api_key and from_email:
        payload = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "text": body_text,
            "html": body_html,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urlrequest.Request(
            "https://api.resend.com/emails",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=15) as resp:
                response_body = resp.read().decode("utf-8")
                return {
                    "success": True,
                    "method": "resend",
                    "to_email": to_email,
                    "from_email": from_email,
                    "message": "Email envoyé via Resend",
                    "response": response_body,
                }
        except HTTPError as exc:
            error_body = ""
            try:
                error_body = exc.read().decode("utf-8")
            except Exception:
                pass
            return {
                "success": False,
                "method": "resend",
                "to_email": to_email,
                "from_email": from_email,
                "message": f"Erreur Resend HTTP {exc.code}",
                "error": error_body,
            }
        except Exception as exc:
            return {
                "success": False,
                "method": "resend",
                "to_email": to_email,
                "from_email": from_email,
                "message": f"Erreur Resend: {str(exc)}",
            }

    return {
        "success": False,
        "method": None,
        "to_email": to_email,
        "message": "Configuration Resend manquante",
        "config": {
            "resend_api_key_set": bool(api_key),
            "resend_from_set": bool(from_email),
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
