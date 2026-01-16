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
    UserJobNotification,
    UserJobVisit,
    JobListing,
    CV,
    UserPreference,
    JobSearchRun,
    UserAnalysisCache,
    JobSearchCampaign,
    CampaignJob,
    CampaignEmailTemplate,
)
load_dotenv()

from app.ai import search_jobs_for_user
from app.services.preferences import get_or_create_pref
from app.services.matching import cv_keywords

log = logging.getLogger("alize.notifications")
NOTIFY_INTERVAL_MINUTES = int(os.getenv("NOTIFY_INTERVAL_MINUTES", "4320"))  # default 72h


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


def build_empty_notification_body() -> tuple[str, str]:
    text = "Aucune nouvelle offre pour le moment. On relance régulièrement."
    html = """
    <div style="font-family:Inter,Arial,sans-serif;max-width:720px;margin:0 auto;background:#F3F4F6;padding:20px;">
      <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:18px;padding:20px;text-align:center;">
        <div style="font-weight:700;font-size:16px;color:#111827;">Aucune nouvelle offre trouvée</div>
        <p style="margin-top:10px;color:#4B5563;font-size:13px;line-height:1.6;">
          Nous continuons à relancer les sources et à surveiller tes critères.
          Tu recevras un email dès que de nouvelles opportunités seront disponibles.
        </p>
        <div style="margin-top:14px;display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border:1px solid #E5E7EB;border-radius:12px;background:#F9FAFB;color:#374151;font-size:13px;">
          <span style="font-weight:600;">Conseil :</span>
          Mets à jour ton CV ou tes préférences pour élargir la recherche.
        </div>
      </div>
    </div>
    """
    return text, html


def send_email_via_resend(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    max_retries: int = 3,
) -> bool:
    """
    Send an email via Resend API with retry logic for transient failures.
    """
    api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM")
    if not api_key:
        log.debug("Resend API key not configured, skipping Resend")
        return False
    if not from_email:
        log.warning("RESEND_FROM not configured, skipping Resend")
        return False
    if not to_email:
        log.warning("No recipient email provided for Resend")
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
            with urlrequest.urlopen(req, timeout=15) as resp:  # nosec
                _ = resp.read()  # consume response
                log.info("Resend notification sent to %s (status=%s)", to_email, resp.status)
                return True
        except HTTPError as exc:
            # HTTPError is raised for 4xx/5xx responses
            try:
                error_body = exc.read().decode("utf-8")
            except Exception:
                error_body = "<could not read error body>"
            log.error(
                "Resend API error (attempt %d/%d): status=%s reason=%s body=%s",
                attempt + 1,
                max_retries,
                exc.code,
                exc.reason,
                error_body,
            )
            last_error = exc
            # Don't retry on client errors (4xx) except 429 (rate limit)
            if 400 <= exc.code < 500 and exc.code != 429:
                log.error("Resend rejected email to %s: not retrying client error", to_email)
                return False
        except URLError as exc:
            # Network-level errors (DNS, connection refused, etc.)
            log.warning(
                "Resend network error (attempt %d/%d): %s",
                attempt + 1,
                max_retries,
                exc.reason,
            )
            last_error = exc
        except Exception as exc:
            log.error(
                "Resend unexpected error (attempt %d/%d): %s",
                attempt + 1,
                max_retries,
                exc,
            )
            last_error = exc

        # Exponential backoff before retry
        if attempt < max_retries - 1:
            wait_time = 2 ** attempt  # 1s, 2s, 4s
            log.info("Retrying Resend in %ds...", wait_time)
            time.sleep(wait_time)

    log.error("Resend failed after %d attempts for %s: %s", max_retries, to_email, last_error)
    return False


