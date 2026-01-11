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


class AnalysisOut(BaseModel):
    cv_present: bool
    top_keywords: list[str]
    inferred_roles: list[str]
    suggested_queries: list[str]
    must_hits: list[str]
    missing_must: list[str]
    summary: str
    llm_used: bool = False


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
