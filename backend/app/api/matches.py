from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.deps import get_db
from app.models import User, JobListing, UserJob, UserPreference
from app.schemas import JobOut, MatchesPage, UserJobUpdate, UserJobOut, UserJobsPage, DashboardStatsOut
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
    # Compter les jobs non-supprimés
    count = (
        db.query(UserJob.id)
        .filter(UserJob.user_id == user.id)
        .filter(UserJob.status != "deleted")
        .count()
    )
    new_count = (
        db.query(UserJob.id)
        .filter(UserJob.user_id == user.id)
        .filter(UserJob.status == "new")
        .count()
    )
    return {"count": count, "new_count": new_count}


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
    status: Optional[str] = Query(None, description="Filtrer par statut: new, viewed, saved"),
):
    ensure_linkedin_sample(db)
    pref = get_or_create_pref(user, db)
    user_cv = cv_keywords(db, user.id)

    if sort_by not in ("newest", "score", "new_first"):
        sort_by = "new_first"

    all_matches = list_matches_for_user(
        db, user.id, pref, user_cv, cleanup_dead_links=False, page=None, page_size=None, sort_by=sort_by
    )

    # Filtrage
    filtered = []
    ft = (filter_text or "").lower()
    src = source
    available_sources = sorted(list({m.source or "" for m in all_matches if m.source}))
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

    return MatchesPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        available_sources=available_sources,
        new_count=new_count
    )


@router.get("/dashboard/stats", response_model=DashboardStatsOut)
def dashboard_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Statistiques simples du dashboard."""
    total = db.query(UserJob).filter(UserJob.user_id == user.id, UserJob.status != "deleted").count()
    new_jobs = db.query(UserJob).filter(UserJob.user_id == user.id, UserJob.status == "new").count()
    viewed = db.query(UserJob).filter(UserJob.user_id == user.id, UserJob.status == "viewed").count()
    saved = db.query(UserJob).filter(UserJob.user_id == user.id, UserJob.status == "saved").count()

    pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    last_search = pref.last_search_at if pref else None

    # Prochain email = dernier email + 3 jours
    next_email = None
    if pref and pref.last_email_at:
        next_email = pref.last_email_at + timedelta(days=3)
    elif pref and pref.last_search_at:
        next_email = pref.last_search_at + timedelta(days=3)

    return DashboardStatsOut(
        total_jobs=total,
        new_jobs=new_jobs,
        viewed_jobs=viewed,
        saved_jobs=saved,
        last_search_at=last_search,
        next_email_at=next_email,
    )


@router.delete("/matches/{job_id}", status_code=200)
def delete_match(
    job_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Supprimer une offre du dashboard (marquer comme deleted)."""
    user_job = (
        db.query(UserJob)
        .filter(UserJob.user_id == user.id, UserJob.job_id == job_id)
        .first()
    )
    if not user_job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")

    user_job.status = "deleted"
    db.commit()
    return {"deleted": True}


@router.post("/matches/{job_id}/visit", status_code=200)
def mark_visit(
    job_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    check_url: bool = Query(False, description="Vérifier si l'URL est encore valide"),
):
    """Marquer une offre comme consultée."""
    user_job = (
        db.query(UserJob)
        .filter(UserJob.user_id == user.id, UserJob.job_id == job_id)
        .first()
    )
    if not user_job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")

    # Vérification URL optionnelle
    if check_url:
        job = db.query(JobListing).filter(JobListing.id == job_id).first()
        if job and not is_job_url_alive(job.url):
            user_job.status = "deleted"
            db.commit()
            raise HTTPException(status_code=410, detail="Offre expirée")

    if user_job.status == "new":
        user_job.status = "viewed"
        user_job.viewed_at = datetime.now(timezone.utc)
        db.commit()

    return {"visited": True}


@router.put("/matches/{job_id}/status", status_code=200)
def update_job_status(
    job_id: int,
    update: UserJobUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mettre à jour le statut d'une offre (new, viewed, saved, deleted)."""
    user_job = (
        db.query(UserJob)
        .filter(UserJob.user_id == user.id, UserJob.job_id == job_id)
        .first()
    )
    if not user_job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")

    user_job.status = update.status
    if update.status == "viewed" and not user_job.viewed_at:
        user_job.viewed_at = datetime.now(timezone.utc)

    db.commit()
    return {"status": user_job.status}


@router.post("/matches/{job_id}/save", status_code=200)
def save_job(
    job_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sauvegarder une offre."""
    user_job = (
        db.query(UserJob)
        .filter(UserJob.user_id == user.id, UserJob.job_id == job_id)
        .first()
    )
    if not user_job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")

    user_job.status = "saved"
    if not user_job.viewed_at:
        user_job.viewed_at = datetime.now(timezone.utc)
    db.commit()

    return {"saved": True}


@router.post("/matches/{job_id}/unsave", status_code=200)
def unsave_job(
    job_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retirer une offre des sauvegardées."""
    user_job = (
        db.query(UserJob)
        .filter(UserJob.user_id == user.id, UserJob.job_id == job_id)
        .first()
    )
    if not user_job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")

    user_job.status = "viewed"
    db.commit()

    return {"unsaved": True}