def send_email_via_smtp(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    max_retries: int = 3,
) -> bool:
    """
    Send an email via SMTP with retry logic and support for both STARTTLS and SSL.
    """
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port_str = os.getenv("SMTP_PORT", "587")
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)  # Allow separate FROM address
    smtp_use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"

    if not smtp_host:
        log.debug("SMTP_HOST not configured, skipping SMTP")
        return False
    if not smtp_user or not smtp_pass:
        log.warning("SMTP credentials not configured (SMTP_USER/SMTP_PASS)")
        return False
    if not to_email:
        log.warning("No recipient email provided for SMTP")
        return False

    try:
        smtp_port = int(smtp_port_str)
    except ValueError:
        log.error("Invalid SMTP_PORT value: %s", smtp_port_str)
        return False

    msg = EmailMessage()
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    context = ssl.create_default_context()
    last_error = None

    for attempt in range(max_retries):
        try:
            if smtp_use_ssl or smtp_port == 465:
                # Use SMTP_SSL for port 465 (implicit SSL)
                with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=30) as server:
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
            else:
                # Use STARTTLS for port 587 or other ports
                with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
                    server.ehlo()
                    if server.has_extn("STARTTLS"):
                        server.starttls(context=context)
                        server.ehlo()
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)

            log.info("Email notification sent to %s via SMTP", to_email)
            return True

        except smtplib.SMTPAuthenticationError as exc:
            log.error("SMTP authentication failed: %s", exc)
            return False  # Don't retry auth failures

        except smtplib.SMTPRecipientsRefused as exc:
            log.error("SMTP recipient refused for %s: %s", to_email, exc)
            return False  # Don't retry recipient errors

        except smtplib.SMTPSenderRefused as exc:
            log.error("SMTP sender refused (%s): %s", smtp_from, exc)
            return False  # Don't retry sender errors

        except (smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError, OSError) as exc:
            log.warning(
                "SMTP connection error (attempt %d/%d): %s",
                attempt + 1,
                max_retries,
                exc,
            )
            last_error = exc

        except smtplib.SMTPException as exc:
            log.error(
                "SMTP error (attempt %d/%d): %s",
                attempt + 1,
                max_retries,
                exc,
            )
            last_error = exc

        except Exception as exc:
            log.error(
                "Unexpected SMTP error (attempt %d/%d): %s",
                attempt + 1,
                max_retries,
                exc,
            )
            last_error = exc

        # Exponential backoff before retry
        if attempt < max_retries - 1:
            wait_time = 2 ** attempt  # 1s, 2s, 4s
            log.info("Retrying SMTP in %ds...", wait_time)
            time.sleep(wait_time)

    log.error("SMTP failed after %d attempts for %s: %s", max_retries, to_email, last_error)
    return False


def send_email_notification(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
) -> bool:
    """
    Send an email notification, trying Resend first, then falling back to SMTP.
    Returns True if the email was sent successfully via either method.
    """
    # Try Resend first (preferred method)
    if send_email_via_resend(to_email, subject, body_text, body_html):
        return True

    # Fall back to SMTP
    if send_email_via_smtp(to_email, subject, body_text, body_html):
        return True

    log.error("Email notification failed for %s: no working delivery method", to_email)
    return False


def send_slack_notification(text: str) -> bool:
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        log.info("Slack notification skipped (missing webhook)")
        return False
    data = json.dumps({"text": text}).encode("utf-8")
    req = urlrequest.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlrequest.urlopen(req, timeout=5):  # nosec
            log.info("Slack notification sent")
            return True
    except Exception as exc:
        log.error("Failed to send slack notification: %s", exc)
    return False


