from collections.abc import Callable

from fastapi.testclient import TestClient

from app.modules.auth.models import User, UserRole


def _create_patient(client: TestClient, headers: dict[str, str]) -> dict[str, object]:
    response = client.post(
        "/api/v1/patients",
        headers=headers,
        json={"full_name": "Access Patient", "email": "access@example.com"},
    )
    assert response.status_code == 201
    return response.json()


def test_create_reset_deactivate_and_reactivate_patient_access(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    create_user(email="professional@example.com", role=UserRole.PHYSIOTHERAPIST)
    headers = login_headers("professional@example.com")
    patient = _create_patient(client, headers)
    path = f"/api/v1/patients/{patient['id']}/access"

    created = client.post(path, headers=headers, json={"operation": "activate"})
    assert created.status_code == 200
    assert created.json()["action"] == "created"
    first_password = created.json()["temporary_password"]
    assert "password_hash" not in created.json()

    redundant_activation = client.post(
        path, headers=headers, json={"operation": "activate"}
    )
    assert redundant_activation.status_code == 409
    assert redundant_activation.json()["code"] == "patient_access_already_active"

    temporary_login = client.post(
        "/api/v1/auth/login",
        json={"email": "access@example.com", "password": first_password},
    )
    assert temporary_login.status_code == 200
    temporary_headers = {
        "Authorization": f"Bearer {temporary_login.json()['access_token']}"
    }
    blocked = client.get("/api/v1/patients", headers=temporary_headers)
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "password_change_required"

    reset = client.post(
        path,
        headers=headers,
        json={"operation": "reset_temporary_password"},
    )
    assert reset.status_code == 200
    assert reset.json()["action"] == "temporary_password_reset"
    assert reset.json()["temporary_password"] != first_password
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "access@example.com", "password": first_password},
        ).status_code
        == 401
    )

    client.patch(
        f"/api/v1/patients/{patient['id']}",
        headers=headers,
        json={"is_active": False},
    )
    client.patch(
        f"/api/v1/patients/{patient['id']}",
        headers=headers,
        json={"is_active": True},
    )
    activated = client.post(path, headers=headers, json={"operation": "activate"})
    assert activated.status_code == 200
    assert activated.json()["action"] == "activated"


def test_access_requires_email_and_valid_state(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    create_user(email="professional@example.com", role=UserRole.PHYSIOTHERAPIST)
    headers = login_headers("professional@example.com")
    patient = client.post(
        "/api/v1/patients",
        headers=headers,
        json={"full_name": "No Email"},
    ).json()
    path = f"/api/v1/patients/{patient['id']}/access"

    missing_email = client.post(path, headers=headers, json={"operation": "activate"})
    assert missing_email.status_code == 409
    assert missing_email.json()["code"] == "patient_email_required"

    reset_without_account = client.post(
        path,
        headers=headers,
        json={"operation": "reset_temporary_password"},
    )
    assert reset_without_account.status_code == 409
    assert reset_without_account.json()["code"] == "patient_email_required"

    client.patch(
        f"/api/v1/patients/{patient['id']}",
        headers=headers,
        json={"email": "new@example.com"},
    )
    reset_before_creation = client.post(
        path,
        headers=headers,
        json={"operation": "reset_temporary_password"},
    )
    assert reset_before_creation.status_code == 409
    assert reset_before_creation.json()["code"] == "patient_access_not_created"

    client.patch(
        f"/api/v1/patients/{patient['id']}",
        headers=headers,
        json={"is_active": False},
    )
    inactive = client.post(path, headers=headers, json={"operation": "activate"})
    assert inactive.status_code == 409
    assert inactive.json()["code"] == "patient_inactive"


def test_account_email_changes_with_patient_and_cannot_be_cleared(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    create_user(email="professional@example.com", role=UserRole.PHYSIOTHERAPIST)
    headers = login_headers("professional@example.com")
    patient = _create_patient(client, headers)
    access = client.post(
        f"/api/v1/patients/{patient['id']}/access",
        headers=headers,
        json={"operation": "activate"},
    ).json()

    changed = client.patch(
        f"/api/v1/patients/{patient['id']}",
        headers=headers,
        json={"email": "changed@example.com"},
    )
    assert changed.status_code == 200
    assert changed.json()["email"] == "changed@example.com"
    assert (
        client.post(
            "/api/v1/auth/login",
            json={
                "email": "changed@example.com",
                "password": access["temporary_password"],
            },
        ).status_code
        == 200
    )

    cleared = client.patch(
        f"/api/v1/patients/{patient['id']}",
        headers=headers,
        json={"email": None},
    )
    assert cleared.status_code == 409
    assert cleared.json()["code"] == "patient_email_required_for_access"


def test_account_conflict_does_not_attach_wrong_user(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    create_user(email="professional@example.com", role=UserRole.PHYSIOTHERAPIST)
    create_user(email="existing@example.com", role=UserRole.PATIENT)
    headers = login_headers("professional@example.com")
    patient = client.post(
        "/api/v1/patients",
        headers=headers,
        json={"full_name": "Conflict", "email": "existing@example.com"},
    ).json()

    conflict = client.post(
        f"/api/v1/patients/{patient['id']}/access",
        headers=headers,
        json={"operation": "activate"},
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "email_conflict"
    detail = client.get(f"/api/v1/patients/{patient['id']}", headers=headers)
    assert detail.json()["has_access"] is False
