"""
API routes for personalized job search campaigns.
Each user can have multiple campaigns with different search criteria and notification settings.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timezone
from typing import Optional

from app.auth import get_current_user
from app.deps import get_db
from app.models import (
    User,
    JobSearchCampaign,
    CampaignJob,
    CampaignEmailTemplate,
    DashboardConfig,
    CampaignAnalyticsSnapshot,
    JobListing,
)
from app.schemas import (
    CampaignCreate,
    CampaignUpdate,
    CampaignOut,
    CampaignListOut,
    CampaignJobCreate,
    CampaignJobUpdate,
    CampaignJobOut,
    CampaignJobsPage,
    EmailTemplateCreate,
    EmailTemplateUpdate,
    EmailTemplateOut,
    DashboardConfigUpdate,
    DashboardConfigOut,
    CampaignStatsOut,
    DashboardStatsOut,
    JobOut,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def campaign_to_out(campaign: JobSearchCampaign) -> CampaignOut:
    """Convert a campaign model to output schema."""
    return CampaignOut(
        id=campaign.id,
        user_id=campaign.user_id,
        name=campaign.name,
        description=campaign.description,
        color=campaign.color,
        icon=campaign.icon,
        target_role=campaign.target_role,
        target_location=campaign.target_location,
        contract_type=campaign.contract_type,
        salary_min=campaign.salary_min,
        salary_max=campaign.salary_max,
        experience_level=campaign.experience_level,
        remote_preference=campaign.remote_preference,
        must_keywords=campaign.must_keywords,
        nice_keywords=campaign.nice_keywords,
        avoid_keywords=campaign.avoid_keywords,
        email_notifications=campaign.email_notifications,
        email_frequency=campaign.email_frequency,
        min_score_for_notification=campaign.min_score_for_notification,
        is_active=campaign.is_active,
        is_default=campaign.is_default,
        priority=campaign.priority,
        jobs_found=campaign.jobs_found,
        jobs_applied=campaign.jobs_applied,
        jobs_interviewed=campaign.jobs_interviewed,
        last_search_at=campaign.last_search_at,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
    )


# ==================== Campaign CRUD ====================


@router.get("", response_model=CampaignListOut)
def list_campaigns(
    active_only: bool = Query(False, description="Filter only active campaigns"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all campaigns for the current user."""
    query = db.query(JobSearchCampaign).filter(JobSearchCampaign.user_id == user.id)

    if active_only:
        query = query.filter(JobSearchCampaign.is_active.is_(True))

    campaigns = query.order_by(JobSearchCampaign.priority.desc(), JobSearchCampaign.created_at.desc()).all()

    active_count = sum(1 for c in campaigns if c.is_active)

    return CampaignListOut(
        campaigns=[campaign_to_out(c) for c in campaigns],
        total=len(campaigns),
        active_count=active_count,
    )


