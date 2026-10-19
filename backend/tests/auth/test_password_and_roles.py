from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User, UserRole

TEMP_PASSWORD = "TemporaryPassword123!"
NEW_PASSWORD = "NewPermanentPassword123!"


def add_protected_routes(app: FastAPI) -> None:
    @app.get("/api/v1/test/business")
    def business(
        _: Annotated[User, Depends(get_current_user)],
    ) -> dict[str, bool]:
        return {"allowed": True}

    @app.get("/api/v1/test/physiotherapist")
    def physiotherapist_only(
        _: Annotated[
            User,
            Depends(require_role(UserRole.PHYSIOTHERAPIST)),
        ],
    ) -> dict[str, bool]:
        return {"allowed": True}


def login(client: TestClient, email: str, password: str) -> dict[str, object]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()


def bearer(token: object) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_temporary_password_blocks_business_until_changed(
    client: TestClient,
    auth_app: FastAPI,
    create_user: Callable[..., User],
) -> None:
    add_protected_routes(auth_app)
    create_user(
        email="temporary@example.com",
        password=TEMP_PASSWORD,
        must_change_password=True,
    )
    tokens = login(client, "temporary@example.com", TEMP_PASSWORD)

    me = client.get("/api/v1/auth/me", headers=bearer(tokens["access_token"]))
    blocked = client.get(
        "/api/v1/test/business",
        headers=bearer(tokens["access_token"]),
    )
    changed = client.post(
        "/api/v1/auth/change-password",
        headers=bearer(tokens["access_token"]),
        json={
            "current_password": TEMP_PASSWORD,
            "new_password": NEW_PASSWORD,
        },
    )

    assert me.status_code == 200
    assert me.json()["must_change_password"] is True
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "password_change_required"
    assert changed.status_code == 204

    old_access = client.get(
        "/api/v1/auth/me",
        headers=bearer(tokens["access_token"]),
    )
    old_refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "temporary@example.com", "password": TEMP_PASSWORD},
    )
    new_tokens = login(client, "temporary@example.com", NEW_PASSWORD)
    allowed = client.get(
        "/api/v1/test/business",
        headers=bearer(new_tokens["access_token"]),
    )

    assert old_access.status_code == 401
    assert old_access.json()["code"] == "access_token_invalidated"
    assert old_refresh.status_code == 401
    assert old_refresh.json()["code"] == "refresh_token_revoked"
    assert old_login.status_code == 401
    assert allowed.status_code == 200


def test_change_password_requires_current_password(
    client: TestClient,
    create_user: Callable[..., User],
) -> None:
    create_user(email="user@example.com", password=TEMP_PASSWORD)
    tokens = login(client, "user@example.com", TEMP_PASSWORD)

    response = client.post(
        "/api/v1/auth/change-password",
        headers=bearer(tokens["access_token"]),
        json={
            "current_password": "IncorrectPassword123!",
            "new_password": NEW_PASSWORD,
        },
    )

    assert response.status_code == 400
    assert response.json()["code"] == "current_password_invalid"


def test_role_dependency_allows_only_declared_role(
    client: TestClient,
    auth_app: FastAPI,
    create_user: Callable[..., User],
) -> None:
    add_protected_routes(auth_app)
    create_user(
        email="physio@example.com",
        password=TEMP_PASSWORD,
        role=UserRole.PHYSIOTHERAPIST,
    )
    create_user(
        email="patient@example.com",
        password=TEMP_PASSWORD,
        role=UserRole.PATIENT,
    )
    physio = login(client, "physio@example.com", TEMP_PASSWORD)
    patient = login(client, "patient@example.com", TEMP_PASSWORD)

    allowed = client.get(
        "/api/v1/test/physiotherapist",
        headers=bearer(physio["access_token"]),
    )
    blocked = client.get(
        "/api/v1/test/physiotherapist",
        headers=bearer(patient["access_token"]),
    )

    assert allowed.status_code == 200
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "insufficient_role"
