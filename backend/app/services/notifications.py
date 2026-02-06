import html
import json
import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from dotenv import load_dotenv

from sqlalchemy.orm import Session

from app.schemas import JobOut
from app.models import (
    User,
    JobListing,
    CV,
    UserPreference,
    JobSearchRun,
    UserAnalysisCache,
    UserJob,
)
load_dotenv()

from app.ai import search_jobs_for_user
from app.services.preferences import get_or_create_pref
from app.services.matching import cv_keywords, add_jobs_to_user_dashboard, get_top_unnotified_jobs

log = logging.getLogger("alize.notifications")

# Intervalle entre les recherches automatiques et emails (3 jours = 4320 minutes)
NOTIFY_INTERVAL_MINUTES = int(os.getenv("NOTIFY_INTERVAL_MINUTES", "4320"))

FREQUENCY_MINUTES = {
    "daily": 1440,
    "weekly": 10080,
    "every_3_days": 4320,
}


def get_or_create_unsubscribe_token(user: "User", db: "Session") -> str:
    """Récupère ou crée un token de désabonnement pour l'utilisateur."""
    if user.unsubscribe_token:
        return user.unsubscribe_token

    # Générer un token unique
    token = secrets.token_urlsafe(32)
    user.unsubscribe_token = token
    db.commit()
    return token


def format_matches(matches: list) -> str:
    """Format des offres en texte simple."""
    lines = []
    for m in matches:
        if isinstance(m, dict):
            lines.append(f"- {m.get('title', 'Sans titre')} @ {m.get('company', 'N/A')} ({m.get('location', 'N/A')}) [{m.get('url', '#')}] score {m.get('score', '?')}")
        else:
            lines.append(f"- {m.title} @ {m.company} ({m.location or 'N/A'}) [{m.url}] score {m.score}")
    return "\n".join(lines) if lines else "Aucun match pour le moment."


def format_matches_html(matches: list) -> str:
    """Format des offres en HTML avec design amélioré."""
    if not matches:
        return "<p style='color:#475467;font-family:Inter,Arial,sans-serif;'>Aucun match pour le moment.</p>"
    cards = []
    for m in matches:
        if isinstance(m, dict):
            title = html.escape(m.get("title", "Sans titre"))
            company = html.escape(m.get("company", "N/A"))
            location = html.escape(m.get("location", "N/A"))
            url = html.escape(m.get("url", "#"))
            score_val = m.get("score", 0) or 0
            score = html.escape(str(score_val))
        else:
            title = html.escape(m.title or "Sans titre")
            company = html.escape(m.company or "N/A")
            location = html.escape(m.location or "N/A")
            url = html.escape(m.url or "#")
            score_val = m.score if m.score is not None else 0
            score = html.escape(str(score_val))

        # Couleur du score: vert pour 7+, orange pour 5-6, gris pour moins
        if score_val >= 7:
            score_bg = "#ECFDF3"
            score_color = "#16A34A"
        elif score_val >= 5:
            score_bg = "#FFF7ED"
            score_color = "#EA580C"
        else:
            score_bg = "#F3F4F6"
            score_color = "#6B7280"

        cards.append(
            f"""
            <tr>
              <td style="padding:6px 0;">
                <a href="{url}" style="text-decoration:none;color:inherit;display:block;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;">
                    <tr>
                      <td style="padding:16px 18px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="vertical-align:top;">
                              <div style="font-family:Inter,Arial,sans-serif;font-weight:600;font-size:15px;color:#111827;line-height:1.4;">{title}</div>
                              <div style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#6B7280;margin-top:4px;">{company} • {location}</div>
                            </td>
                            <td width="60" style="vertical-align:top;text-align:right;">
                              <div style="background:{score_bg};color:{score_color};font-family:Inter,Arial,sans-serif;font-weight:700;font-size:13px;padding:6px 10px;border-radius:8px;display:inline-block;">{score}/10</div>
                            </td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding-top:10px;">
                              <span style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#0EA5E9;font-weight:500;">Voir l'offre →</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </a>
              </td>
            </tr>
            """
        )
    return "".join(cards)


