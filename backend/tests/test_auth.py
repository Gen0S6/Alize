"""
Tests for authentication endpoints.
"""
import pytest


class TestRegister:
    """Tests for user registration."""

    def test_register_success(self, client):
        """Test successful user registration."""
        response = client.post(
            "/auth/register",
            json={"email": "newuser@example.com", "password": "SecurePassword123!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_register_duplicate_email(self, client, test_user):
        """Test registration with existing email fails."""
        response = client.post(
            "/auth/register",
            json={"email": test_user["email"], "password": "AnotherPassword123!"},
        )
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    def test_register_weak_password(self, client):
        """Test registration with weak password fails."""
        response = client.post(
            "/auth/register",
            json={"email": "weak@example.com", "password": "short"},
        )
        assert response.status_code == 422  # Validation error

    def test_register_common_password(self, client):
        """Test registration with common password fails."""
        response = client.post(
            "/auth/register",
            json={"email": "common@example.com", "password": "password123"},
        )
        # Either validation error or business logic error
        assert response.status_code in [400, 422]

    def test_register_invalid_email(self, client):
        """Test registration with invalid email fails."""
        response = client.post(
            "/auth/register",
            json={"email": "not-an-email", "password": "SecurePassword123!"},
        )
        assert response.status_code == 422


class TestLogin:
    """Tests for user login."""

    def test_login_success(self, client, test_user):
        """Test successful login."""
        response = client.post(
            "/auth/login",
            json={"email": test_user["email"], "password": test_user["password"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, test_user):
        """Test login with wrong password fails."""
        response = client.post(
            "/auth/login",
            json={"email": test_user["email"], "password": "WrongPassword123!"},
        )
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()

    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user fails."""
        response = client.post(
            "/auth/login",
            json={"email": "nonexistent@example.com", "password": "SomePassword123!"},
        )
        assert response.status_code == 401


class TestAuthentication:
    """Tests for authenticated endpoints."""

    def test_access_protected_route_with_token(self, client, auth_headers):
        """Test accessing protected route with valid token."""
        response = client.get("/profile", headers=auth_headers)
        assert response.status_code == 200

    def test_access_protected_route_without_token(self, client):
        """Test accessing protected route without token fails."""
        response = client.get("/profile")
        assert response.status_code in [401, 403]

    def test_access_protected_route_with_invalid_token(self, client):
        """Test accessing protected route with invalid token fails."""
        response = client.get(
            "/profile",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code in [401, 403]
