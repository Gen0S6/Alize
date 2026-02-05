import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.ai import analyze_profile, search_jobs_for_user, latest_cv
from app.auth import get_current_user
from app.deps import get_db
import json

log = logging.getLogger(__name__)

from datetime import datetime, timezone
from app.models import User, JobSearchRun, UserAnalysisCache
from app.schemas import AnalysisOut, JobSearchOut, JobSearchRunOut
from app.services.preferences import get_or_create_pref
from app.services.matching import ensure_linkedin_sample

router = APIRouter(tags=["ai"])


def _normalize_datetime(dt):
    """Normalise une datetime pour comparaison (enlève la timezone si présente)."""
    if dt is None:
        return None
    if hasattr(dt, 'tzinfo') and dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


@router.get("/ai/analysis", response_model=AnalysisOut)
def ai_analysis(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    force: bool = False,
):
    pref = get_or_create_pref(user, db)
    cv_entry = latest_cv(db, user.id)
    cache = db.query(UserAnalysisCache).filter(UserAnalysisCache.user_id == user.id).first()

    # Normaliser les dates pour éviter les problèmes de timezone
    pref_updated = _normalize_datetime(pref.updated_at or pref.created_at)
    cache_updated = _normalize_datetime(cache.updated_at) if cache else None
    cv_created = _normalize_datetime(cv_entry.created_at) if cv_entry else None

    # Utiliser le cache si valide
    if not force and cache and cache_updated:
        cache_is_valid = (
            pref_updated <= cache_updated and
            (cv_created is None or cv_created <= cache_updated)
        )
        if cache_is_valid:
            try:
                cached = json.loads(cache.analysis_json) if cache.analysis_json else {}
                return AnalysisOut(**cached)
            except Exception as exc:
                log.warning("Failed to parse cached analysis for user %d: %s", user.id, exc)

    analysis = analyze_profile(db, user.id, pref)
    now = datetime.now(timezone.utc)
    if cache:
        cache.analysis_json = json.dumps(analysis)
        cache.updated_at = now
        db.add(cache)
    else:
        db.add(UserAnalysisCache(user_id=user.id, analysis_json=json.dumps(analysis), updated_at=now))
    db.commit()
    return AnalysisOut(**analysis)


@router.post("/jobs/search", response_model=JobSearchOut)
def jobs_search(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = get_or_create_pref(user, db)
    result = search_jobs_for_user(db, user.id, pref, force=True)
    if result.get("inserted", 0) == 0:
        ensure_linkedin_sample(db)
    run_entry = JobSearchRun(
        user_id=user.id,
        inserted=result.get("inserted", 0),
        tried_queries=json.dumps(result.get("tried_queries", [])),
        sources=json.dumps(result.get("sources", {})),
        created_at=datetime.now(timezone.utc),
        analysis_json=json.dumps(result.get("analysis", {})),
    )
    try:
        db.add(run_entry)
        db.commit()
        # met à jour le cache d'analyse
        cache = db.query(UserAnalysisCache).filter(UserAnalysisCache.user_id == user.id).first()
        now = datetime.now(timezone.utc)
        if cache:
            cache.analysis_json = json.dumps(result.get("analysis", {}))
            cache.updated_at = now
            db.add(cache)
        else:
            db.add(UserAnalysisCache(user_id=user.id, analysis_json=json.dumps(result.get("analysis", {})), updated_at=now))
        db.commit()
        # ne conserve que les 8 derniers runs pour l'utilisateur
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
        # ne bloque pas la réponse si l'enregistrement échoue
        log.error("Failed to record job search run: %s", exc)
    return JobSearchOut(
        inserted=result.get("inserted", 0),
        tried_queries=result.get("tried_queries", []),
        sources=result.get("sources", {}),
        analysis=AnalysisOut(**result.get("analysis", {})),
    )


@router.get("/jobs/runs", response_model=list[JobSearchRunOut])
def jobs_runs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    runs = (
        db.query(JobSearchRun)
        .filter(JobSearchRun.user_id == user.id)
        .order_by(JobSearchRun.created_at.desc(), JobSearchRun.id.desc())
        .limit(20)
        .all()
    )
    results = []
    for run in runs:
        try:
            tried = json.loads(run.tried_queries) if run.tried_queries else []
        except Exception:
            tried = []
        try:
            sources = json.loads(run.sources) if run.sources else {}
        except Exception:
            sources = {}
        created = run.created_at
        if created and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        created_local = created.astimezone() if created else None
        results.append(
            JobSearchRunOut(
                id=run.id,
                inserted=run.inserted,
                tried_queries=tried,
                sources=sources,
                created_at=created_local,
            )
        )
    return results
