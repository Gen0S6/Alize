from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from pydantic import Field

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PreferenceIn(BaseModel):
    role: Optional[str] = None
    location: Optional[str] = None
    contract_type: Optional[str] = None
    salary_min: Optional[int] = None
    must_keywords: Optional[str] = None
    avoid_keywords: Optional[str] = None


class PreferenceOut(PreferenceIn):
    id: int
    user_id: int


class CVOut(BaseModel):
    id: int
    filename: str
    created_at: datetime
    text: Optional[str] = None
    url: str


class JobOut(BaseModel):
    id: int
    source: str
    title: str
    company: str
    location: Optional[str] = None
    url: str
    description: Optional[str] = None
    salary_min: Optional[int] = None
    score: Optional[int] = None
    is_remote: Optional[bool] = None
    is_new: Optional[bool] = None
    created_at: Optional[datetime] = None


class MatchesPage(BaseModel):
    items: List[JobOut]
    total: int
    page: int
    page_size: int
    available_sources: List[str] = []
    new_count: int = 0  # Total count of new offers (for badge)


class AnalysisOut(BaseModel):
    cv_present: bool
    top_keywords: list[str]
    inferred_roles: list[str]
    suggested_queries: list[str]
    must_hits: list[str]
    missing_must: list[str]
    summary: str
    llm_used: bool = False
    # Enhanced CV analysis fields
    experience_level: Optional[str] = None
    skill_categories: dict[str, list[str]] = {}
    tech_skills_count: int = 0


class JobSearchOut(BaseModel):
    inserted: int
    tried_queries: list[str]
    sources: dict[str, int]
    analysis: AnalysisOut


class ProfileOut(BaseModel):
    id: int
    email: EmailStr
    notifications_enabled: bool
    email_verified: bool = False
    created_at: datetime


class ProfileUpdate(BaseModel):
    email: Optional[EmailStr] = None
    current_password: Optional[str] = Field(default=None, min_length=1, description="Required when changing password")
    new_password: Optional[str] = Field(default=None, min_length=8)
    notifications_enabled: Optional[bool] = None


class JobSearchRunOut(BaseModel):
    id: int
    inserted: int
    tried_queries: list[str]
    sources: dict
    created_at: datetime


