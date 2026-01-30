import html
import json
import logging
import os
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
    """Format des offres en HTML."""
    if not matches:
        return "<p style='color:#475467;font-family:Inter,Arial,sans-serif;'>Aucun match pour le moment.</p>"
    cards = []
    for m in matches:
        if isinstance(m, dict):
            title = html.escape(m.get("title", "Sans titre"))
            company = html.escape(m.get("company", "N/A"))
            location = html.escape(m.get("location", "N/A"))
            url = html.escape(m.get("url", "#"))
            score = html.escape(str(m.get("score", "?")))
        else:
            title = html.escape(m.title or "Sans titre")
            company = html.escape(m.company or "N/A")
            location = html.escape(m.location or "N/A")
            url = html.escape(m.url or "#")
            score = html.escape(str(m.score) if m.score is not None else "?")
        cards.append(
            f"""
            <a href="{url}" style="text-decoration:none;color:#111827;">
              <div style="border:1px solid #E5E7EB;border-radius:12px;padding:12px 14px;margin-bottom:8px;background:#FFFFFF;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                  <div style="font-weight:600;font-size:14px;">{title}</div>
                  <span style="background:#ECFDF3;color:#16A34A;font-weight:600;font-size:11px;padding:2px 8px;border-radius:999px;">{score}/10</span>
                </div>
                <div style="margin-top:4px;color:#4B5563;font-size:13px;">{company} • {location}</div>
              </div>
            </a>
            """
        )
    return "".join(cards)


def build_notification_body(matches: list) -> tuple[str, str]:
    """Construit le corps de l'email avec les meilleures offres."""
    unsubscribe_url = os.getenv("NOTIFY_UNSUBSCRIBE_URL")

    # Trier par score (la limite est déjà appliquée par l'appelant)
    if isinstance(matches[0], dict) if matches else False:
        top = sorted(matches, key=lambda m: m.get("score", 0) or 0, reverse=True)
    else:
        top = sorted(matches, key=lambda m: m.score or 0, reverse=True)

    count = len(top)
    header = f"Vos {count} meilleures offres"
    text_body = header + ":\n" + format_matches(top)
    if unsubscribe_url:
        text_body += f"\n\nSe désinscrire: {unsubscribe_url}"

    footer_unsub = (
        f"<div style='margin-top:12px;'><a href='{html.escape(unsubscribe_url)}' style='color:#6B7280;font-size:11px;'>Se désinscrire</a></div>"
        if unsubscribe_url
        else ""
    )
    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:720px;margin:0 auto;background:#F3F4F6;padding:20px;">
      <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:18px;padding:20px;">
        <div style="font-weight:700;font-size:16px;color:#111827;">{html.escape(header)}</div>
        <div style="margin-top:8px;color:#4B5563;font-size:13px;line-height:1.5;">
          Voici vos meilleures opportunités non encore consultées.
        </div>
        <div style="margin-top:14px;">{format_matches_html(top)}</div>
        <div style="margin-top:18px;font-size:12px;color:#9CA3AF;">Built by Gen0S7's members</div>
        {footer_unsub}
      </div>
    </div>
    """
    return text_body, html_body


def build_empty_notification_body() -> tuple[str, str]:
    text = "Aucune nouvelle offre pour le moment. On relance régulièrement."
    html_content = """
    <div style="font-family:Inter,Arial,sans-serif;max-width:720px;margin:0 auto;background:#F3F4F6;padding:20px;">
      <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:18px;padding:20px;text-align:center;">
        <div style="font-weight:700;font-size:16px;color:#111827;">Aucune nouvelle offre trouvée</div>
        <p style="margin-top:10px;color:#4B5563;font-size:13px;line-height:1.6;">
          Nous continuons à surveiller les offres selon vos critères.
          Vous recevrez un email dès que de nouvelles opportunités seront disponibles.
        </p>
        <div style="margin-top:14px;display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border:1px solid #E5E7EB;border-radius:12px;background:#F9FAFB;color:#374151;font-size:13px;">
          <span style="font-weight:600;">Conseil :</span>
          Mettez à jour votre CV ou vos préférences pour élargir la recherche.
        </div>
      </div>
    </div>
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
            },
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=15) as resp:
                _ = resp.read()
                log.info("Resend notification sent to %s (status=%s)", to_email, resp.status)
                return True
        except HTTPError as exc:
            log.error("Resend API error (attempt %d/%d): status=%s", attempt + 1, max_retries, exc.code)
            last_error = exc
            if 400 <= exc.code < 500 and exc.code != 429:
                return False
        except Exception as exc:
            log.error("Resend error (attempt %d/%d): %s", attempt + 1, max_retries, exc)
            last_error = exc

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

            email_sent = False
            if not top_jobs:
                if pref is None or pref.send_empty_digest:
                    # Envoyer un email vide si aucune offre
                    log.info("User=%s no jobs, sending empty digest", user.email)
                    empty_text, empty_html = build_empty_notification_body()
                    to_email = os.getenv("NOTIFY_EMAIL_TO") or user.email
                    email_sent = send_email_notification(to_email, "Vos offres Alizè", empty_text, empty_html)
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
                body_text, body_html = build_notification_body(jobs_data)
                to_email = os.getenv("NOTIFY_EMAIL_TO") or user.email
                job_count = len(jobs_data)
                subject = f"Vos {job_count} meilleures offres Alizè" if job_count > 1 else "Votre meilleure offre Alizè"
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
