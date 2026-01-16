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


class UserJobNotification(Base):
    __tablename__ = "user_job_notifications"
    __table_args__ = (
        Index("ix_user_job_notification_user_job", "user_id", "job_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    notified_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


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


class UserJobVisit(Base):
    __tablename__ = "user_job_visits"
    __table_args__ = (
        Index("ix_user_job_visit_user_job", "user_id", "job_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    visited_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class UserJobBlacklist(Base):
    __tablename__ = "user_job_blacklist"
    __table_args__ = (
        Index("ix_user_job_blacklist_user_job", "user_id", "job_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class UserAnalysisCache(Base):
    __tablename__ = "user_analysis_cache"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    analysis_json = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class JobSearchCampaign(Base):
    """
    Campagne de recherche d'emploi personnalisée.
    Chaque utilisateur peut avoir plusieurs campagnes actives avec des critères différents.
    """
    __tablename__ = "job_search_campaigns"
    __table_args__ = (
        Index("ix_campaign_user_active", "user_id", "is_active"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Informations de la campagne
    name = Column(String(200), nullable=False)  # Nom de la campagne (ex: "Recherche Dev Python Paris")
    description = Column(Text, nullable=True)  # Description optionnelle
    color = Column(String(7), nullable=True)  # Couleur hex pour l'UI (ex: #3B82F6)
    icon = Column(String(50), nullable=True)  # Icône FontAwesome (ex: "briefcase")

    # Critères de recherche spécifiques à cette campagne
    target_role = Column(String(200), nullable=True)  # Poste ciblé
    target_location = Column(String(200), nullable=True)  # Localisation souhaitée
    contract_type = Column(String(100), nullable=True)  # CDI, CDD, Freelance, Stage
    salary_min = Column(Integer, nullable=True)  # Salaire minimum
    salary_max = Column(Integer, nullable=True)  # Salaire maximum
    experience_level = Column(String(50), nullable=True)  # Junior, Confirmé, Senior
    remote_preference = Column(String(50), nullable=True)  # Sur site, Hybride, Full remote

    # Mots-clés
    must_keywords = Column(Text, nullable=True)  # Mots-clés obligatoires (comma-separated)
    nice_keywords = Column(Text, nullable=True)  # Mots-clés souhaités (comma-separated)
    avoid_keywords = Column(Text, nullable=True)  # Mots-clés à éviter (comma-separated)

    # Configuration des notifications
    email_notifications = Column(Boolean, default=True, nullable=False)
    email_frequency = Column(String(20), default="daily", nullable=False)  # instant, daily, weekly
    min_score_for_notification = Column(Integer, default=6, nullable=False)  # Score minimum pour notifier

    # État de la campagne
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)  # Campagne par défaut
    priority = Column(Integer, default=0, nullable=False)  # Ordre d'affichage

    # Statistiques
    jobs_found = Column(Integer, default=0, nullable=False)
    jobs_applied = Column(Integer, default=0, nullable=False)
    jobs_interviewed = Column(Integer, default=0, nullable=False)
    last_search_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class CampaignJob(Base):
    """
    Association entre une campagne et un job trouvé.
    Permet de tracker les jobs par campagne avec leur statut.
    """
    __tablename__ = "campaign_jobs"
    __table_args__ = (
        Index("ix_campaign_job_campaign_status", "campaign_id", "status"),
        Index("ix_campaign_job_user", "user_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("job_search_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Score calculé pour cette campagne
    score = Column(Integer, nullable=True)  # 0-10

    # Statut du job dans cette campagne
    status = Column(String(30), default="new", nullable=False)  # new, saved, applied, interview, rejected, hired

    # Notes personnelles
    notes = Column(Text, nullable=True)

    # Dates importantes
    applied_at = Column(DateTime, nullable=True)
    interview_date = Column(DateTime, nullable=True)
    response_at = Column(DateTime, nullable=True)

    # Tracking
    notified_at = Column(DateTime, nullable=True)
    visited_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class CampaignEmailTemplate(Base):
    """
    Templates d'email personnalisés par campagne.
    Permet d'avoir des emails différents selon le type de poste recherché.
    """
    __tablename__ = "campaign_email_templates"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("job_search_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Type de template
    template_type = Column(String(50), nullable=False)  # notification, application, follow_up

    # Contenu
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=True)

    # Variables disponibles: {job_title}, {company}, {location}, {user_name}, {campaign_name}

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class DashboardConfig(Base):
    """
    Configuration du dashboard personnalisé par utilisateur.
    Permet de sauvegarder les préférences d'affichage.
    """
    __tablename__ = "dashboard_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Layout du dashboard
    layout = Column(Text, nullable=True)  # JSON: configuration des widgets

    # Préférences d'affichage
    default_campaign_id = Column(Integer, ForeignKey("job_search_campaigns.id", ondelete="SET NULL"), nullable=True)
    show_stats = Column(Boolean, default=True, nullable=False)
    show_recent_jobs = Column(Boolean, default=True, nullable=False)
    show_calendar = Column(Boolean, default=True, nullable=False)
    show_analytics = Column(Boolean, default=True, nullable=False)

    # Thème et style
    theme = Column(String(20), default="system", nullable=False)  # light, dark, system
    compact_mode = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class CampaignAnalyticsSnapshot(Base):
    """
    Snapshots périodiques des analytics par campagne.
    Permet de tracker l'évolution dans le temps.
    """
    __tablename__ = "campaign_analytics_snapshots"
    __table_args__ = (
        Index("ix_analytics_campaign_date", "campaign_id", "snapshot_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("job_search_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    snapshot_date = Column(DateTime, nullable=False)

    # Métriques
    total_jobs = Column(Integer, default=0, nullable=False)
    new_jobs = Column(Integer, default=0, nullable=False)
    applied_jobs = Column(Integer, default=0, nullable=False)
    interviews = Column(Integer, default=0, nullable=False)
    avg_score = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
