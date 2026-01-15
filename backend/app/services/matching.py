from datetime import datetime, timedelta, timezone
from typing import Optional, Literal
from urllib import request as urlrequest, error as urlerror
from collections import Counter
import re

from sqlalchemy.orm import Session

from app.models import CV, JobListing, UserPreference, UserJobBlacklist
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

    # Start with base score of 20 (allows more differentiation)
    score = 20

    # === Role matching (up to +35) ===
    if role:
        if role in title_lower:
            score += 30  # Exact role in title = strong match
        elif any(word in title_lower for word in role.split() if len(word) > 3):
            score += 15  # Partial role match
        else:
            score -= 10  # Role specified but not found = penalty

    # === Location matching (up to +20) ===
    if loc:
        loc_words = [w.strip() for w in loc.split(",")]
        location_match = any(l in location_lower for l in loc_words if l)
        remote_wanted = any(r in loc.lower() for r in ["remote", "télétravail", "hybride"])
        remote_offered = "remote" in text or "télétravail" in text or "hybride" in text

        if location_match:
            score += 20  # Location matches
        elif remote_wanted and remote_offered:
            score += 15  # Remote wanted and offered
        elif not location_match and not (remote_wanted and remote_offered):
            score -= 5  # Location specified but doesn't match

    # === Must keywords (up to +25) ===
    if must:
        must_hits = sum(1 for k in must if k in text)
        must_ratio = must_hits / len(must) if must else 0
        if must_ratio >= 0.8:
            score += 25  # Most must keywords found
        elif must_ratio >= 0.5:
            score += 15  # Half found
        elif must_ratio > 0:
            score += must_hits * 3  # Some found
        else:
            score -= 10  # None of the must keywords found

    # === Contract type (up to +10) ===
    if contract_pref:
        if contract_pref in text:
            score += 10
        # Check common variations
        contract_map = {
            "cdi": ["cdi", "permanent", "indéterminée"],
            "cdd": ["cdd", "déterminée", "temporary"],
            "stage": ["stage", "internship", "intern"],
            "alternance": ["alternance", "apprentissage", "apprenticeship"],
            "freelance": ["freelance", "indépendant", "contractor"],
        }
        for key, variants in contract_map.items():
            if contract_pref == key and any(v in text for v in variants):
                score += 10
                break

    # === CV keywords matching (up to +20) ===
    if user_cv:
        # Check how many CV keywords appear in job description
        cv_matches = sum(1 for kw in user_cv if kw in text)
        match_ratio = cv_matches / len(user_cv) if user_cv else 0

        if match_ratio >= 0.3:
            score += 20  # Strong CV match
        elif match_ratio >= 0.15:
            score += 12  # Good match
        elif match_ratio >= 0.05:
            score += 5   # Some match
        # No penalty for low CV match (user might be changing careers)

    # === Bonus for detailed job posting ===
    desc_len = len(job.description or "")
    if desc_len > 1000:
        score += 5  # Detailed description is usually better quality
    elif desc_len < 100:
        score -= 5  # Very short descriptions are suspicious

    # Clamp score to 0-100
    return max(0, min(score, 100))


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
