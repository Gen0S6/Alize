"""
Password reset and email verification API endpoints.
"""
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import User, PasswordResetToken, EmailVerificationToken
from app.schemas import (
    PasswordResetRequest,
    PasswordResetConfirm,
    PasswordResetResponse,
    EmailVerificationRequest,
    EmailVerificationConfirm,
    EmailVerificationResponse,
)
from app.security import hash_password
from app.api.auth import _sanitize_password
from app.auth import get_current_user
from app.rate_limit import limiter, AUTH_RATE_LIMIT
from app.services.notifications import send_email_notification

router = APIRouter(prefix="/auth", tags=["auth"])

# Token expiration times
PASSWORD_RESET_EXPIRY_HOURS = int(os.getenv("PASSWORD_RESET_EXPIRY_HOURS", "1"))
EMAIL_VERIFICATION_EXPIRY_HOURS = int(os.getenv("EMAIL_VERIFICATION_EXPIRY_HOURS", "24"))

# Frontend URLs for email links
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def generate_secure_token() -> str:
    """Generate a cryptographically secure token."""
    return secrets.token_urlsafe(32)


def build_password_reset_email(reset_url: str) -> tuple[str, str]:
    """Build password reset email content."""
    text = f"""Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe sur Alizè.

Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :
{reset_url}

Ce lien expire dans {PASSWORD_RESET_EXPIRY_HOURS} heure(s).

Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.

L'équipe Alizè
"""

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .button {{
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }}
        .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Réinitialisation de mot de passe</h2>
        <p>Bonjour,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe sur Alizè.</p>
        <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
        <a href="{reset_url}" class="button">Réinitialiser mon mot de passe</a>
        <p>Ou copiez ce lien dans votre navigateur :<br>
        <small>{reset_url}</small></p>
        <p>Ce lien expire dans <strong>{PASSWORD_RESET_EXPIRY_HOURS} heure(s)</strong>.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.</p>
        <div class="footer">
            <p>L'équipe Alizè</p>
        </div>
    </div>
</body>
</html>
"""
    return text, html


def build_email_verification_email(verify_url: str) -> tuple[str, str]:
    """Build email verification email content."""
    text = f"""Bonjour,

Merci de vous être inscrit sur Alizè !

Cliquez sur le lien ci-dessous pour vérifier votre adresse email :
{verify_url}

Ce lien expire dans {EMAIL_VERIFICATION_EXPIRY_HOURS} heures.

L'équipe Alizè
"""

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .button {{
            display: inline-block;
            padding: 12px 24px;
            background-color: #16a34a;
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }}
        .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Vérification de votre email</h2>
        <p>Bonjour,</p>
        <p>Merci de vous être inscrit sur Alizè !</p>
        <p>Cliquez sur le bouton ci-dessous pour vérifier votre adresse email :</p>
        <a href="{verify_url}" class="button">Vérifier mon email</a>
        <p>Ou copiez ce lien dans votre navigateur :<br>
        <small>{verify_url}</small></p>
        <p>Ce lien expire dans <strong>{EMAIL_VERIFICATION_EXPIRY_HOURS} heures</strong>.</p>
        <div class="footer">
            <p>L'équipe Alizè</p>
        </div>
    </div>
</body>
</html>
"""
    return text, html


@router.post("/password-reset/request", response_model=PasswordResetResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def request_password_reset(
    request: Request,
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    """
    Request a password reset email.
    Always returns success to prevent email enumeration attacks.
    """
    user = db.query(User).filter(User.email == payload.email).first()

    if user:
        # Invalidate any existing tokens for this user
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used.is_(False),
        ).update({"used": True})

        # Create new token
        token = generate_secure_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=PASSWORD_RESET_EXPIRY_HOURS)

        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=expires_at,
        )
        db.add(reset_token)
        db.commit()

        # Send email
        reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
        text, html = build_password_reset_email(reset_url)
        send_email_notification(
            user.email,
            "Réinitialisation de votre mot de passe - Alizè",
            text,
            html,
        )

    # Always return success to prevent email enumeration
    return PasswordResetResponse(
        message="Si cette adresse email existe dans notre système, vous recevrez un email avec les instructions.",
        success=True,
    )


@router.post("/password-reset/confirm", response_model=PasswordResetResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def confirm_password_reset(
    request: Request,
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    """
    Confirm password reset with token and set new password.
    """
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == payload.token,
        PasswordResetToken.used.is_(False),
    ).first()

    if not reset_token:
        raise HTTPException(
            status_code=400,
            detail="Token invalide ou expiré. Veuillez demander un nouveau lien.",
        )

    # Check expiration
    if reset_token.expires_at < datetime.now(timezone.utc):
        reset_token.used = True
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Ce lien a expiré. Veuillez demander un nouveau lien.",
        )

    # Get user and update password
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Utilisateur introuvable.")

    # Validate and set new password
    safe_pwd = _sanitize_password(payload.new_password)
    user.password_hash = hash_password(safe_pwd)

    # Mark token as used
    reset_token.used = True

    db.commit()

    return PasswordResetResponse(
        message="Votre mot de passe a été réinitialisé avec succès.",
        success=True,
    )


@router.post("/email/verify/request", response_model=EmailVerificationResponse)
@limiter.limit(AUTH_RATE_LIMIT)
def request_email_verification(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Request a new email verification link.
    """
    if getattr(user, 'email_verified', False):
        return EmailVerificationResponse(
            message="Votre email est déjà vérifié.",
            success=True,
        )

    # Invalidate any existing tokens for this user
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id,
        EmailVerificationToken.used.is_(False),
    ).update({"used": True})

    # Create new token
    token = generate_secure_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)

    verify_token = EmailVerificationToken(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
    )
    db.add(verify_token)
    db.commit()

    # Send email
    verify_url = f"{FRONTEND_URL}/verify-email?token={token}"
    text, html = build_email_verification_email(verify_url)
    send_email_notification(
        user.email,
        "Vérifiez votre adresse email - Alizè",
        text,
        html,
    )

    return EmailVerificationResponse(
        message="Un email de vérification a été envoyé.",
        success=True,
    )


@router.post("/email/verify/confirm", response_model=EmailVerificationResponse)
def confirm_email_verification(
    payload: EmailVerificationConfirm,
    db: Session = Depends(get_db),
):
    """
    Confirm email verification with token.
    """
    verify_token = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == payload.token,
        EmailVerificationToken.used.is_(False),
    ).first()

    if not verify_token:
        raise HTTPException(
            status_code=400,
            detail="Token invalide ou expiré. Veuillez demander un nouveau lien.",
        )

    # Check expiration
    if verify_token.expires_at < datetime.now(timezone.utc):
        verify_token.used = True
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Ce lien a expiré. Veuillez demander un nouveau lien.",
        )

    # Get user and mark email as verified
    user = db.query(User).filter(User.id == verify_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Utilisateur introuvable.")

    user.email_verified = True
    verify_token.used = True

    db.commit()

    return EmailVerificationResponse(
        message="Votre adresse email a été vérifiée avec succès.",
        success=True,
    )
