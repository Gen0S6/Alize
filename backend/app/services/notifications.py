import html
import json
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional
from urllib import request as urlrequest

from sqlalchemy.orm import Session

from app.schemas import JobOut
from app.models import User, UserJobNotification, UserJobVisit, JobListing
from app.ai import search_jobs_for_user
from app.services.preferences import get_or_create_pref
from app.services.matching import cv_keywords, is_job_url_alive

log = logging.getLogger("alize.notifications")


def format_matches(matches: list[JobOut]) -> str:
    lines = []
    for m in matches:
        lines.append(f"- {m.title} @ {m.company} ({m.location or 'N/A'}) [{m.url}] score {m.score}")
    return "\n".join(lines) if lines else "Aucun match pour le moment."


def format_matches_html(matches: list[JobOut]) -> str:
    if not matches:
        return "<p style='color:#475467;font-family:Inter,Arial,sans-serif;'>Aucun match pour le moment.</p>"
    cards = []
    for m in matches:
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


def build_notification_body(matches: list[JobOut]) -> tuple[str, str]:
    unsubscribe_url = os.getenv("NOTIFY_UNSUBSCRIBE_URL")
    top = sorted(matches, key=lambda m: m.score or 0, reverse=True)[:5]
    count = len(matches)
    header = f"Résumé des matches ({count})"
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
          Voici jusqu'à 5 opportunités les mieux scorées pour toi.
        </div>
        <div style="margin-top:14px;">{format_matches_html(top)}</div>
        <div style="margin-top:18px;font-size:12px;color:#9CA3AF;">Built by Gen0S7's members{'' if unsubscribe_url else ''}</div>
        {footer_unsub}
      </div>
    </div>
    """
    return text_body, html_body


def send_email_via_resend(to_email: str, subject: str, body_text: str, body_html: Optional[str] = None) -> bool:
    api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM")
    if not (api_key and from_email and to_email):
        return False
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "text": body_text,
    }
    if body_html:
        payload["html"] = body_html
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
        with urlrequest.urlopen(req, timeout=8) as resp:  # nosec
            if 200 <= resp.status < 300:
                log.info("Resend notification sent to %s", to_email)
                return True
            log.error("Resend returned status %s for %s", resp.status, to_email)
    except Exception as exc:
        log.error("Failed to send via Resend: %s", exc)
    return False


def send_email_notification(to_email: str, subject: str, body_text: str, body_html: Optional[str] = None):
    if send_email_via_resend(to_email, subject, body_text, body_html):
        return

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")

    if not (smtp_host and smtp_user and smtp_pass and to_email):
        log.info("Email notification skipped (missing SMTP/Resend config)")
        return
    msg = EmailMessage()
    msg["From"] = smtp_user
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")
    context = ssl.create_default_context()
    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls(context=context)
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        log.info("Email notification sent to %s via SMTP", to_email)
    except Exception as exc:
        log.error("Failed to send email via SMTP: %s", exc)


def send_slack_notification(text: str):
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        log.info("Slack notification skipped (missing webhook)")
        return
    data = json.dumps({"text": text}).encode("utf-8")
    req = urlrequest.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlrequest.urlopen(req, timeout=5):  # nosec
            log.info("Slack notification sent")
    except Exception as exc:
        log.error("Failed to send slack notification: %s", exc)


def notify_all_users(db: Session, matches_func, refresh: bool = False):
    users = db.query(User).all()
    for user in users:
        try:
            if not user.notifications_enabled:
                continue
            if refresh:
                pref = get_or_create_pref(user, db)
                search_jobs_for_user(db, user.id, pref, force=False)
            matches_list = matches_func(user, db)
            total_before_filter = len(matches_list)
            # retire les offres expirées
            cleaned_matches: list[JobOut] = []
            for m in matches_list:
                if not m.id or not m.url:
                    continue
                job = db.query(JobListing).filter(JobListing.id == m.id).first()
                if job and not is_job_url_alive(job.url):
                    db.delete(job)
                    continue
                cleaned_matches.append(m)
            matches_list = cleaned_matches
            total_before_filter = len(matches_list)
            # skip already notified offers for this user
            job_ids = [m.id for m in matches_list if m.id]
            if job_ids:
                existing = {
                    row[0]
                    for row in db.query(UserJobNotification.job_id)
                    .filter(UserJobNotification.user_id == user.id, UserJobNotification.job_id.in_(job_ids))
                    .all()
                }
                matches_list = [m for m in matches_list if m.id and m.id not in existing]
            # skip offres déjà visitées
            if job_ids:
                visited_ids = {
                    row[0]
                    for row in db.query(UserJobVisit.job_id)
                    .filter(UserJobVisit.user_id == user.id, UserJobVisit.job_id.in_(job_ids))
                    .all()
                }
                if visited_ids:
                    matches_list = [m for m in matches_list if m.id and m.id not in visited_ids]
            if not matches_list:
                if total_before_filter == 0:
                    send_email_notification(
                        os.getenv("NOTIFY_EMAIL_TO") or user.email,
                        "Vos matches Alizè",
                        "Aucune nouvelle offre pour le moment. On relance régulièrement.",
                        "<p style='font-family:Inter,Arial,sans-serif;color:#4B5563;font-size:14px;'>Aucune nouvelle offre pour le moment. On relance régulièrement.</p>",
                    )
                continue
            body_text, body_html = build_notification_body(matches_list)
            to_email = os.getenv("NOTIFY_EMAIL_TO") or user.email
            send_email_notification(to_email, "Vos matches Alizè", body_text, body_html)
            send_slack_notification(body_text)
            # record notified jobs to avoid duplicates
            for m in matches_list:
                if not m.id:
                    continue
                db.add(UserJobNotification(user_id=user.id, job_id=m.id))
            db.commit()
        except Exception as exc:
            log.error("Failed to notify user %s: %s", user.email, exc)