def _as_aware(dt: Optional[datetime]) -> datetime:
    """
    Ensure datetime is timezone-aware in UTC to avoid naive/aware comparison issues.
    """
    if not dt:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def notify_all_users(db: Session, matches_func, refresh: bool = False):
    """
    Parcourt les utilisateurs et envoie les notifications si le délai depuis
    la dernière activité (CV ou préférences) est supérieur au cooldown.
    Le cooldown repart à zéro quand le CV ou les préférences changent.

    Optimized to batch-load user data to avoid N+1 queries.
    """
    from sqlalchemy import func
    from sqlalchemy.orm import aliased

    now = datetime.now(timezone.utc)
    cooldown = timedelta(minutes=NOTIFY_INTERVAL_MINUTES)

    # Only fetch users with notifications enabled
    users = db.query(User).filter(User.notifications_enabled == True).all()  # noqa: E712
    if not users:
        log.info("Scheduler notify run: no users with notifications enabled")
        return

    user_ids = [u.id for u in users]
    log.info("Scheduler notify run started users=%s refresh=%s", len(users), refresh)

    # Batch load latest CV for each user (using subquery for max id per user)
    cv_subq = (
        db.query(CV.user_id, func.max(CV.id).label("max_id"))
        .filter(CV.user_id.in_(user_ids))
        .group_by(CV.user_id)
        .subquery()
    )
    latest_cvs = (
        db.query(CV)
        .join(cv_subq, (CV.user_id == cv_subq.c.user_id) & (CV.id == cv_subq.c.max_id))
        .all()
    )
    cv_by_user = {cv.user_id: cv for cv in latest_cvs}

    # Batch load latest preference for each user
    pref_subq = (
        db.query(UserPreference.user_id, func.max(UserPreference.id).label("max_id"))
        .filter(UserPreference.user_id.in_(user_ids))
        .group_by(UserPreference.user_id)
        .subquery()
    )
    latest_prefs = (
        db.query(UserPreference)
        .join(pref_subq, (UserPreference.user_id == pref_subq.c.user_id) & (UserPreference.id == pref_subq.c.max_id))
        .all()
    )
    pref_by_user = {pref.user_id: pref for pref in latest_prefs}

    # Batch load latest notification for each user
    notif_subq = (
        db.query(UserJobNotification.user_id, func.max(UserJobNotification.id).label("max_id"))
        .filter(UserJobNotification.user_id.in_(user_ids))
        .group_by(UserJobNotification.user_id)
        .subquery()
    )
    latest_notifs = (
        db.query(UserJobNotification)
        .join(notif_subq, (UserJobNotification.user_id == notif_subq.c.user_id) & (UserJobNotification.id == notif_subq.c.max_id))
        .all()
    )
    notif_by_user = {notif.user_id: notif for notif in latest_notifs}

    # Batch load latest job search run for each user
    run_subq = (
        db.query(JobSearchRun.user_id, func.max(JobSearchRun.id).label("max_id"))
        .filter(JobSearchRun.user_id.in_(user_ids))
        .group_by(JobSearchRun.user_id)
        .subquery()
    )
    latest_runs = (
        db.query(JobSearchRun)
        .join(run_subq, (JobSearchRun.user_id == run_subq.c.user_id) & (JobSearchRun.id == run_subq.c.max_id))
        .all()
    )
    run_by_user = {run.user_id: run for run in latest_runs}

    for user in users:
        result = None
        try:
            # Use pre-loaded data instead of querying per user
            last_cv = cv_by_user.get(user.id)
            last_pref = pref_by_user.get(user.id)

            last_activity = _as_aware(user.created_at)
            if last_cv:
                last_activity = max(last_activity, _as_aware(last_cv.created_at))
            if last_pref:
                last_activity = max(last_activity, _as_aware(last_pref.updated_at))

            last_notif_row = notif_by_user.get(user.id)
            last_run_row = run_by_user.get(user.id)
            last_notif = _as_aware(last_notif_row.notified_at) if last_notif_row else None
            last_run_time = _as_aware(last_run_row.created_at) if last_run_row else None
            candidates = [last_activity]
            if last_notif:
                candidates.append(last_notif)
            if last_run_time:
                candidates.append(last_run_time)
            wait_anchor = max(candidates)
            if now < wait_anchor + cooldown:
                log.info("Skip user=%s cooldown not reached (now=%s anchor=%s cooldown=%s)", user.email, now, wait_anchor, cooldown)
                continue
            if refresh:
                pref = get_or_create_pref(user, db)
                try:
                    result = search_jobs_for_user(db, user.id, pref, force=True)
                    log.info("Job search (scheduler) user=%s inserted=%s tried=%s", user.email, result.get("inserted"), result.get("tried_queries"))
                except Exception as exc:
                    log.error("Job search failed for user %s: %s", user.email, exc)
                    result = {"inserted": 0, "tried_queries": [], "sources": {}, "analysis": {}}
                try:
                    run_entry = JobSearchRun(
                        user_id=user.id,
                        inserted=result.get("inserted", 0),
                        tried_queries=json.dumps(result.get("tried_queries", [])),
                        sources=json.dumps(result.get("sources", {})),
                        created_at=datetime.now(timezone.utc),
                        analysis_json=json.dumps(result.get("analysis", {})),
                    )
                    db.add(run_entry)
                    db.commit()
                    cache = db.query(UserAnalysisCache).filter(UserAnalysisCache.user_id == user.id).first()
                    now_cache = datetime.now(timezone.utc)
                    if cache:
                        cache.analysis_json = json.dumps(result.get("analysis", {}))
                        cache.updated_at = now_cache
                        db.add(cache)
                    else:
                        db.add(UserAnalysisCache(user_id=user.id, analysis_json=json.dumps(result.get("analysis", {})), updated_at=now_cache))
                    db.commit()
                    stale = (
                        db.query(JobSearchRun)
                        .filter(JobSearchRun.user_id == user.id)
                        .order_by(JobSearchRun.created_at.desc(), JobSearchRun.id.desc())
                        .offset(8)
                        .all()
                    )
                    for r in stale:
                        db.delete(r)
                    db.commit()
                except Exception as exc:
                    log.error("Failed to record job search run for user %s: %s", user.email, exc)
            matches_list = matches_func(user, db)
            log.info("Scheduler matches for user=%s count=%s", user.email, len(matches_list))
            # Filter out matches without valid id/url (URL validation moved to separate background task)
            matches_list = [m for m in matches_list if m.id and m.url]
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
                # Envoie un mail même si aucune nouvelle offre (après déduplication ou absence totale)
                empty_text, empty_html = build_empty_notification_body()
                send_email_notification(
                    os.getenv("NOTIFY_EMAIL_TO") or user.email,
                    "Vos matches Alizè",
                    empty_text,
                    empty_html,
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


# ==================== Campaign-specific notifications ====================


def build_campaign_notification_body(
    campaign: JobSearchCampaign,
    jobs: list[dict],
    template: CampaignEmailTemplate = None,
) -> tuple[str, str]:
    """
    Build notification body for a specific campaign.
    Uses custom template if available, otherwise uses default format.
    """
    unsubscribe_url = os.getenv("NOTIFY_UNSUBSCRIBE_URL")
    campaign_name = html.escape(campaign.name)
    target_role = html.escape(campaign.target_role or "Tous postes")
    target_location = html.escape(campaign.target_location or "Partout")

    # Sort by score and take top 5
    top_jobs = sorted(jobs, key=lambda j: j.get("score", 0) or 0, reverse=True)[:5]
    count = len(jobs)

    # Build text version
    header = f"Campagne: {campaign.name} - {count} nouvelle(s) offre(s)"
    text_lines = [header, f"Poste ciblé: {target_role}", f"Localisation: {target_location}", ""]
    for job in top_jobs:
        text_lines.append(
            f"- {job.get('title', 'Sans titre')} @ {job.get('company', 'N/A')} "
            f"({job.get('location', 'N/A')}) [{job.get('url', '#')}] score {job.get('score', '?')}"
        )
    text_body = "\n".join(text_lines)
    if unsubscribe_url:
        text_body += f"\n\nSe désinscrire: {unsubscribe_url}"

    # Build HTML version
    job_cards = []
    for job in top_jobs:
        title = html.escape(job.get("title", "Sans titre"))
        company = html.escape(job.get("company", "N/A"))
        location = html.escape(job.get("location", "N/A"))
        url = html.escape(job.get("url", "#"))
        score = html.escape(str(job.get("score", "?")))
        job_cards.append(
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

    # Campaign color for header accent
    campaign_color = campaign.color or "#3B82F6"

    footer_unsub = (
        f"<div style='margin-top:12px;'><a href='{html.escape(unsubscribe_url)}' style='color:#6B7280;font-size:11px;'>Se désinscrire</a></div>"
        if unsubscribe_url
        else ""
    )

    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:720px;margin:0 auto;background:#F3F4F6;padding:20px;">
      <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:18px;padding:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <div style="width:10px;height:10px;border-radius:50%;background:{campaign_color};"></div>
          <div style="font-weight:700;font-size:16px;color:#111827;">{campaign_name}</div>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:12px;font-size:12px;color:#6B7280;">
          <span>Poste: {target_role}</span>
          <span>Lieu: {target_location}</span>
        </div>
        <div style="font-size:14px;color:#374151;margin-bottom:12px;">
          {count} nouvelle(s) offre(s) trouvée(s) pour cette campagne
        </div>
        <div style="margin-top:14px;">{"".join(job_cards)}</div>
        <div style="margin-top:18px;font-size:12px;color:#9CA3AF;">Built by Gen0S7's members</div>
        {footer_unsub}
      </div>
    </div>
    """
    return text_body, html_body


def notify_campaign_jobs(
    db: Session,
    user: User,
    campaign: JobSearchCampaign,
    new_jobs: list[dict],
) -> bool:
    """
    Send notification for new jobs in a specific campaign.
    Respects campaign's email notification settings.
    """
    if not campaign.email_notifications:
        log.debug("Campaign %s has notifications disabled", campaign.id)
        return False

    if not new_jobs:
        log.debug("No new jobs to notify for campaign %s", campaign.id)
        return False

    # Filter jobs by minimum score
    min_score = campaign.min_score_for_notification
    qualified_jobs = [j for j in new_jobs if (j.get("score") or 0) >= min_score]

    if not qualified_jobs:
        log.debug("No jobs meet minimum score %d for campaign %s", min_score, campaign.id)
        return False

    # Get custom template if exists
    template = db.query(CampaignEmailTemplate).filter(
        CampaignEmailTemplate.campaign_id == campaign.id,
        CampaignEmailTemplate.template_type == "notification",
        CampaignEmailTemplate.is_active == True,
    ).first()

    # Build email content
    text_body, html_body = build_campaign_notification_body(campaign, qualified_jobs, template)

    # Custom subject from template or default
    subject = f"[{campaign.name}] {len(qualified_jobs)} nouvelle(s) offre(s) d'emploi"
    if template and template.subject:
        subject = template.subject.format(
            campaign_name=campaign.name,
            job_count=len(qualified_jobs),
            target_role=campaign.target_role or "N/A",
        )

    to_email = os.getenv("NOTIFY_EMAIL_TO") or user.email

    success = send_email_notification(to_email, subject, text_body, html_body)

    if success:
        # Mark jobs as notified in the campaign
        now = datetime.now(timezone.utc)
        for job in qualified_jobs:
            job_id = job.get("id")
            if job_id:
                campaign_job = db.query(CampaignJob).filter(
                    CampaignJob.campaign_id == campaign.id,
                    CampaignJob.job_id == job_id,
                ).first()
                if campaign_job:
                    campaign_job.notified_at = now
        db.commit()
        log.info(
            "Campaign notification sent: campaign=%s user=%s jobs=%d",
            campaign.name,
            user.email,
            len(qualified_jobs),
        )

    return success


def notify_all_campaigns(db: Session):
    """
    Send notifications for all active campaigns that have pending notifications.
    Called by scheduler based on each campaign's email_frequency setting.
    """
    from sqlalchemy import func

    now = datetime.now(timezone.utc)

    # Get all active campaigns with notifications enabled
    campaigns = db.query(JobSearchCampaign).filter(
        JobSearchCampaign.is_active == True,
        JobSearchCampaign.email_notifications == True,
    ).all()

    log.info("Checking %d campaigns for notifications", len(campaigns))

    for campaign in campaigns:
        try:
            # Check frequency
            should_notify = False
            if campaign.email_frequency == "instant":
                should_notify = True
            elif campaign.email_frequency == "daily":
                # Check if last search was within 24h
                if campaign.last_search_at:
                    should_notify = (now - _as_aware(campaign.last_search_at)) >= timedelta(hours=24)
                else:
                    should_notify = True
            elif campaign.email_frequency == "weekly":
                if campaign.last_search_at:
                    should_notify = (now - _as_aware(campaign.last_search_at)) >= timedelta(days=7)
                else:
                    should_notify = True

            if not should_notify:
                continue

            # Get user
            user = db.query(User).filter(User.id == campaign.user_id).first()
            if not user or not user.notifications_enabled:
                continue

            # Get new jobs that haven't been notified yet
            new_jobs = db.query(CampaignJob, JobListing).join(
                JobListing, CampaignJob.job_id == JobListing.id
            ).filter(
                CampaignJob.campaign_id == campaign.id,
                CampaignJob.notified_at.is_(None),
                CampaignJob.status == "new",
            ).all()

            if not new_jobs:
                continue

            # Convert to dict format
            jobs_data = []
            for cj, job in new_jobs:
                jobs_data.append({
                    "id": job.id,
                    "title": job.title,
                    "company": job.company,
                    "location": job.location,
                    "url": job.url,
                    "score": cj.score,
                })

            notify_campaign_jobs(db, user, campaign, jobs_data)

        except Exception as exc:
            log.error("Failed to process campaign %s notifications: %s", campaign.id, exc)