@router.post("", response_model=CampaignOut, status_code=201)
def create_campaign(
    payload: CampaignCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new job search campaign."""
    # If this is the first campaign, make it default
    existing_count = db.query(func.count(JobSearchCampaign.id)).filter(
        JobSearchCampaign.user_id == user.id
    ).scalar()

    is_default = payload.is_default or existing_count == 0

    # If setting as default, unset other defaults
    if is_default:
        db.query(JobSearchCampaign).filter(
            JobSearchCampaign.user_id == user.id,
            JobSearchCampaign.is_default.is_(True),
        ).update({"is_default": False})

    campaign = JobSearchCampaign(
        user_id=user.id,
        name=payload.name,
        description=payload.description,
        color=payload.color,
        icon=payload.icon,
        target_role=payload.target_role,
        target_location=payload.target_location,
        contract_type=payload.contract_type,
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        experience_level=payload.experience_level,
        remote_preference=payload.remote_preference,
        must_keywords=payload.must_keywords,
        nice_keywords=payload.nice_keywords,
        avoid_keywords=payload.avoid_keywords,
        email_notifications=payload.email_notifications,
        email_frequency=payload.email_frequency,
        min_score_for_notification=payload.min_score_for_notification,
        is_default=is_default,
        priority=payload.priority,
    )

    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    return campaign_to_out(campaign)


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_campaign(
    campaign_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific campaign by ID."""
    campaign = db.query(JobSearchCampaign).filter(
        JobSearchCampaign.id == campaign_id,
        JobSearchCampaign.user_id == user.id,
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    return campaign_to_out(campaign)


@router.put("/{campaign_id}", response_model=CampaignOut)
def update_campaign(
    campaign_id: int,
    payload: CampaignUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a campaign."""
    campaign = db.query(JobSearchCampaign).filter(
        JobSearchCampaign.id == campaign_id,
        JobSearchCampaign.user_id == user.id,
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # If setting as default, unset other defaults
    if payload.is_default:
        db.query(JobSearchCampaign).filter(
            JobSearchCampaign.user_id == user.id,
            JobSearchCampaign.id != campaign_id,
            JobSearchCampaign.is_default.is_(True),
        ).update({"is_default": False})

    # Update only provided fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(campaign, field, value)

    campaign.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(campaign)

    return campaign_to_out(campaign)


@router.delete("/{campaign_id}", status_code=204)
def delete_campaign(
    campaign_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a campaign and all associated data."""
    campaign = db.query(JobSearchCampaign).filter(
        JobSearchCampaign.id == campaign_id,
        JobSearchCampaign.user_id == user.id,
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Check if this is the only campaign
    campaign_count = db.query(func.count(JobSearchCampaign.id)).filter(
        JobSearchCampaign.user_id == user.id
    ).scalar()

    was_default = campaign.is_default

    db.delete(campaign)
    db.commit()

    # If deleted campaign was default and there are other campaigns, set a new default
    if was_default and campaign_count > 1:
        new_default = db.query(JobSearchCampaign).filter(
            JobSearchCampaign.user_id == user.id
        ).order_by(JobSearchCampaign.priority.desc()).first()
        if new_default:
            new_default.is_default = True
            db.commit()

    return None


# ==================== Campaign Jobs ====================


@router.get("/{campaign_id}/jobs", response_model=CampaignJobsPage)
def list_campaign_jobs(
    campaign_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    min_score: Optional[int] = Query(None, ge=0, le=10),
    search: Optional[str] = Query(None, description="Search in job title/company"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List jobs for a specific campaign with filters and pagination."""
    # Verify campaign belongs to user
    campaign = db.query(JobSearchCampaign).filter(
        JobSearchCampaign.id == campaign_id,
        JobSearchCampaign.user_id == user.id,
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Base query
    query = db.query(CampaignJob, JobListing).join(
        JobListing, CampaignJob.job_id == JobListing.id
    ).filter(
        CampaignJob.campaign_id == campaign_id,
        CampaignJob.user_id == user.id,
    )

    # Apply filters
    if status:
        query = query.filter(CampaignJob.status == status)

    if min_score is not None:
        query = query.filter(CampaignJob.score >= min_score)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (JobListing.title.ilike(search_pattern)) |
            (JobListing.company.ilike(search_pattern))
        )

    # Get total count
    total = query.count()

    # Paginate
    offset = (page - 1) * page_size
    results = query.order_by(CampaignJob.created_at.desc()).offset(offset).limit(page_size).all()

    # Build response items
    items = []
    for campaign_job, job in results:
        job_out = JobOut(
            id=job.id,
            source=job.source,
            title=job.title,
            company=job.company,
            location=job.location,
            url=job.url,
            description=job.description,
            salary_min=job.salary_min,
            created_at=job.created_at,
        )
        items.append(CampaignJobOut(
            id=campaign_job.id,
            campaign_id=campaign_job.campaign_id,
            job_id=campaign_job.job_id,
            score=campaign_job.score,
            status=campaign_job.status,
            notes=campaign_job.notes,
            applied_at=campaign_job.applied_at,
            interview_date=campaign_job.interview_date,
            visited_at=campaign_job.visited_at,
            created_at=campaign_job.created_at,
            updated_at=campaign_job.updated_at,
            job=job_out,
        ))

    # Calculate stats
    stats = {}
    status_counts = db.query(
        CampaignJob.status, func.count(CampaignJob.id)
    ).filter(
        CampaignJob.campaign_id == campaign_id
    ).group_by(CampaignJob.status).all()

    for status_name, count in status_counts:
        stats[status_name] = count

    return CampaignJobsPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        stats=stats,
    )


@router.post("/{campaign_id}/jobs", response_model=CampaignJobOut, status_code=201)
def add_job_to_campaign(
    campaign_id: int,
    payload: CampaignJobCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a job to a campaign."""
    # Verify campaign belongs to user
    campaign = db.query(JobSearchCampaign).filter(
        JobSearchCampaign.id == campaign_id,
        JobSearchCampaign.user_id == user.id,
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Verify job exists
    job = db.query(JobListing).filter(JobListing.id == payload.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if job already in campaign
    existing = db.query(CampaignJob).filter(
        CampaignJob.campaign_id == campaign_id,
        CampaignJob.job_id == payload.job_id,
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Job already in this campaign")

    campaign_job = CampaignJob(
        campaign_id=campaign_id,
        job_id=payload.job_id,
        user_id=user.id,
        status=payload.status,
        notes=payload.notes,
    )

    db.add(campaign_job)

    # Update campaign stats
    campaign.jobs_found += 1
    campaign.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(campaign_job)

    job_out = JobOut(
        id=job.id,
        source=job.source,
        title=job.title,
        company=job.company,
        location=job.location,
        url=job.url,
        description=job.description,
        salary_min=job.salary_min,
        created_at=job.created_at,
    )

    return CampaignJobOut(
        id=campaign_job.id,
        campaign_id=campaign_job.campaign_id,
        job_id=campaign_job.job_id,
        score=campaign_job.score,
        status=campaign_job.status,
        notes=campaign_job.notes,
        applied_at=campaign_job.applied_at,
        interview_date=campaign_job.interview_date,
        visited_at=campaign_job.visited_at,
        created_at=campaign_job.created_at,
        updated_at=campaign_job.updated_at,
        job=job_out,
    )


@router.put("/{campaign_id}/jobs/{job_id}", response_model=CampaignJobOut)
def update_campaign_job(
    campaign_id: int,
    job_id: int,
    payload: CampaignJobUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a job's status or notes in a campaign."""
    campaign_job = db.query(CampaignJob).filter(
        CampaignJob.campaign_id == campaign_id,
        CampaignJob.job_id == job_id,
        CampaignJob.user_id == user.id,
    ).first()

    if not campaign_job:
        raise HTTPException(status_code=404, detail="Job not found in this campaign")

    old_status = campaign_job.status
    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(campaign_job, field, value)

    campaign_job.updated_at = datetime.now(timezone.utc)

    # Update campaign stats based on status change
    if "status" in update_data and old_status != update_data["status"]:
        campaign = db.query(JobSearchCampaign).filter(
            JobSearchCampaign.id == campaign_id
        ).first()

        if campaign:
            new_status = update_data["status"]
            if new_status == "applied" and old_status != "applied":
                campaign.jobs_applied += 1
            elif new_status == "interview" and old_status != "interview":
                campaign.jobs_interviewed += 1
            campaign.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(campaign_job)

    # Get job details
    job = db.query(JobListing).filter(JobListing.id == job_id).first()
    job_out = None
    if job:
        job_out = JobOut(
            id=job.id,
            source=job.source,
            title=job.title,
            company=job.company,
            location=job.location,
            url=job.url,
            description=job.description,
            salary_min=job.salary_min,
            created_at=job.created_at,
        )

    return CampaignJobOut(
        id=campaign_job.id,
        campaign_id=campaign_job.campaign_id,
        job_id=campaign_job.job_id,
        score=campaign_job.score,
        status=campaign_job.status,
        notes=campaign_job.notes,
        applied_at=campaign_job.applied_at,
        interview_date=campaign_job.interview_date,
        visited_at=campaign_job.visited_at,
        created_at=campaign_job.created_at,
        updated_at=campaign_job.updated_at,
        job=job_out,
    )


@router.delete("/{campaign_id}/jobs/{job_id}", status_code=204)
def remove_job_from_campaign(
    campaign_id: int,
    job_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a job from a campaign."""
    campaign_job = db.query(CampaignJob).filter(
        CampaignJob.campaign_id == campaign_id,
        CampaignJob.job_id == job_id,
        CampaignJob.user_id == user.id,
    ).first()

    if not campaign_job:
        raise HTTPException(status_code=404, detail="Job not found in this campaign")

    db.delete(campaign_job)
    db.commit()

    return None


# ==================== Email Templates ====================


@router.get("/{campaign_id}/templates", response_model=list[EmailTemplateOut])
def list_campaign_templates(
    campaign_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List email templates for a campaign."""
    # Verify campaign belongs to user
    campaign = db.query(JobSearchCampaign).filter(
        JobSearchCampaign.id == campaign_id,
        JobSearchCampaign.user_id == user.id,
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    templates = db.query(CampaignEmailTemplate).filter(
        CampaignEmailTemplate.campaign_id == campaign_id
    ).all()

    return [
        EmailTemplateOut(
            id=t.id,
            campaign_id=t.campaign_id,
            template_type=t.template_type,
            subject=t.subject,
            body=t.body,
            is_active=t.is_active,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in templates
    ]


@router.post("/templates", response_model=EmailTemplateOut, status_code=201)
def create_email_template(
    payload: EmailTemplateCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create an email template for a campaign."""
    # Verify campaign belongs to user
    campaign = db.query(JobSearchCampaign).filter(
        JobSearchCampaign.id == payload.campaign_id,
        JobSearchCampaign.user_id == user.id,
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    template = CampaignEmailTemplate(
        campaign_id=payload.campaign_id,
        user_id=user.id,
        template_type=payload.template_type,
        subject=payload.subject,
        body=payload.body,
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    return EmailTemplateOut(
        id=template.id,
        campaign_id=template.campaign_id,
        template_type=template.template_type,
        subject=template.subject,
        body=template.body,
        is_active=template.is_active,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


@router.put("/templates/{template_id}", response_model=EmailTemplateOut)
def update_email_template(
    template_id: int,
    payload: EmailTemplateUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an email template."""
    template = db.query(CampaignEmailTemplate).filter(
        CampaignEmailTemplate.id == template_id,
        CampaignEmailTemplate.user_id == user.id,
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    template.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(template)

    return EmailTemplateOut(
        id=template.id,
        campaign_id=template.campaign_id,
        template_type=template.template_type,
        subject=template.subject,
        body=template.body,
        is_active=template.is_active,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


@router.delete("/templates/{template_id}", status_code=204)
def delete_email_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an email template."""
    template = db.query(CampaignEmailTemplate).filter(
        CampaignEmailTemplate.id == template_id,
        CampaignEmailTemplate.user_id == user.id,
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(template)
    db.commit()

    return None


# ==================== Dashboard Config ====================


@router.get("/dashboard/config", response_model=DashboardConfigOut)
def get_dashboard_config(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the user's dashboard configuration."""
    config = db.query(DashboardConfig).filter(
        DashboardConfig.user_id == user.id
    ).first()

    if not config:
        # Create default config
        config = DashboardConfig(user_id=user.id)
        db.add(config)
        db.commit()
        db.refresh(config)

    return DashboardConfigOut(
        id=config.id,
        user_id=config.user_id,
        layout=config.layout,
        default_campaign_id=config.default_campaign_id,
        show_stats=config.show_stats,
        show_recent_jobs=config.show_recent_jobs,
        show_calendar=config.show_calendar,
        show_analytics=config.show_analytics,
        theme=config.theme,
        compact_mode=config.compact_mode,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


@router.put("/dashboard/config", response_model=DashboardConfigOut)
def update_dashboard_config(
    payload: DashboardConfigUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the user's dashboard configuration."""
    config = db.query(DashboardConfig).filter(
        DashboardConfig.user_id == user.id
    ).first()

    if not config:
        config = DashboardConfig(user_id=user.id)
        db.add(config)
        db.flush()

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    config.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(config)

    return DashboardConfigOut(
        id=config.id,
        user_id=config.user_id,
        layout=config.layout,
        default_campaign_id=config.default_campaign_id,
        show_stats=config.show_stats,
        show_recent_jobs=config.show_recent_jobs,
        show_calendar=config.show_calendar,
        show_analytics=config.show_analytics,
        theme=config.theme,
        compact_mode=config.compact_mode,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


# ==================== Dashboard Stats ====================


@router.get("/dashboard/stats", response_model=DashboardStatsOut)
def get_dashboard_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get comprehensive dashboard statistics."""
    # Get all campaigns
    campaigns = db.query(JobSearchCampaign).filter(
        JobSearchCampaign.user_id == user.id
    ).all()

    active_campaigns = [c for c in campaigns if c.is_active]

    campaigns_stats = []
    total_jobs_found = 0
    total_applications = 0
    total_interviews = 0

    for campaign in campaigns:
        # Get status counts for this campaign
        status_counts = db.query(
            CampaignJob.status, func.count(CampaignJob.id)
        ).filter(
            CampaignJob.campaign_id == campaign.id
        ).group_by(CampaignJob.status).all()

        counts = {status: count for status, count in status_counts}

        # Calculate average score
        avg_score_result = db.query(func.avg(CampaignJob.score)).filter(
            CampaignJob.campaign_id == campaign.id,
            CampaignJob.score.isnot(None),
        ).scalar()

        total_jobs = sum(counts.values())
        applied = counts.get("applied", 0)
        interviews = counts.get("interview", 0)

        # Calculate response rate
        response_rate = None
        if applied > 0:
            responses = interviews + counts.get("rejected", 0) + counts.get("hired", 0)
            response_rate = round((responses / applied) * 100, 1)

        campaigns_stats.append(CampaignStatsOut(
            campaign_id=campaign.id,
            total_jobs=total_jobs,
            new_jobs=counts.get("new", 0),
            saved_jobs=counts.get("saved", 0),
            applied_jobs=applied,
            interviews=interviews,
            rejected=counts.get("rejected", 0),
            hired=counts.get("hired", 0),
            avg_score=round(avg_score_result, 1) if avg_score_result else None,
            response_rate=response_rate,
        ))

        total_jobs_found += total_jobs
        total_applications += applied
        total_interviews += interviews

    # Get recent activity (last 10 job updates)
    recent_jobs = db.query(CampaignJob, JobListing, JobSearchCampaign).join(
        JobListing, CampaignJob.job_id == JobListing.id
    ).join(
        JobSearchCampaign, CampaignJob.campaign_id == JobSearchCampaign.id
    ).filter(
        CampaignJob.user_id == user.id
    ).order_by(
        CampaignJob.updated_at.desc()
    ).limit(10).all()

    recent_activity = []
    for cj, job, campaign in recent_jobs:
        recent_activity.append({
            "type": "job_update",
            "job_id": job.id,
            "job_title": job.title,
            "company": job.company,
            "campaign_id": campaign.id,
            "campaign_name": campaign.name,
            "status": cj.status,
            "updated_at": cj.updated_at.isoformat() if cj.updated_at else None,
        })

    return DashboardStatsOut(
        total_campaigns=len(campaigns),
        active_campaigns=len(active_campaigns),
        total_jobs_found=total_jobs_found,
        total_applications=total_applications,
        total_interviews=total_interviews,
        campaigns_stats=campaigns_stats,
        recent_activity=recent_activity,
    )


@router.get("/{campaign_id}/stats", response_model=CampaignStatsOut)
def get_campaign_stats(
    campaign_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get statistics for a specific campaign."""
    campaign = db.query(JobSearchCampaign).filter(
        JobSearchCampaign.id == campaign_id,
        JobSearchCampaign.user_id == user.id,
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Get status counts
    status_counts = db.query(
        CampaignJob.status, func.count(CampaignJob.id)
    ).filter(
        CampaignJob.campaign_id == campaign_id
    ).group_by(CampaignJob.status).all()

    counts = {status: count for status, count in status_counts}

    # Calculate average score
    avg_score = db.query(func.avg(CampaignJob.score)).filter(
        CampaignJob.campaign_id == campaign_id,
        CampaignJob.score.isnot(None),
    ).scalar()

    total_jobs = sum(counts.values())
    applied = counts.get("applied", 0)
    interviews = counts.get("interview", 0)

    # Calculate response rate
    response_rate = None
    if applied > 0:
        responses = interviews + counts.get("rejected", 0) + counts.get("hired", 0)
        response_rate = round((responses / applied) * 100, 1)

    return CampaignStatsOut(
        campaign_id=campaign_id,
        total_jobs=total_jobs,
        new_jobs=counts.get("new", 0),
        saved_jobs=counts.get("saved", 0),
        applied_jobs=applied,
        interviews=interviews,
        rejected=counts.get("rejected", 0),
        hired=counts.get("hired", 0),
        avg_score=round(avg_score, 1) if avg_score else None,
        response_rate=response_rate,
    )
