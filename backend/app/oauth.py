"""
OAuth2 configuration for Google Sign-In
"""
import os
import secrets
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import User
from app.security import create_access_token

router = APIRouter(prefix="/auth/oauth", tags=["oauth"])

# Environment variables for OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

# Frontend URL for redirects
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# OAuth state storage (in production, use Redis or similar)
_oauth_states: dict[str, dict] = {}


def get_google_auth_url(state: str) -> str:
    """Generate Google OAuth authorization URL"""
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/auth/oauth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


async def exchange_google_code(code: str) -> dict:
    """Exchange Google authorization code for tokens and user info"""
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": f"{BACKEND_URL}/auth/oauth/google/callback",
            },
        )
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code")

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        # Get user info
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")

        return userinfo_response.json()


def get_or_create_oauth_user(
    db: Session,
    provider: str,
    oauth_id: str,
    email: str,
    email_verified: bool = False,
) -> User:
    """Get existing user or create new one from OAuth data"""
    # First, try to find by OAuth provider + ID
    user = db.query(User).filter(
        User.oauth_provider == provider,
        User.oauth_id == oauth_id,
    ).first()

    if user:
        return user

    # Try to find by email (link existing account)
    user = db.query(User).filter(User.email == email).first()
    if user:
        # Link OAuth to existing account
        user.oauth_provider = provider
        user.oauth_id = oauth_id
        if email_verified:
            user.email_verified = True
        db.commit()
        db.refresh(user)
        return user

    # Create new user
    user = User(
        email=email,
        password_hash=None,  # OAuth users don't have a password
        oauth_provider=provider,
        oauth_id=oauth_id,
        email_verified=email_verified,
        notifications_enabled=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ============ Routes ============


@router.get("/google")
async def google_login():
    """Initiate Google OAuth login"""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {"provider": "google"}

    return RedirectResponse(url=get_google_auth_url(state))


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    """Handle Google OAuth callback"""
    if error:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_denied")

    if not state or state not in _oauth_states:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=invalid_state")

    del _oauth_states[state]

    if not code:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=no_code")

    try:
        # Exchange code for user info
        user_info = await exchange_google_code(code)

        # Get or create user
        db = next(get_db())
        try:
            user = get_or_create_oauth_user(
                db=db,
                provider="google",
                oauth_id=user_info.get("id"),
                email=user_info.get("email"),
                email_verified=user_info.get("verified_email", False),
            )

            # Create JWT token
            token = create_access_token(user.id)

            # Redirect to frontend with token
            return RedirectResponse(
                url=f"{FRONTEND_URL}/oauth/callback?token={token}"
            )
        finally:
            db.close()
    except Exception as e:
        print(f"Google OAuth error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_failed")


@router.get("/providers")
async def get_providers():
    """Return available OAuth providers"""
    return {
        "google": bool(GOOGLE_CLIENT_ID),
    }
