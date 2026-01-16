from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.deps import get_db
from app.models import User, JobListing, UserJobVisit, UserJobBlacklist
from app.schemas import JobOut, MatchesPage
from app.services.preferences import get_or_create_pref
from app.services.matching import (
    cv_keywords,
    ensure_linkedin_sample,
    list_matches_for_user,
    is_job_url_alive,
)

router = APIRouter(tags=["matches"])


@router.post("/jobs/refresh")
def refresh_linkedin(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_linkedin_sample(db)
    return {"inserted": True, "source": "LinkedIn"}


@router.get("/matches/count")
def matches_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Endpoint léger pour compter rapidement les offres de l'utilisateur."""
    # Compter les jobs non-blacklistés (requête SQL simple, pas de scoring)
    blacklisted_ids = (
        db.query(UserJobBlacklist.job_id)
        .filter(UserJobBlacklist.user_id == user.id)
        .subquery()
    )
    count = (
        db.query(JobListing.id)
        .filter(~JobListing.id.in_(blacklisted_ids))
        .count()
    )
    return {"count": count}


@router.get("/matches", response_model=MatchesPage)
def matches(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    filter_text: Optional[str] = Query(None, alias="filter_text"),
    min_score: int = Query(0, ge=0, le=10),
    source: str = Query("all"),
    sort_by: str = Query("new_first"),
    new_only: bool = Query(False),
):
    ensure_linkedin_sample(db)
    pref = get_or_create_pref(user, db)
    user_cv = cv_keywords(db, user.id)
    # Validate sort_by
    if sort_by not in ("newest", "score", "new_first"):
        sort_by = "new_first"
    all_matches = list_matches_for_user(
        db, user.id, pref, user_cv, cleanup_dead_links=False, page=None, page_size=None, sort_by=sort_by
    )
    # filtrage côté backend pour couvrir tous les résultats
    filtered = []
    ft = (filter_text or "").lower()
    src = source
    available_sources = sorted(
        list({m.source or "" for m in all_matches if m.source})
    )
    new_count = 0
    for m in all_matches:
        if m.is_new:
            new_count += 1
        if new_only and not m.is_new:
            continue
        if src != "all" and (m.source or "").lower() != src.lower():
            continue
        if min_score and (m.score or 0) < min_score:
            continue
        if ft:
            blob = f"{m.title} {m.company} {m.location or ''} {m.source or ''}".lower()
            if ft not in blob:
                continue
        filtered.append(m)
    total = len(filtered)
    start = max(0, (page - 1) * page_size)
    end = start + page_size
    items = filtered[start:end]
    return MatchesPage(items=items, total=total, page=page, page_size=page_size, available_sources=available_sources, new_count=new_count)


@router.delete("/matches/{job_id}", status_code=200)
def delete_match(
    job_id: int,
    user: User = Depends(get_current_user),  # pragma: no cover - auth is required
    db: Session = Depends(get_db),
):
    job = db.query(JobListing).filter(JobListing.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Not found")
    existing = (
        db.query(UserJobBlacklist)
        .filter(UserJobBlacklist.user_id == user.id, UserJobBlacklist.job_id == job_id)
        .first()
    )
    if not existing:
        db.add(UserJobBlacklist(user_id=user.id, job_id=job_id))
        db.commit()
    return {"deleted": True}


@router.post("/matches/{job_id}/visit", status_code=200)
def mark_visit(
    job_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    check_url: bool = Query(False, description="Vérifier si l'URL est encore valide (lent)"),
):
    job = db.query(JobListing).filter(JobListing.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Not found")
    # Vérification d'URL optionnelle (désactivée par défaut car bloquante ~3s)
    if check_url and not is_job_url_alive(job.url):
        db.delete(job)
        db.commit()
        raise HTTPException(status_code=410, detail="Offre expirée")
    existing = (
        db.query(UserJobVisit)
        .filter(UserJobVisit.user_id == user.id, UserJobVisit.job_id == job_id)
        .first()
    )
    if not existing:
        db.add(UserJobVisit(user_id=user.id, job_id=job_id))
        db.commit()
    return {"visited": True}
