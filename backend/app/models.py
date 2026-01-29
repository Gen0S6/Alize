from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Index
from datetime import datetime, timezone
from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)  # Nullable for OAuth users
    notifications_enabled = Column(Boolean, default=True, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    # OAuth fields
    oauth_provider = Column(String(20), nullable=True, index=True)  # "google", "apple", or null
    oauth_id = Column(String(255), nullable=True, index=True)  # Provider's unique user ID
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class PasswordResetToken(Base):
    """Token for password reset requests"""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class EmailVerificationToken(Base):
    """Token for email verification"""
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class CV(Base):
    __tablename__ = "cvs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    role = Column(String(200), nullable=True)
    location = Column(String(200), nullable=True)
    contract_type = Column(String(100), nullable=True)
    salary_min = Column(Integer, nullable=True)
    must_keywords = Column(Text, nullable=True)  # comma-separated
    avoid_keywords = Column(Text, nullable=True)  # comma-separated

    # Notifications preferences
    notification_frequency = Column(String(20), default="every_3_days", nullable=False)
    send_empty_digest = Column(Boolean, default=True, nullable=False)
    notification_max_jobs = Column(Integer, default=5, nullable=False)

    # Recherche automatique
    last_search_at = Column(DateTime, nullable=True)  # Dernière recherche automatique
    last_email_at = Column(DateTime, nullable=True)   # Dernier email envoyé

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class JobListing(Base):
    __tablename__ = "job_listings"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(50), nullable=False, index=True)  # e.g. LinkedIn
    title = Column(String(500), nullable=False)
    company = Column(String(200), nullable=False, index=True)
    location = Column(String(200), nullable=True, index=True)
    url = Column(String(2000), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    salary_min = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)


class UserJob(Base):
    """
    Association simple entre un utilisateur et une offre d'emploi.
    Chaque utilisateur a son propre dashboard avec ses offres personnalisées.
    """
    __tablename__ = "user_jobs"
    __table_args__ = (
        Index("ix_user_job_user_status", "user_id", "status"),
        Index("ix_user_job_user_job", "user_id", "job_id", unique=True),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False, index=True)

    # Score de pertinence (0-10)
    score = Column(Integer, nullable=True)

    # Statut simple : new (non consulté), viewed (consulté), saved (sauvegardé), deleted (supprimé)
    status = Column(String(20), default="new", nullable=False)

    # Dates
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    viewed_at = Column(DateTime, nullable=True)
    notified_at = Column(DateTime, nullable=True)  # Dernière notification par email


class JobSearchRun(Base):
    __tablename__ = "job_search_runs"
    __table_args__ = (
        # Composite index for efficient "latest run by user" queries
        Index("ix_job_search_run_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    inserted = Column(Integer, nullable=False)
    tried_queries = Column(Text, nullable=True)  # JSON list
    sources = Column(Text, nullable=True)  # JSON dict
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    analysis_json = Column(Text, nullable=True)


class UserAnalysisCache(Base):
    __tablename__ = "user_analysis_cache"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    analysis_json = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
