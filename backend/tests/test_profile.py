"""
Tests for profile endpoints.
"""
import pytest


class TestGetProfile:
    """Tests for getting user profile."""

    def test_get_profile_success(self, client, test_user, auth_headers):
        """Test successful profile retrieval."""
        response = client.get("/profile", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user["email"]
        assert "id" in data
        assert "notifications_enabled" in data
        assert "created_at" in data


class TestUpdateProfile:
    """Tests for updating user profile."""

    def test_update_notifications_enabled(self, client, auth_headers):
        """Test updating notification preferences."""
        response = client.put(
            "/profile",
            headers=auth_headers,
            json={"notifications_enabled": False},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["notifications_enabled"] is False

    def test_update_email(self, client, auth_headers):
        """Test updating email address."""
        response = client.put(
            "/profile",
            headers=auth_headers,
            json={"email": "newemail@example.com"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "newemail@example.com"

    def test_update_password_requires_current_password(self, client, auth_headers):
        """Test that updating password requires current password."""
        response = client.put(
            "/profile",
            headers=auth_headers,
            json={"new_password": "NewSecurePassword123!"},
        )
        assert response.status_code == 400
        assert "actuel" in response.json()["detail"].lower()

    def test_update_password_with_wrong_current_password(
        self, client, auth_headers
    ):
        """Test updating password with wrong current password fails."""
        response = client.put(
            "/profile",
            headers=auth_headers,
            json={
                "current_password": "WrongPassword123!",
                "new_password": "NewSecurePassword123!",
            },
        )
        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()

    def test_update_password_success(self, client, test_user, auth_headers):
        """Test successful password update."""
        response = client.put(
            "/profile",
            headers=auth_headers,
            json={
                "current_password": test_user["password"],
                "new_password": "NewSecurePassword123!",
            },
        )
        assert response.status_code == 200

        # Verify new password works
        login_response = client.post(
            "/auth/login",
            json={
                "email": test_user["email"],
                "password": "NewSecurePassword123!",
            },
        )
        assert login_response.status_code == 200


class TestDeleteProfile:
    """Tests for deleting user profile."""

    def test_delete_profile_success(self, client, test_user, auth_headers):
        """Test successful profile deletion."""
        response = client.delete("/profile", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["deleted"] is True

        # Verify user can no longer log in
        login_response = client.post(
            "/auth/login",
            json={
                "email": test_user["email"],
                "password": test_user["password"],
            },
        )
        assert login_response.status_code == 401
