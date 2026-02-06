import os
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
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
        "resend_from": resend_from,
        "smtp_configured": bool(
            os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASS")
        ),
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
                "User-Agent": "Alize/1.0",
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


def get_or_create_unsubscribe_token(user: User, db: Session) -> str:
    """Récupère ou crée un token de désabonnement pour l'utilisateur."""
    if user.unsubscribe_token:
        return user.unsubscribe_token

    # Générer un token unique
    token = secrets.token_urlsafe(32)
    user.unsubscribe_token = token
    db.commit()
    return token


def _build_unsubscribe_response(success: bool, resubscribed: bool = False) -> str:
    """Construit la page HTML de confirmation de désabonnement/réabonnement."""
    frontend_url = os.getenv("FRONTEND_URL", "https://alize.app")

    if resubscribed:
        title = "Notifications réactivées"
        icon = "✅"
        message = "Vous recevrez à nouveau les notifications par email."
        button_text = "Retour à l'application"
    elif success:
        title = "Désabonnement confirmé"
        icon = "🔕"
        message = "Vous ne recevrez plus de notifications par email."
        button_text = "Retour à l'application"
    else:
        title = "Lien invalide"
        icon = "❌"
        message = "Ce lien de désabonnement n'est pas valide ou a expiré."
        button_text = "Aller à l'application"

    return f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title} - Alizé</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            .container {{
                background: white;
                border-radius: 24px;
                padding: 48px 40px;
                max-width: 420px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
            }}
            .icon {{
                font-size: 64px;
                margin-bottom: 24px;
            }}
            .logo {{
                font-size: 28px;
                font-weight: 700;
                color: #0EA5E9;
                margin-bottom: 8px;
            }}
            h1 {{
                font-size: 24px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 12px;
            }}
            p {{
                color: #6B7280;
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 32px;
            }}
            .button {{
                display: inline-block;
                background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%);
                color: white;
                text-decoration: none;
                padding: 14px 32px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 15px;
                transition: transform 0.2s, box-shadow 0.2s;
            }}
            .button:hover {{
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(14, 165, 233, 0.35);
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">🌬️ ALIZÉ</div>
            <div class="icon">{icon}</div>
            <h1>{title}</h1>
            <p>{message}</p>
            <a href="{frontend_url}" class="button">{button_text}</a>
        </div>
    </body>
    </html>
    """


@router.get("/unsubscribe/{token}", response_class=HTMLResponse)
def unsubscribe_from_emails(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Désactive les notifications email pour un utilisateur via son token.
    Accessible sans authentification via un lien dans l'email.
    """
    user = db.query(User).filter(User.unsubscribe_token == token).first()

    if not user:
        log.warning("Unsubscribe attempt with invalid token: %s", token[:8] + "...")
        return HTMLResponse(content=_build_unsubscribe_response(success=False))

    user.notifications_enabled = False
    db.commit()
    log.info("User %s unsubscribed from email notifications", user.email)

    return HTMLResponse(content=_build_unsubscribe_response(success=True))


@router.get("/resubscribe/{token}", response_class=HTMLResponse)
def resubscribe_to_emails(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Réactive les notifications email pour un utilisateur via son token.
    """
    user = db.query(User).filter(User.unsubscribe_token == token).first()

    if not user:
        log.warning("Resubscribe attempt with invalid token: %s", token[:8] + "...")
        return HTMLResponse(content=_build_unsubscribe_response(success=False))

    user.notifications_enabled = True
    db.commit()
    log.info("User %s resubscribed to email notifications", user.email)

    return HTMLResponse(content=_build_unsubscribe_response(success=True, resubscribed=True))