def build_notification_body(
    matches: list,
    frequency: Optional[str] = None,
    unsubscribe_url: Optional[str] = None,
) -> tuple[str, str]:
    """Construit le corps de l'email avec les meilleures offres et design amélioré."""
    frontend_url = os.getenv("FRONTEND_URL", "https://alize.app")

    # Trier par score (la limite est déjà appliquée par l'appelant)
    if isinstance(matches[0], dict) if matches else False:
        top = sorted(matches, key=lambda m: m.get("score", 0) or 0, reverse=True)
    else:
        top = sorted(matches, key=lambda m: m.score or 0, reverse=True)

    count = len(top)
    greeting = "Bonjour"
    header = f"VOS {count} MEILLEURES OFFRES" if count > 1 else "VOTRE MEILLEURE OFFRE"

    # Corps texte simple
    text_body = f"{greeting},\n\n{header}\nBasées sur votre profil et vos préférences\n\n"
    text_body += format_matches(top)
    text_body += f"\n\nVoir toutes mes offres: {frontend_url}/dashboard"
    if unsubscribe_url:
        text_body += f"\n\nSe désinscrire des notifications: {unsubscribe_url}"
    text_body += "\n\n---\nAlizé - Votre assistant emploi intelligent\n© 2024 Gen0S7"

    # Fréquence en français
    frequency_labels = {
        "daily": "Tous les jours",
        "weekly": "Toutes les semaines",
        "every_3_days": "Tous les 3 jours",
    }
    frequency_text = frequency_labels.get(frequency, "Tous les 3 jours")

    # Section désabonnement
    unsubscribe_section = ""
    if unsubscribe_url:
        unsubscribe_section = f"""
        <tr>
          <td style="padding:24px 32px 0 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E5E7EB;">
              <tr>
                <td style="padding-top:20px;text-align:center;">
                  <div style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#6B7280;margin-bottom:12px;">
                    📧 Fréquence actuelle : <strong>{frequency_text}</strong>
                  </div>
                  <a href="{html.escape(unsubscribe_url)}" style="display:inline-block;background:#FEE2E2;color:#DC2626;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:500;padding:10px 20px;border-radius:8px;text-decoration:none;">
                    🔕 Désactiver les notifications par email
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        """

    # Template HTML complet
    html_body = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vos offres Alizé</title>
    </head>
    <body style="margin:0;padding:0;background-color:#F3F4F6;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
              <!-- Header -->
              <tr>
                <td style="padding:28px 32px 20px 32px;border-bottom:1px solid #E5E7EB;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td>
                        <div style="font-family:Inter,Arial,sans-serif;font-size:24px;font-weight:700;color:#0EA5E9;">🌬️ ALIZÉ</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Greeting -->
              <tr>
                <td style="padding:28px 32px 0 32px;">
                  <div style="font-family:Inter,Arial,sans-serif;font-size:18px;color:#111827;">
                    👋 {html.escape(greeting)},
                  </div>
                </td>
              </tr>

              <!-- Header Box -->
              <tr>
                <td style="padding:20px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);border-radius:12px;">
                    <tr>
                      <td style="padding:18px 20px;text-align:center;">
                        <div style="font-family:Inter,Arial,sans-serif;font-size:16px;font-weight:700;color:#1E40AF;">🎯 {header}</div>
                        <div style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#3B82F6;margin-top:4px;">Basées sur votre profil et vos préférences</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Job Cards -->
              <tr>
                <td style="padding:0 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    {format_matches_html(top)}
                  </table>
                </td>
              </tr>

              <!-- CTA Button -->
              <tr>
                <td style="padding:24px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <a href="{html.escape(frontend_url)}/dashboard" style="display:inline-block;background:linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%);color:#FFFFFF;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none;box-shadow:0 4px 14px rgba(14,165,233,0.35);">
                          📊 VOIR TOUTES MES OFFRES
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Tip -->
              <tr>
                <td style="padding:0 32px 24px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;">
                    <tr>
                      <td style="padding:14px 16px;">
                        <div style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#92400E;line-height:1.5;">
                          💡 <strong>Astuce :</strong> Mettez à jour votre CV pour améliorer la pertinence de vos recommandations.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Unsubscribe Section -->
              {unsubscribe_section}

              <!-- Footer -->
              <tr>
                <td style="padding:24px 32px;border-top:1px solid #E5E7EB;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <div style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#6B7280;line-height:1.6;">
                          Alizé - Votre assistant emploi intelligent<br>
                          <span style="color:#9CA3AF;">© 2024 Gen0S7 • <a href="{html.escape(frontend_url)}/preferences" style="color:#0EA5E9;text-decoration:none;">Gérer mes préférences</a></span>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """
    return text_body, html_body


def build_empty_notification_body(
    frequency: Optional[str] = None,
    unsubscribe_url: Optional[str] = None,
) -> tuple[str, str]:
    """Construit le corps de l'email quand aucune offre n'est disponible."""
    frontend_url = os.getenv("FRONTEND_URL", "https://alize.app")
    greeting = "Bonjour"

    text = f"{greeting},\n\nAucune nouvelle offre pour le moment.\nNous continuons à surveiller les offres selon vos critères.\n\nVoir mes offres: {frontend_url}/dashboard"
    if unsubscribe_url:
        text += f"\n\nSe désinscrire: {unsubscribe_url}"
    text += "\n\n---\nAlizé - Votre assistant emploi intelligent"

    # Fréquence en français
    frequency_labels = {
        "daily": "Tous les jours",
        "weekly": "Toutes les semaines",
        "every_3_days": "Tous les 3 jours",
    }
    frequency_text = frequency_labels.get(frequency, "Tous les 3 jours")

    # Section désabonnement
    unsubscribe_section = ""
    if unsubscribe_url:
        unsubscribe_section = f"""
        <tr>
          <td style="padding:24px 32px 0 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E5E7EB;">
              <tr>
                <td style="padding-top:20px;text-align:center;">
                  <div style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#6B7280;margin-bottom:12px;">
                    📧 Fréquence actuelle : <strong>{frequency_text}</strong>
                  </div>
                  <a href="{html.escape(unsubscribe_url)}" style="display:inline-block;background:#FEE2E2;color:#DC2626;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:500;padding:10px 20px;border-radius:8px;text-decoration:none;">
                    🔕 Désactiver les notifications par email
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Alizé - Mise à jour</title>
    </head>
    <body style="margin:0;padding:0;background-color:#F3F4F6;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
              <!-- Header -->
              <tr>
                <td style="padding:28px 32px 20px 32px;border-bottom:1px solid #E5E7EB;">
                  <div style="font-family:Inter,Arial,sans-serif;font-size:24px;font-weight:700;color:#0EA5E9;">🌬️ ALIZÉ</div>
                </td>
              </tr>

              <!-- Greeting -->
              <tr>
                <td style="padding:28px 32px 0 32px;">
                  <div style="font-family:Inter,Arial,sans-serif;font-size:18px;color:#111827;">
                    👋 {html.escape(greeting)},
                  </div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding:24px 32px;text-align:center;">
                  <div style="font-size:48px;margin-bottom:16px;">🔍</div>
                  <div style="font-family:Inter,Arial,sans-serif;font-weight:700;font-size:18px;color:#111827;margin-bottom:12px;">
                    Aucune nouvelle offre trouvée
                  </div>
                  <div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#6B7280;line-height:1.6;max-width:380px;margin:0 auto;">
                    Nous continuons à surveiller les offres selon vos critères.
                    Vous recevrez un email dès que de nouvelles opportunités seront disponibles.
                  </div>
                </td>
              </tr>

              <!-- Tip -->
              <tr>
                <td style="padding:0 32px 24px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;">
                    <tr>
                      <td style="padding:14px 16px;">
                        <div style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#0369A1;line-height:1.5;">
                          💡 <strong>Conseil :</strong> Mettez à jour votre CV ou vos préférences pour élargir la recherche et recevoir plus d'offres.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA Button -->
              <tr>
                <td style="padding:0 32px 24px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <a href="{html.escape(frontend_url)}/preferences" style="display:inline-block;background:linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%);color:#FFFFFF;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none;box-shadow:0 4px 14px rgba(14,165,233,0.35);">
                          ⚙️ Modifier mes préférences
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Unsubscribe Section -->
              {unsubscribe_section}

              <!-- Footer -->
              <tr>
                <td style="padding:24px 32px;border-top:1px solid #E5E7EB;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <div style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#6B7280;line-height:1.6;">
                          Alizé - Votre assistant emploi intelligent<br>
                          <span style="color:#9CA3AF;">© 2024 Gen0S7</span>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """
    return text, html_content


def send_email_via_resend(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    max_retries: int = 3,
) -> bool:
    """Envoie un email via l'API Resend."""
    api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM")
    if not api_key or not from_email or not to_email:
        if not api_key:
            log.warning("Resend skipped: RESEND_API_KEY not configured")
        elif not from_email:
            log.warning("Resend skipped: RESEND_FROM not configured")
        elif not to_email:
            log.warning("Resend skipped: no recipient email")
        return False

    log.info("Resend: sending email to %s from %s", to_email, from_email)

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "text": body_text,
    }
    if body_html:
        payload["html"] = body_html
    data = json.dumps(payload).encode("utf-8")

    last_error = None
    for attempt in range(max_retries):
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
                _ = resp.read()
                log.info("Resend notification sent to %s (status=%s)", to_email, resp.status)
                return True
        except HTTPError as exc:
            error_body = ""
            try:
                error_body = exc.read().decode("utf-8")
            except Exception:
                pass
            log.error("Resend API error (attempt %d/%d): status=%s body=%s", attempt + 1, max_retries, exc.code, error_body)
            last_error = f"HTTP {exc.code}: {error_body}"
            if 400 <= exc.code < 500 and exc.code != 429:
                return False
        except Exception as exc:
            log.error("Resend error (attempt %d/%d): %s", attempt + 1, max_retries, exc)
            last_error = str(exc)

        if attempt < max_retries - 1:
            time.sleep(2 ** attempt)

    log.error("Resend failed after %d attempts: %s", max_retries, last_error)
    return False


