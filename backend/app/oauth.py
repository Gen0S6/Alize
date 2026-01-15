"""
OAuth2 configuration for Google and Apple Sign-In
"""
import os
import secrets
from typing import Optional
from urllib.parse import urlencode

import httpx
from authlib.jose import jwt
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import User
from app.security import create_access_token

router = APIRouter(prefix="/auth/oauth", tags=["oauth"])

# Environment variables for OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
APPLE_CLIENT_ID = os.getenv("APPLE_CLIENT_ID", "")  # Service ID
APPLE_TEAM_ID = os.getenv("APPLE_TEAM_ID", "")
APPLE_KEY_ID = os.getenv("APPLE_KEY_ID", "")
APPLE_PRIVATE_KEY = os.getenv("APPLE_PRIVATE_KEY", "")  # .p8 key content

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


def get_apple_auth_url(state: str) -> str:
    """Generate Apple OAuth authorization URL"""
    params = {
        "client_id": APPLE_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/auth/oauth/apple/callback",
        "response_type": "code",
        "scope": "name email",
        "state": state,
        "response_mode": "form_post",
    }
    return f"https://appleid.apple.com/auth/authorize?{urlencode(params)}"


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


def generate_apple_client_secret() -> str:
    """Generate Apple client secret JWT"""
    import time

    headers = {"alg": "ES256", "kid": APPLE_KEY_ID}
    payload = {
        "iss": APPLE_TEAM_ID,
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400 * 180,  # 180 days
        "aud": "https://appleid.apple.com",
        "sub": APPLE_CLIENT_ID,
    }

    # The private key should be in PEM format
    private_key = APPLE_PRIVATE_KEY.replace("\\n", "\n")
    token = jwt.encode(headers, payload, private_key)
    return token.decode("utf-8") if isinstance(token, bytes) else token


async def exchange_apple_code(code: str) -> dict:
    """Exchange Apple authorization code for tokens and user info"""
    client_secret = generate_apple_client_secret()

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://appleid.apple.com/auth/token",
            data={
                "client_id": APPLE_CLIENT_ID,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": f"{BACKEND_URL}/auth/oauth/apple/callback",
            },
        )
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Apple code")

        tokens = token_response.json()
        id_token = tokens.get("id_token")

        # Decode the ID token to get user info (Apple doesn't have a userinfo endpoint)
        # Note: In production, verify the token signature
        claims = jwt.decode(id_token, None, options={"verify_signature": False})
        return {
            "id": claims.get("sub"),
            "email": claims.get("email"),
            "email_verified": claims.get("email_verified", False),
        }


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


@router.get("/apple")
async def apple_login():
    """Initiate Apple OAuth login"""
    if not APPLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Apple OAuth not configured")

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {"provider": "apple"}

    return RedirectResponse(url=get_apple_auth_url(state))


@router.post("/apple/callback")
async def apple_callback(
    request: Request,
):
    """Handle Apple OAuth callback (uses form_post)"""
    form = await request.form()
    code = form.get("code")
    state = form.get("state")
    error = form.get("error")

    # Apple also sends user info on first login
    user_data = form.get("user")  # JSON string with name, email

    if error:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_denied")

    if not state or state not in _oauth_states:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=invalid_state")

    del _oauth_states[state]

    if not code:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=no_code")

    try:
        # Exchange code for user info
        user_info = await exchange_apple_code(code)

        # Get or create user
        db = next(get_db())
        try:
            user = get_or_create_oauth_user(
                db=db,
                provider="apple",
                oauth_id=user_info.get("id"),
                email=user_info.get("email"),
                email_verified=user_info.get("email_verified", False),
            )

            # Create JWT token
            token = create_access_token(user.id)

            # Redirect to frontend with token
            return RedirectResponse(
                url=f"{FRONTEND_URL}/oauth/callback?token={token}",
                status_code=303,
            )
        finally:
            db.close()
    except Exception as e:
        print(f"Apple OAuth error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_failed")


@router.get("/providers")
async def get_providers():
    """Return available OAuth providers"""
    return {
        "google": bool(GOOGLE_CLIENT_ID),
        "apple": bool(APPLE_CLIENT_ID),
    }
