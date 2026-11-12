from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.modules.auth.models import RefreshToken, User
from app.modules.auth.security import TokenService

PASSWORD = "SecurePassword123!"


def login(client: TestClient, email: str = "user@example.com") -> dict[str, object]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert response.status_code == 200
    return response.json()


def test_refresh_rotates_and_revokes_previous_token(
    client: TestClient,
    create_user: Callable[..., User],
) -> None:
    create_user(email="user@example.com", password=PASSWORD)
    original = login(client)

    rotated = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original["refresh_token"]},
    )

    assert rotated.status_code == 200
    new_tokens = rotated.json()
    assert new_tokens["refresh_token"] != original["refresh_token"]
    assert new_tokens["access_token"] != original["access_token"]

    reused = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original["refresh_token"]},
    )
    assert reused.status_code == 401
    assert reused.json()["code"] == "refresh_token_revoked"

    accepted = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": new_tokens["refresh_token"]},
    )
    assert accepted.status_code == 200


def test_logout_revokes_refresh_token(
    client: TestClient,
    create_user: Callable[..., User],
) -> None:
    create_user(email="user@example.com", password=PASSWORD)
    tokens = login(client)

    logout = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert logout.status_code == 204

    refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert refresh.status_code == 401
    assert refresh.json()["code"] == "refresh_token_revoked"


def test_unknown_refresh_token_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "unknown-refresh-token-value-with-enough-length"},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_refresh_token"


def test_expired_refresh_token_is_rejected(
    client: TestClient,
    auth_app: FastAPI,
    create_user: Callable[..., User],
) -> None:
    user = create_user(email="user@example.com", password=PASSWORD)
    tokens = login(client)

    with auth_app.state.database.session() as session:
        stored = session.scalar(
            select(RefreshToken).where(RefreshToken.user_id == user.id)
        )
        assert stored is not None
        stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)

    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "refresh_token_expired"


def test_expired_access_token_is_rejected(
    client: TestClient,
    auth_app: FastAPI,
    create_user: Callable[..., User],
) -> None:
    user = create_user(email="user@example.com", password=PASSWORD)
    token = TokenService(auth_app.state.settings).create_access_token(
        user,
        now=datetime.now(UTC) - timedelta(minutes=16),
    )

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "access_token_expired"


def test_account_disabled_after_login_is_blocked(
    client: TestClient,
    auth_app: FastAPI,
    create_user: Callable[..., User],
) -> None:
    user = create_user(email="user@example.com", password=PASSWORD)
    tokens = login(client)

    with auth_app.state.database.session() as session:
        stored_user = session.get(User, user.id)
        assert stored_user is not None
        stored_user.is_active = False

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )

    assert me.status_code == 403
    assert me.json()["code"] == "account_inactive"
    assert refresh.status_code == 403
    assert refresh.json()["code"] == "account_inactive"
