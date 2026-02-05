from datetime import datetime, timedelta, timezone
from typing import Optional, Literal
from urllib import request as urlrequest, error as urlerror
from collections import Counter
import re

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models import (
    CV,
    JobListing,
    UserPreference,
    UserJob,
)
from app.schemas import JobOut

NEW_BADGE_DAYS = 3
OLD_JOB_DAYS = 90  # Auto-delete jobs older than 90 days

# Common French/English stop words to ignore in CV analysis
STOP_WORDS = {
    # French
    "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "est", "sont",
    "pour", "dans", "sur", "avec", "par", "aux", "qui", "que", "cette", "ces",
    "son", "ses", "nous", "vous", "leur", "leurs", "plus", "tout", "tous", "très",
    "bien", "peut", "faire", "fait", "être", "avoir", "sans", "comme", "aussi",
    "entre", "après", "avant", "sous", "chez", "dont", "donc", "mais", "car",
    # English
    "the", "and", "for", "with", "from", "that", "this", "have", "has", "was",
    "were", "been", "being", "are", "will", "would", "could", "should", "can",
    "may", "might", "must", "shall", "into", "over", "such", "than", "then",
    "them", "these", "those", "what", "which", "when", "where", "while", "who",
    "how", "all", "each", "every", "both", "few", "more", "most", "other", "some",
    "any", "only", "own", "same", "just", "also", "now", "here", "there", "about",
    # Common non-technical words
    "année", "années", "ans", "mois", "jour", "jours", "experience", "expérience",
    "travail", "work", "job", "poste", "mission", "missions", "projet", "projets",
    "project", "projects", "team", "équipe", "client", "clients", "company",
    "entreprise", "société", "gestion", "management", "développement", "development",
}


