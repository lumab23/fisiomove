from collections.abc import Callable

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.modules.auth.models import RefreshToken, User
from app.modules.auth.security import TokenService

PASSWORD = "SecurePassword123!"


def test_login_and_authenticated_identity(
    client: TestClient,
    auth_app: FastAPI,
    create_user: Callable[..., User],
) -> None:
    user = create_user(email="USER@EXAMPLE.COM", password=PASSWORD)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": PASSWORD},
    )

    assert response.status_code == 200
    tokens = response.json()
    assert tokens["token_type"] == "bearer"
    assert tokens["expires_in"] == 900
    assert tokens["access_token"]
    assert tokens["refresh_token"]

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["id"] == str(user.id)
    assert me.json()["email"] == "user@example.com"
    assert "password_hash" not in me.json()

    token_hash = TokenService.hash_refresh_token(tokens["refresh_token"])
    with auth_app.state.database.session() as session:
        stored = session.scalar(
            select(RefreshToken).where(RefreshToken.user_id == user.id)
        )
        stored_user = session.get(User, user.id)
        assert stored is not None
        assert stored.token_hash == token_hash
        assert tokens["refresh_token"] not in stored.token_hash
        assert stored_user is not None
        assert stored_user.password_hash.startswith("$argon2")
        assert PASSWORD not in stored_user.password_hash


def test_invalid_credentials_are_rejected_without_tokens(
    client: TestClient,
    create_user: Callable[..., User],
) -> None:
    create_user(email="user@example.com", password=PASSWORD)

    wrong_password = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "WrongPassword123!"},
    )
    unknown_user = client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": PASSWORD},
    )

    assert wrong_password.status_code == 401
    assert wrong_password.json()["code"] == "invalid_credentials"
    assert "access_token" not in wrong_password.json()
    assert unknown_user.status_code == 401
    assert unknown_user.json()["code"] == "invalid_credentials"


def test_inactive_account_cannot_login(
    client: TestClient,
    create_user: Callable[..., User],
) -> None:
    create_user(
        email="inactive@example.com",
        password=PASSWORD,
        is_active=False,
    )

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "inactive@example.com", "password": PASSWORD},
    )

    assert response.status_code == 403
    assert response.json()["code"] == "account_inactive"
