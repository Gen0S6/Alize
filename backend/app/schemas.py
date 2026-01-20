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
    is_saved: Optional[bool] = None  # Pour indiquer si l'offre est sauvegardée
    status: Optional[str] = None  # new, viewed, saved, deleted
    created_at: Optional[datetime] = None
    match_reasons: List[str] = []


class MatchesPage(BaseModel):
    items: List[JobOut]
    total: int
    page: int
    page_size: int
    available_sources: List[str] = []
    new_count: int = 0  # Total count of new offers (for badge)


class WorkExperience(BaseModel):
    """Structured work experience from CV"""
    company: Optional[str] = None
    title: Optional[str] = None
    period: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = False
    duration_years: Optional[float] = None
    responsibilities: List[str] = []
    achievements: List[str] = []


class Project(BaseModel):
    """Project extracted from CV"""
    name: Optional[str] = None
    description: Optional[str] = None
    technologies: List[str] = []
    impact: Optional[str] = None


class Achievement(BaseModel):
    """Quantified achievement from CV"""
    type: str  # growth, cost_saving, team_management, project, business, other
    value: Optional[str] = None
    context: str
    raw_match: Optional[str] = None


class CertificationItem(BaseModel):
    """Individual certification"""
    name: str
    score: Optional[str] = None


class CVQualityBreakdown(BaseModel):
    """Breakdown of CV quality score by category"""
    score: int
    max: int
    percentage: int


class CVQualityScore(BaseModel):
    """CV quality assessment"""
    total_score: int  # 0-100
    grade: str  # A, B, C, D, E
    assessment: str  # Overall assessment text
    breakdown: dict[str, CVQualityBreakdown] = {}
    suggestions: List[str] = []
    strengths: List[str] = []


class AnalysisOut(BaseModel):
    """Comprehensive CV analysis output"""
    # Basic info
    cv_present: bool
    llm_used: bool = False
    summary: str

    # Target profile
    titre_poste_cible: Optional[str] = None
    inferred_roles: List[str] = []
    secteurs_cibles: List[str] = []

    # Experience
    niveau_experience: Optional[str] = None
    experience_level: Optional[str] = None  # Alias for compatibility
    total_experience_years: float = 0
    experiences: List[dict] = []  # List of WorkExperience as dict

    # Skills
    top_keywords: List[str] = []
    competences_techniques: List[str] = []
    competences_transversales: List[str] = []
    skill_categories: dict[str, List[str]] = {}
    skills_by_category: dict[str, List[str]] = {}
    tech_skills_count: int = 0

    # Education & Certifications
    formation: Optional[str] = None
    education: dict[str, List[str]] = {}  # {"ecoles": [], "diplomes": []}
    certifications: dict[str, List[dict]] = {}  # By category
    certifications_list: List[str] = []  # Flat list for display

    # Languages
    langues: List[str] = []

    # Achievements & Projects
    achievements: List[dict] = []  # List of Achievement as dict
    projets: List[dict] = []  # List of Project as dict

    # CV Quality
    cv_quality_score: Optional[dict] = None  # CVQualityScore as dict
    points_forts: List[str] = []
    axes_amelioration: List[str] = []
    conseils_personnalises: List[str] = []

    # Job search
    suggested_queries: List[str] = []
    must_hits: List[str] = []
    missing_must: List[str] = []


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


# ========== User Job Schemas (Simplified Dashboard) ==========

class UserJobUpdate(BaseModel):
    """Mettre à jour le statut d'une offre"""
    status: str = Field(pattern=r"^(new|viewed|saved|deleted)$")


class UserJobOut(BaseModel):
    """Offre dans le dashboard de l'utilisateur"""
    id: int
    job_id: int
    score: Optional[int] = None
    status: str
    created_at: datetime
    viewed_at: Optional[datetime] = None

    # Job info (joined)
    job: Optional[JobOut] = None


class UserJobsPage(BaseModel):
    """Page d'offres pour le dashboard"""
    items: List[UserJobOut]
    total: int
    page: int
    page_size: int
    new_count: int = 0  # Nombre d'offres non consultées
    viewed_count: int = 0
    saved_count: int = 0


class DashboardStatsOut(BaseModel):
    """Statistiques simples du dashboard"""
    total_jobs: int
    new_jobs: int
    viewed_jobs: int
    saved_jobs: int
    last_search_at: Optional[datetime] = None
    next_email_at: Optional[datetime] = None