def norm_list(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    return [item.strip().lower() for item in raw.split(",") if item.strip()]


def _extract_match_reasons(
    job: JobListing,
    pref: UserPreference,
    user_cv: set[str],
    max_items: int = 4,
) -> list[str]:
    text = f"{job.title} {job.company} {job.location or ''} {job.description or ''}".lower()
    title_lower = job.title.lower()
    location_lower = (job.location or "").lower()
    reasons: list[str] = []

    role = (pref.role or "").strip()
    if role:
        role_lower = role.lower()
        if role_lower in title_lower:
            reasons.append(f"Rôle: {role}")
        elif any(word in title_lower for word in role_lower.split() if len(word) > 3):
            reasons.append(f"Rôle proche: {role}")

    loc = (pref.location or "").strip()
    if loc:
        loc_words = [w.strip().lower() for w in loc.split(",") if w.strip()]
        if any(word in location_lower for word in loc_words):
            reasons.append(f"Localisation: {loc}")

    must = norm_list(pref.must_keywords)
    must_hits = [k for k in must if k in text][:2]
    reasons.extend([f"Mot-clé: {k}" for k in must_hits])

    if user_cv:
        cv_hits = [kw for kw in sorted(user_cv) if kw in text][:2]
        reasons.extend([f"CV: {kw}" for kw in cv_hits])

    return reasons[:max_items]


def cv_keywords(db: Session, user_id: int) -> set[str]:
    """Extract relevant keywords from CV using frequency analysis."""
    cv = (
        db.query(CV)
        .filter(CV.user_id == user_id)
        .order_by(CV.id.desc())
        .first()
    )
    if not cv or not cv.text:
        return set()

    # Clean and tokenize text
    text = cv.text.lower()
    # Keep alphanumeric and common tech characters (., +, #, ++)
    tokens = re.findall(r'[a-zàâäéèêëïîôùûüç0-9#+.]+', text)

    # Filter tokens
    filtered = [
        t for t in tokens
        if len(t) > 2
        and t not in STOP_WORDS
        and not t.isdigit()  # Exclude pure numbers
    ]

    # Count frequency and get most common
    counter = Counter(filtered)
    # Return top 40 most frequent relevant words
    return set(word for word, _ in counter.most_common(40))


def score_job(job: JobListing, pref: UserPreference, user_cv: set[str]) -> Optional[int]:
    """
    Score a job from 0-100 based on user preferences and CV.
    Returns None if job should be filtered out.

    Scoring strategy:
    - If no preferences are set, rely more on CV matching
    - Base score starts higher (40) to avoid all jobs being 2/10
    - Bonuses for matches, minimal penalties for non-matches when preferences are empty
    """
    text = f"{job.title} {job.company} {job.location or ''} {job.description or ''}".lower()
    title_lower = job.title.lower()
    location_lower = (job.location or "").lower()

    must = norm_list(pref.must_keywords)
    avoid = norm_list(pref.avoid_keywords)
    role = (pref.role or "").lower().strip()
    loc = (pref.location or "").lower().strip()
    contract_pref = (pref.contract_type or "").lower().strip()
    salary_floor = pref.salary_min

    # Hard filters - return None to exclude
    if avoid and any(k in text for k in avoid):
        return None

    if salary_floor:
        if job.salary_min is not None and job.salary_min < salary_floor:
            return None

    # Check if user has defined meaningful preferences
    has_preferences = bool(role or loc or must or contract_pref)

    # Start with base score - higher if no preferences (neutral starting point)
    score = 35 if has_preferences else 50

    # === Role matching (up to +25) ===
    if role:
        if role in title_lower:
            score += 25  # Exact role in title = strong match
        elif any(word in title_lower for word in role.split() if len(word) > 3):
            score += 15  # Partial role match
        else:
            score -= 5  # Role specified but not found = small penalty

    # === Location matching (up to +15) ===
    if loc:
        loc_words = [w.strip() for w in loc.split(",")]
        location_match = any(word in location_lower for word in loc_words if word)
        remote_wanted = any(term in loc.lower() for term in ["remote", "télétravail", "hybride"])
        remote_offered = "remote" in text or "télétravail" in text or "hybride" in text

        if location_match:
            score += 15  # Location matches
        elif remote_wanted and remote_offered:
            score += 12  # Remote wanted and offered
        # No penalty if location doesn't match - user might be flexible

    # === Must keywords (up to +20) ===
    if must:
        must_hits = sum(1 for k in must if k in text)
        must_ratio = must_hits / len(must) if must else 0
        if must_ratio >= 0.8:
            score += 20  # Most must keywords found
        elif must_ratio >= 0.5:
            score += 12  # Half found
        elif must_ratio > 0:
            score += must_hits * 3  # Some found
        else:
            score -= 5  # None of the must keywords found = small penalty

    # === Contract type (up to +10) ===
    if contract_pref:
        if contract_pref in text:
            score += 10
        else:
            # Check common variations
            contract_map = {
                "cdi": ["cdi", "permanent", "indéterminée", "contrat indéterminé"],
                "cdd": ["cdd", "déterminée", "temporary", "contrat déterminé"],
                "stage": ["stage", "internship", "intern", "stagiaire"],
                "alternance": ["alternance", "apprentissage", "apprenticeship", "apprenti"],
                "freelance": ["freelance", "indépendant", "contractor", "mission"],
            }
            for key, variants in contract_map.items():
                if contract_pref == key and any(v in text for v in variants):
                    score += 10
                    break

    # === CV keywords matching (up to +30 when no preferences, +20 otherwise) ===
    if user_cv:
        # Check how many CV keywords appear in job description
        cv_matches = sum(1 for kw in user_cv if kw in text)
        match_ratio = cv_matches / len(user_cv) if user_cv else 0

        # Give more weight to CV matching when no preferences are defined
        cv_bonus_max = 30 if not has_preferences else 20

        if match_ratio >= 0.35:
            score += cv_bonus_max  # Strong CV match
        elif match_ratio >= 0.20:
            score += int(cv_bonus_max * 0.7)  # Good match
        elif match_ratio >= 0.10:
            score += int(cv_bonus_max * 0.4)  # Moderate match
        elif match_ratio >= 0.05:
            score += int(cv_bonus_max * 0.2)  # Some match
        # No penalty for low CV match (user might be changing careers)

    # === Bonus for detailed job posting (up to +5) ===
    desc_len = len(job.description or "")
    if desc_len > 1500:
        score += 5  # Very detailed description
    elif desc_len > 800:
        score += 3  # Good description
    elif desc_len < 100:
        score -= 3  # Very short descriptions are suspicious

    # Clamp score to 0-100
    return max(0, min(score, 100))


def ensure_linkedin_sample(db: Session):
    """Échantillons supprimés : ne rien insérer automatiquement."""
    return


def clear_all_jobs(db: Session):
    """
    DEPRECATED: This function clears ALL jobs for ALL users.
    Use clear_user_job_data() instead for user-specific cleanup.
    """
    # Delete dependent records first to avoid FK violations
    db.query(UserJob).delete()
    db.query(JobListing).delete()
    db.commit()


def clear_user_job_data(db: Session, user_id: int):
    """
    Clear job-related data for a specific user and delete orphaned jobs.
    This resets the user's job list so they can start fresh.
    Also deletes jobs that are no longer referenced by any user.
    """
    # Get job IDs associated with this user before deleting
    user_job_ids = [
        row[0]
        for row in db.query(UserJob.job_id).filter(UserJob.user_id == user_id).all()
    ]

    # Delete user_jobs entries
    db.query(UserJob).filter(UserJob.user_id == user_id).delete()
    db.commit()

    # Delete jobs that are no longer referenced by any user
    if user_job_ids:
        for job_id in user_job_ids:
            # Check if any other user still references this job
            other_refs = db.query(UserJob).filter(UserJob.job_id == job_id).first()
            if not other_refs:
                # No other user has this job, delete it
                db.query(JobListing).filter(JobListing.id == job_id).delete()
        db.commit()


def cleanup_old_jobs(db: Session) -> int:
    """Delete jobs older than OLD_JOB_DAYS (90 days by default).

    Uses bulk delete for better performance. Cascading deletes are handled
    by first removing related records (user_jobs).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=OLD_JOB_DAYS)

    # Get IDs of old jobs for bulk operations
    old_job_ids = [
        row[0]
        for row in db.query(JobListing.id).filter(JobListing.created_at < cutoff).all()
    ]

    if not old_job_ids:
        return 0

    # Delete related user_jobs first (bulk delete for performance)
    db.query(UserJob).filter(UserJob.job_id.in_(old_job_ids)).delete(synchronize_session=False)

    # Now bulk delete the jobs themselves
    count = db.query(JobListing).filter(JobListing.id.in_(old_job_ids)).delete(synchronize_session=False)

    db.commit()
    return count


def is_job_url_alive(url: str, timeout: float = 3.0) -> bool:
    """
    Vérifie si une offre est encore en ligne.
    On tente un HEAD rapide, avec fallback GET léger si HEAD est refusé.
    """
    req = urlrequest.Request(url, method="HEAD")
    try:
        with urlrequest.urlopen(req, timeout=timeout):  # nosec - URL externe contrôlée par DB
            return True
    except urlerror.HTTPError as exc:
        if exc.code in (404, 410):
            return False
        if exc.code in (405, 403):
            # Certains sites refusent HEAD : on tente un GET minimal
            try:
                req_get = urlrequest.Request(url, method="GET", headers={"Range": "bytes=0-0"})
                with urlrequest.urlopen(req_get, timeout=timeout):  # nosec
                    return True
            except urlerror.HTTPError as exc_get:
                return exc_get.code not in (404, 410)
            except Exception:
                return False
        return True
    except Exception:
        return False


def _normalize_created_at(created_at: Optional[datetime]) -> Optional[datetime]:
    if created_at and created_at.tzinfo is None:
        return created_at.replace(tzinfo=timezone.utc)
    return created_at


def _job_to_jobout(job: JobListing, pref: UserPreference, user_cv: set[str]) -> Optional[JobOut]:
    score = score_job(job, pref, user_cv)
    if score is None:
        return None
    score_10 = max(0, min(10, round(score / 10)))
    created_at = _normalize_created_at(job.created_at)
    is_new = False
    if created_at:
        delta = datetime.now(timezone.utc) - created_at
        is_new = delta <= timedelta(days=NEW_BADGE_DAYS)
    is_remote = "remote" in (job.location or "").lower() or "remote" in (job.description or "").lower()
    match_reasons = _extract_match_reasons(job, pref, user_cv)
    return JobOut(
        id=job.id,
        source=job.source,
        title=job.title,
        company=job.company,
        location=job.location,
        url=job.url,
        description=job.description,
        salary_min=job.salary_min,
        score=score_10,
        is_remote=is_remote,
        is_new=is_new,
        created_at=created_at,
        match_reasons=match_reasons,
    )


SortOption = Literal["newest", "score", "new_first"]


def list_matches_for_user(
    db: Session,
    user_id: int,
    pref: UserPreference,
    user_cv: set[str],
    cleanup_dead_links: bool = False,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    sort_by: SortOption = "new_first",
) -> list[JobOut]:
    """Liste les offres de l'utilisateur depuis UserJob (dashboard simplifié)."""
    # Get user's jobs that are not deleted, joined with job listings
    user_jobs = (
        db.query(UserJob, JobListing)
        .join(JobListing, UserJob.job_id == JobListing.id)
        .filter(UserJob.user_id == user_id)
        .filter(UserJob.status != "deleted")
        .order_by(UserJob.created_at.desc())
        .all()
    )

    result = []
    for user_job, job in user_jobs:
        created_at = _normalize_created_at(job.created_at)
        is_new = user_job.status == "new"
        is_remote = "remote" in (job.location or "").lower() or "remote" in (job.description or "").lower()
        match_reasons = _extract_match_reasons(job, pref, user_cv)

        job_out = JobOut(
            id=job.id,
            source=job.source,
            title=job.title,
            company=job.company,
            location=job.location,
            url=job.url,
            description=job.description,
            salary_min=job.salary_min,
            score=user_job.score,
            is_remote=is_remote,
            is_new=is_new,
            is_saved=user_job.status == "saved",
            status=user_job.status,
            created_at=created_at,
            match_reasons=match_reasons,
        )
        result.append(job_out)

    # Sort based on option
    if sort_by == "newest":
        result.sort(key=lambda j: j.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    elif sort_by == "score":
        result.sort(key=lambda j: j.score or 0, reverse=True)
    else:  # "new_first"
        result.sort(key=lambda j: (
            0 if j.is_new else 1,
            -(j.score or 0),
            -(j.created_at or datetime.min.replace(tzinfo=timezone.utc)).timestamp()
        ))

    if page and page_size:
        start = max(0, (page - 1) * page_size)
        end = start + page_size
        return result[start:end]

    return result


def add_jobs_to_user_dashboard(
    db: Session,
    user_id: int,
    jobs: list[JobListing],
    pref: UserPreference,
    user_cv: set[str],
) -> int:
    """Ajoute des offres au dashboard de l'utilisateur avec leur score."""
    added = 0
    seen_job_ids: set[int] = set()  # Track jobs added in this batch

    for job in jobs:
        # Skip duplicates in the same batch
        if job.id in seen_job_ids:
            continue
        seen_job_ids.add(job.id)

        # Vérifier si l'offre existe déjà pour cet utilisateur
        existing = (
            db.query(UserJob)
            .filter(UserJob.user_id == user_id, UserJob.job_id == job.id)
            .first()
        )
        if existing:
            continue

        # Calculer le score
        score = score_job(job, pref, user_cv)
        if score is None:
            continue  # Job filtré par les critères

        score_10 = max(0, min(10, round(score / 10)))

        # Créer l'entrée UserJob
        user_job = UserJob(
            user_id=user_id,
            job_id=job.id,
            score=score_10,
            status="new",
        )
        db.add(user_job)
        added += 1

    if added > 0:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            # Retry one by one for any remaining conflicts
            added = 0
            for job in jobs:
                if job.id not in seen_job_ids:
                    continue
                existing = (
                    db.query(UserJob)
                    .filter(UserJob.user_id == user_id, UserJob.job_id == job.id)
                    .first()
                )
                if existing:
                    continue
                score = score_job(job, pref, user_cv)
                if score is None:
                    continue
                score_10 = max(0, min(10, round(score / 10)))
                user_job = UserJob(
                    user_id=user_id,
                    job_id=job.id,
                    score=score_10,
                    status="new",
                )
                db.add(user_job)
                try:
                    db.commit()
                    added += 1
                except IntegrityError:
                    db.rollback()

    return added


def get_top_unnotified_jobs(
    db: Session,
    user_id: int,
    limit: int = 5,
) -> list[tuple[UserJob, JobListing]]:
    """Récupère les meilleures offres non consultées et non notifiées pour l'email."""
    return (
        db.query(UserJob, JobListing)
        .join(JobListing, UserJob.job_id == JobListing.id)
        .filter(UserJob.user_id == user_id)
        .filter(UserJob.status == "new")  # Non consultées
        .filter(UserJob.notified_at.is_(None))  # Non encore notifiées par email
        .order_by(UserJob.score.desc())
        .limit(limit)
        .all()
    )