# Password Reset Schemas
class PasswordResetRequest(BaseModel):
    """Request a password reset email"""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Confirm password reset with token"""
    token: str = Field(min_length=32, max_length=64)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetResponse(BaseModel):
    """Response for password reset request"""
    message: str
    success: bool = True


# Email Verification Schemas
class EmailVerificationRequest(BaseModel):
    """Request email verification resend"""
    email: Optional[EmailStr] = None


class EmailVerificationConfirm(BaseModel):
    """Confirm email with token"""
    token: str = Field(min_length=32, max_length=64)


class EmailVerificationResponse(BaseModel):
    """Response for email verification"""
    message: str
    success: bool = True


# ========== Campaign Schemas ==========

class CampaignCreate(BaseModel):
    """Création d'une nouvelle campagne de recherche"""
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    color: Optional[str] = Field(default="#3B82F6", pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(default="briefcase", max_length=50)

    # Critères de recherche
    target_role: Optional[str] = Field(default=None, max_length=200)
    target_location: Optional[str] = Field(default=None, max_length=200)
    contract_type: Optional[str] = Field(default=None, max_length=100)
    salary_min: Optional[int] = Field(default=None, ge=0)
    salary_max: Optional[int] = Field(default=None, ge=0)
    experience_level: Optional[str] = Field(default=None, max_length=50)
    remote_preference: Optional[str] = Field(default=None, max_length=50)

    # Mots-clés
    must_keywords: Optional[str] = None
    nice_keywords: Optional[str] = None
    avoid_keywords: Optional[str] = None

    # Notifications
    email_notifications: bool = True
    email_frequency: str = Field(default="daily", pattern=r"^(instant|daily|weekly)$")
    min_score_for_notification: int = Field(default=6, ge=0, le=10)

    is_default: bool = False
    priority: int = Field(default=0, ge=0)


class CampaignUpdate(BaseModel):
    """Mise à jour d'une campagne existante"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(default=None, max_length=50)

    target_role: Optional[str] = Field(default=None, max_length=200)
    target_location: Optional[str] = Field(default=None, max_length=200)
    contract_type: Optional[str] = Field(default=None, max_length=100)
    salary_min: Optional[int] = Field(default=None, ge=0)
    salary_max: Optional[int] = Field(default=None, ge=0)
    experience_level: Optional[str] = Field(default=None, max_length=50)
    remote_preference: Optional[str] = Field(default=None, max_length=50)

    must_keywords: Optional[str] = None
    nice_keywords: Optional[str] = None
    avoid_keywords: Optional[str] = None

    email_notifications: Optional[bool] = None
    email_frequency: Optional[str] = Field(default=None, pattern=r"^(instant|daily|weekly)$")
    min_score_for_notification: Optional[int] = Field(default=None, ge=0, le=10)

    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    priority: Optional[int] = Field(default=None, ge=0)


class CampaignOut(BaseModel):
    """Campagne avec toutes ses informations"""
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None

    target_role: Optional[str] = None
    target_location: Optional[str] = None
    contract_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    experience_level: Optional[str] = None
    remote_preference: Optional[str] = None

    must_keywords: Optional[str] = None
    nice_keywords: Optional[str] = None
    avoid_keywords: Optional[str] = None

    email_notifications: bool
    email_frequency: str
    min_score_for_notification: int

    is_active: bool
    is_default: bool
    priority: int

    jobs_found: int
    jobs_applied: int
    jobs_interviewed: int
    last_search_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime


class CampaignListOut(BaseModel):
    """Liste des campagnes avec stats résumées"""
    campaigns: List[CampaignOut]
    total: int
    active_count: int


# ========== Campaign Job Schemas ==========

class CampaignJobCreate(BaseModel):
    """Associer un job à une campagne"""
    job_id: int
    status: str = Field(default="new", pattern=r"^(new|saved|applied|interview|rejected|hired)$")
    notes: Optional[str] = None


class CampaignJobUpdate(BaseModel):
    """Mettre à jour le statut d'un job dans une campagne"""
    status: Optional[str] = Field(default=None, pattern=r"^(new|saved|applied|interview|rejected|hired)$")
    notes: Optional[str] = None
    applied_at: Optional[datetime] = None
    interview_date: Optional[datetime] = None


class CampaignJobOut(BaseModel):
    """Job dans une campagne avec son statut"""
    id: int
    campaign_id: int
    job_id: int
    score: Optional[int] = None
    status: str
    notes: Optional[str] = None
    applied_at: Optional[datetime] = None
    interview_date: Optional[datetime] = None
    visited_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Job info (joined)
    job: Optional[JobOut] = None


class CampaignJobsPage(BaseModel):
    """Page de jobs pour une campagne"""
    items: List[CampaignJobOut]
    total: int
    page: int
    page_size: int
    stats: dict = {}


# ========== Email Template Schemas ==========

class EmailTemplateCreate(BaseModel):
    """Créer un template d'email pour une campagne"""
    campaign_id: int
    template_type: str = Field(pattern=r"^(notification|application|follow_up)$")
    subject: Optional[str] = Field(default=None, max_length=500)
    body: Optional[str] = None


class EmailTemplateUpdate(BaseModel):
    """Mettre à jour un template d'email"""
    subject: Optional[str] = Field(default=None, max_length=500)
    body: Optional[str] = None
    is_active: Optional[bool] = None


class EmailTemplateOut(BaseModel):
    """Template d'email"""
    id: int
    campaign_id: int
    template_type: str
    subject: Optional[str] = None
    body: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ========== Dashboard Config Schemas ==========

class DashboardConfigUpdate(BaseModel):
    """Mettre à jour la configuration du dashboard"""
    layout: Optional[str] = None  # JSON string
    default_campaign_id: Optional[int] = None
    show_stats: Optional[bool] = None
    show_recent_jobs: Optional[bool] = None
    show_calendar: Optional[bool] = None
    show_analytics: Optional[bool] = None
    theme: Optional[str] = Field(default=None, pattern=r"^(light|dark|system)$")
    compact_mode: Optional[bool] = None


class DashboardConfigOut(BaseModel):
    """Configuration du dashboard"""
    id: int
    user_id: int
    layout: Optional[str] = None
    default_campaign_id: Optional[int] = None
    show_stats: bool
    show_recent_jobs: bool
    show_calendar: bool
    show_analytics: bool
    theme: str
    compact_mode: bool
    created_at: datetime
    updated_at: datetime


# ========== Analytics Schemas ==========

class CampaignStatsOut(BaseModel):
    """Statistiques d'une campagne"""
    campaign_id: int
    total_jobs: int
    new_jobs: int
    saved_jobs: int
    applied_jobs: int
    interviews: int
    rejected: int
    hired: int
    avg_score: Optional[float] = None
    response_rate: Optional[float] = None


class DashboardStatsOut(BaseModel):
    """Statistiques globales du dashboard"""
    total_campaigns: int
    active_campaigns: int
    total_jobs_found: int
    total_applications: int
    total_interviews: int
    campaigns_stats: List[CampaignStatsOut]
    recent_activity: List[dict] = []


class AnalyticsSnapshotOut(BaseModel):
    """Snapshot des analytics"""
    id: int
    campaign_id: int
    snapshot_date: datetime
    total_jobs: int
    new_jobs: int
    applied_jobs: int
    interviews: int
    avg_score: Optional[int] = None
    created_at: datetime
