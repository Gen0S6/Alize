"""
Pytest configuration and fixtures for Alize backend tests.
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment before importing app
os.environ["ENVIRONMENT"] = "test"
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.db import Base
from app.deps import get_db
from main import app


# Create test database engine
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with overridden dependencies."""
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(client):
    """Create a test user and return credentials."""
    user_data = {
        "email": "test@example.com",
        "password": "TestPassword123!",
    }
    response = client.post("/auth/register", json=user_data)
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {
        "email": user_data["email"],
        "password": user_data["password"],
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
def auth_headers(test_user):
    """Return authentication headers for test user."""
    return test_user["headers"]