def send_email_via_smtp(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    max_retries: int = 3,
) -> bool:
    """Envoie un email via SMTP."""
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port_str = os.getenv("SMTP_PORT", "587")
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)
    smtp_use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"

    if not smtp_host or not smtp_user or not smtp_pass or not to_email:
        if not smtp_host:
            log.warning("SMTP skipped: SMTP_HOST not configured")
        elif not smtp_user:
            log.warning("SMTP skipped: SMTP_USER not configured")
        elif not smtp_pass:
            log.warning("SMTP skipped: SMTP_PASS not configured")
        elif not to_email:
            log.warning("SMTP skipped: no recipient email")
        return False

    try:
        smtp_port = int(smtp_port_str)
    except ValueError:
        log.error("SMTP skipped: invalid SMTP_PORT value '%s'", smtp_port_str)
        return False

    msg = EmailMessage()
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    context = ssl.create_default_context()

    for attempt in range(max_retries):
        try:
            if smtp_use_ssl or smtp_port == 465:
                with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=30) as server:
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
                    server.ehlo()
                    if server.has_extn("STARTTLS"):
                        server.starttls(context=context)
                        server.ehlo()
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)

            log.info("Email sent to %s via SMTP", to_email)
            return True

        except smtplib.SMTPAuthenticationError:
            return False
        except Exception as exc:
            log.error("SMTP error (attempt %d/%d): %s", attempt + 1, max_retries, exc)
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)

    return False


