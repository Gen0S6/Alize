from datetime import datetime, timedelta, timezone
from typing import Optional, Literal
from urllib import request as urlrequest, error as urlerror

from sqlalchemy.orm import Session

from app.models import CV, JobListing, UserPreference, UserJobBlacklist
from app.schemas import JobOut

NEW_BADGE_DAYS = 3
OLD_JOB_DAYS = 90  # Auto-delete jobs older than 90 days


def norm_list(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    return [item.strip().lower() for item in raw.split(",") if item.strip()]


def cv_keywords(db: Session, user_id: int) -> set[str]:
    cv = (
        db.query(CV)
        .filter(CV.user_id == user_id)
        .order_by(CV.id.desc())
        .first()
    )
    if not cv or not cv.text:
        return set()
    tokens = [t for t in cv.text.lower().replace("\n", " ").split(" ") if len(t) > 2]
    # on prend les mots les plus fréquents (naïf) pour pondérer
    return set(tokens[:50])


def score_job(job: JobListing, pref: UserPreference, user_cv: set[str]) -> Optional[int]:
    text = f"{job.title} {job.company} {job.location or ''} {job.description or ''}".lower()
    must = norm_list(pref.must_keywords)
    avoid = norm_list(pref.avoid_keywords)
    role = (pref.role or "").lower()
    loc = (pref.location or "").lower()
    contract_pref = (pref.contract_type or "").lower()
    salary_floor = pref.salary_min

    if avoid and any(k in text for k in avoid):
        return None

    if salary_floor:
        if job.salary_min is not None and job.salary_min < salary_floor:
            return None  # on filtre seulement si l'offre annonce un salaire inférieur

    score = 50
    if role and role in job.title.lower():
        score += 15
    if loc and loc in (job.location or "").lower():
        score += 10
    if must:
        must_hits = sum(1 for k in must if k in text)
        score += min(10, must_hits * 3)  # bonus progressif
    if loc:
        if "remote" in text and ("remote" in loc or "hybride" in loc):
            score += 5
        if loc in (job.location or "").lower():
            score += 5
    if contract_pref and contract_pref in text:
        score += 5

    if user_cv:
        matches = sum(1 for kw in list(user_cv)[:30] if kw in text)
        score += min(matches, 10)

    return min(score, 100)


def ensure_linkedin_sample(db: Session):
    """Échantillons supprimés : ne rien insérer automatiquement."""
    return


def clear_all_jobs(db: Session):
    db.query(JobListing).delete()
    db.commit()


def cleanup_old_jobs(db: Session) -> int:
    """Delete jobs older than OLD_JOB_DAYS (90 days by default)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=OLD_JOB_DAYS)
    old_jobs = db.query(JobListing).filter(JobListing.created_at < cutoff).all()
    count = len(old_jobs)
    for job in old_jobs:
        db.delete(job)
    if count:
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
    blacklisted_ids = {
        row[0]
        for row in db.query(UserJobBlacklist.job_id).filter(UserJobBlacklist.user_id == user_id).all()
    }
    jobs = db.query(JobListing).all()
    result = []
    removed = 0
    for job in jobs:
        if job.id in blacklisted_ids:
            continue
        if cleanup_dead_links and not is_job_url_alive(job.url):
            db.delete(job)
            removed += 1
            continue
        job_out = _job_to_jobout(job, pref, user_cv)
        if job_out:
            result.append(job_out)
    if removed:
        db.commit()

    # Sort based on option
    if sort_by == "newest":
        # Sort by date only (newest first)
        result.sort(key=lambda j: j.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    elif sort_by == "score":
        # Sort by score only (highest first)
        result.sort(key=lambda j: j.score or 0, reverse=True)
    else:  # "new_first" - default
        # New offers first, then by score
        result.sort(key=lambda j: (
            0 if j.is_new else 1,  # New offers first
            -(j.score or 0),  # Then by score (descending)
            -(j.created_at or datetime.min.replace(tzinfo=timezone.utc)).timestamp()  # Then by date
        ))

    if page and page_size:
        start = max(0, (page - 1) * page_size)
        end = start + page_size
        return result[start:end]

    return result
