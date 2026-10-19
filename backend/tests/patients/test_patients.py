from collections.abc import Callable

from fastapi.testclient import TestClient

from app.modules.auth.models import User, UserRole


def test_professional_creates_lists_gets_and_updates_linked_patients(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    create_user(email="professional@example.com", role=UserRole.PHYSIOTHERAPIST)
    headers = login_headers("professional@example.com")

    created_ids = []
    for number in range(3):
        response = client.post(
            "/api/v1/patients",
            headers=headers,
            json={
                "full_name": f"Patient {number}",
                "email": f"patient{number}@example.com",
                "phone": f"8599999000{number}",
            },
        )
        assert response.status_code == 201
        created_ids.append(response.json()["id"])
        assert response.json()["has_access"] is False

    first_page = client.get("/api/v1/patients?page=1&page_size=2", headers=headers)
    assert first_page.status_code == 200
    assert len(first_page.json()["items"]) == 2
    assert first_page.json() | {"items": []} == {
        "items": [],
        "page": 1,
        "page_size": 2,
        "total": 3,
        "pages": 2,
    }
    assert (
        len(
            client.get("/api/v1/patients?page=2&page_size=2", headers=headers).json()[
                "items"
            ]
        )
        == 1
    )
    assert (
        client.get("/api/v1/patients?page=3&page_size=2", headers=headers).json()[
            "items"
        ]
        == []
    )

    patient_id = created_ids[0]
    detail = client.get(f"/api/v1/patients/{patient_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["full_name"] == "Patient 0"

    updated = client.patch(
        f"/api/v1/patients/{patient_id}",
        headers=headers,
        json={"full_name": "Updated Patient", "phone": None},
    )
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Updated Patient"
    assert updated.json()["phone"] is None


def test_deactivation_preserves_record_and_blocks_patient_account(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    create_user(email="professional@example.com", role=UserRole.PHYSIOTHERAPIST)
    headers = login_headers("professional@example.com")
    patient = client.post(
        "/api/v1/patients",
        headers=headers,
        json={"full_name": "Ana Patient", "email": "ana@example.com"},
    ).json()
    access = client.post(
        f"/api/v1/patients/{patient['id']}/access",
        headers=headers,
        json={"operation": "activate"},
    ).json()
    session = client.post(
        "/api/v1/auth/login",
        json={
            "email": "ana@example.com",
            "password": access["temporary_password"],
        },
    ).json()

    deactivated = client.patch(
        f"/api/v1/patients/{patient['id']}",
        headers=headers,
        json={"is_active": False},
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
    assert deactivated.json()["access_is_active"] is False
    assert (
        client.get(f"/api/v1/patients/{patient['id']}", headers=headers).status_code
        == 200
    )

    blocked_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "ana@example.com",
            "password": access["temporary_password"],
        },
    )
    assert blocked_login.status_code == 403
    assert blocked_login.json()["code"] == "account_inactive"
    blocked_identity = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {session['access_token']}"},
    )
    assert blocked_identity.status_code == 403
    assert blocked_identity.json()["code"] == "account_inactive"
    blocked_refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": session["refresh_token"]},
    )
    assert blocked_refresh.status_code == 401
    assert blocked_refresh.json()["code"] == "refresh_token_revoked"


def test_patient_role_cannot_manage_patients(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    create_user(email="patient@example.com", role=UserRole.PATIENT)
    headers = login_headers("patient@example.com")

    assert client.get("/api/v1/patients", headers=headers).status_code == 403
    response = client.post(
        "/api/v1/patients",
        headers=headers,
        json={"full_name": "Another Patient"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "insufficient_role"


def test_professional_cannot_access_another_professionals_patient(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    create_user(email="owner@example.com", role=UserRole.PHYSIOTHERAPIST)
    create_user(email="other@example.com", role=UserRole.PHYSIOTHERAPIST)
    owner_headers = login_headers("owner@example.com")
    other_headers = login_headers("other@example.com")
    patient = client.post(
        "/api/v1/patients",
        headers=owner_headers,
        json={"full_name": "Linked Patient", "email": "linked@example.com"},
    ).json()

    assert client.get("/api/v1/patients", headers=other_headers).json()["total"] == 0
    for method, path, payload in (
        ("get", f"/api/v1/patients/{patient['id']}", None),
        ("patch", f"/api/v1/patients/{patient['id']}", {"phone": "85999999999"}),
        (
            "post",
            f"/api/v1/patients/{patient['id']}/access",
            {"operation": "activate"},
        ),
    ):
        response = client.request(method, path, headers=other_headers, json=payload)
        assert response.status_code == 404
        assert response.json()["code"] == "patient_not_found"


def test_patient_input_validation_is_consistent(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    create_user(email="professional@example.com", role=UserRole.PHYSIOTHERAPIST)
    headers = login_headers("professional@example.com")

    invalid = client.post(
        "/api/v1/patients",
        headers=headers,
        json={"full_name": " ", "unknown": "field"},
    )
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "validation_error"

    patient = client.post(
        "/api/v1/patients",
        headers=headers,
        json={"full_name": "Valid Patient"},
    ).json()
    empty_patch = client.patch(
        f"/api/v1/patients/{patient['id']}", headers=headers, json={}
    )
    assert empty_patch.status_code == 422
    assert empty_patch.json()["code"] == "validation_error"

    invalid_page = client.get("/api/v1/patients?page_size=101", headers=headers)
    assert invalid_page.status_code == 422