def send_email_notification(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
) -> bool:
    """Envoie une notification email (Resend puis SMTP)."""
    if send_email_via_resend(to_email, subject, body_text, body_html):
        return True
    if send_email_via_smtp(to_email, subject, body_text, body_html):
        return True
    log.error("Email notification failed for %s - neither Resend nor SMTP succeeded", to_email)
    return False


def send_slack_notification(text: str) -> bool:
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        return False
    data = json.dumps({"text": text}).encode("utf-8")
    req = urlrequest.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlrequest.urlopen(req, timeout=5):
            log.info("Slack notification sent")
            return True
    except Exception as exc:
        log.error("Slack notification failed: %s", exc)
    return False


def _as_aware(dt: Optional[datetime]) -> datetime:
    """Assure que le datetime est aware (UTC)."""
    if not dt:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def notify_all_users(db: Session, matches_func, refresh: bool = False):
    """
    Parcourt les utilisateurs et :
    1. Lance une recherche automatique si le délai de 3 jours est passé
    2. Envoie un email avec les 5 meilleures offres non consultées
    """
    from sqlalchemy import func

    now = datetime.now(timezone.utc)
    # Uniquement les utilisateurs avec notifications activées
    users = db.query(User).filter(User.notifications_enabled.is_(True)).all()
    if not users:
        log.info("No users with notifications enabled")
        return

    log.info("Processing %d users for notifications (refresh=%s)", len(users), refresh)

    for user in users:
        try:
            # Récupérer les préférences
            pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
            frequency = (pref.notification_frequency if pref else None) or "every_3_days"
            cooldown = timedelta(minutes=FREQUENCY_MINUTES.get(frequency, NOTIFY_INTERVAL_MINUTES))

            # Vérifier le cooldown (basé sur last_search_at, pas last_email_at)
            # Cela évite de relancer des recherches trop fréquemment même si aucun email n'est envoyé
            if pref and pref.last_search_at:
                last_search = _as_aware(pref.last_search_at)
                if now < last_search + cooldown:
                    log.info("Skip user=%s cooldown not reached (last_search=%s)", user.email, last_search)
                    continue

            # Lancer une nouvelle recherche si refresh=True
            if refresh:
                pref = get_or_create_pref(user, db)
                try:
                    result = search_jobs_for_user(db, user.id, pref, force=True)
                    log.info("Job search user=%s inserted=%s", user.email, result.get("inserted"))

                    # Enregistrer la recherche
                    run_entry = JobSearchRun(
                        user_id=user.id,
                        inserted=result.get("inserted", 0),
                        tried_queries=json.dumps(result.get("tried_queries", [])),
                        sources=json.dumps(result.get("sources", {})),
                        created_at=now,
                        analysis_json=json.dumps(result.get("analysis", {})),
                    )
                    db.add(run_entry)

                    # Ajouter les jobs au dashboard de l'utilisateur
                    if result.get("inserted", 0) > 0:
                        # Récupérer les jobs insérés
                        user_cv = cv_keywords(db, user.id)
                        recent_jobs = (
                            db.query(JobListing)
                            .order_by(JobListing.created_at.desc())
                            .limit(result.get("inserted", 0))
                            .all()
                        )
                        add_jobs_to_user_dashboard(db, user.id, recent_jobs, pref, user_cv)

                    # Mettre à jour la date de dernière recherche
                    if pref:
                        pref.last_search_at = now
                        db.add(pref)

                    # Mise en cache de l'analyse
                    cache = db.query(UserAnalysisCache).filter(UserAnalysisCache.user_id == user.id).first()
                    if cache:
                        cache.analysis_json = json.dumps(result.get("analysis", {}))
                        cache.updated_at = now
                    else:
                        db.add(UserAnalysisCache(
                            user_id=user.id,
                            analysis_json=json.dumps(result.get("analysis", {})),
                            updated_at=now
                        ))

                    # Garder seulement les 8 dernières recherches
                    stale = (
                        db.query(JobSearchRun)
                        .filter(JobSearchRun.user_id == user.id)
                        .order_by(JobSearchRun.created_at.desc())
                        .offset(8)
                        .all()
                    )
                    for r in stale:
                        db.delete(r)

                    db.commit()

                except Exception as exc:
                    log.error("Job search failed for user %s: %s", user.email, exc)

            # Récupérer les meilleures offres non consultées et non notifiées
            max_jobs = getattr(pref, 'notification_max_jobs', 5) or 5
            top_jobs = get_top_unnotified_jobs(db, user.id, limit=max_jobs)
            log.info("User=%s found %d unnotified jobs to send", user.email, len(top_jobs))

            # Préparer les paramètres pour le template d'email
            unsubscribe_token = get_or_create_unsubscribe_token(user, db)
            backend_url = os.getenv("BACKEND_URL", os.getenv("FRONTEND_URL", "https://alize.app").replace(":3000", ":8000"))
            unsubscribe_url = f"{backend_url}/notify/unsubscribe/{unsubscribe_token}"

            email_sent = False
            if not top_jobs:
                if pref is None or pref.send_empty_digest:
                    # Envoyer un email vide si aucune offre
                    log.info("User=%s no jobs, sending empty digest", user.email)
                    empty_text, empty_html = build_empty_notification_body(
                        frequency=frequency,
                        unsubscribe_url=unsubscribe_url,
                    )
                    to_email = os.getenv("NOTIFY_EMAIL_TO") or user.email
                    email_sent = send_email_notification(to_email, "Vos offres Alizé", empty_text, empty_html)
                else:
                    log.info("User=%s no jobs and send_empty_digest=False, skipping", user.email)
            else:
                # Construire la liste des offres pour l'email
                jobs_data = []
                for user_job, job in top_jobs:
                    jobs_data.append({
                        "id": job.id,
                        "title": job.title,
                        "company": job.company,
                        "location": job.location,
                        "url": job.url,
                        "score": user_job.score,
                    })

                # Envoyer l'email
                body_text, body_html = build_notification_body(
                    jobs_data,
                    frequency=frequency,
                    unsubscribe_url=unsubscribe_url,
                )
                to_email = os.getenv("NOTIFY_EMAIL_TO") or user.email
                job_count = len(jobs_data)
                subject = f"🎯 Vos {job_count} meilleures offres Alizé" if job_count > 1 else "🎯 Votre meilleure offre Alizé"
                log.info("User=%s sending email with %d jobs to %s", user.email, job_count, to_email)
                success = send_email_notification(to_email, subject, body_text, body_html)
                email_sent = success
                log.info("User=%s email send result: %s", user.email, success)
                if success:
                    # Marquer les offres comme notifiées
                    for user_job, _ in top_jobs:
                        user_job.notified_at = now
                    db.commit()

                    send_slack_notification(body_text)

            # Mettre à jour la date du dernier email seulement si un email a été envoyé
            if pref and email_sent:
                pref.last_email_at = now
                db.add(pref)
                db.commit()

            if email_sent:
                log.info("Notification sent to user=%s jobs=%d", user.email, len(top_jobs))
            else:
                log.info("Notification skipped for user=%s (no email sent)", user.email)

        except Exception as exc:
            log.error("Failed to notify user %s: %s", user.email, exc)
