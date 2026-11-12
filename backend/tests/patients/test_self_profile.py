from collections.abc import Callable

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.modules.auth.models import User, UserRole
from app.modules.patients.models import Patient

PATH = "/api/v1/me/profile"
NEW_PASSWORD = "BrandNewPassword123!"
PROFESSIONAL = "professional@example.com"


def _provision(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
    *,
    full_name: str,
    email: str,
) -> str:
    """Create a patient with access and return the temporary password."""
    create_user(email=email.replace("@", "-pro@"), role=UserRole.PHYSIOTHERAPIST)
    pro_headers = login_headers(email.replace("@", "-pro@"))
    patient = client.post(
        "/api/v1/patients",
        headers=pro_headers,
        json={"full_name": full_name, "email": email},
    ).json()
    access = client.post(
        f"/api/v1/patients/{patient['id']}/access",
        headers=pro_headers,
        json={"operation": "activate"},
    )
    assert access.status_code == 200
    return str(access.json()["temporary_password"])


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _patient_headers(client: TestClient, email: str, temporary: str) -> dict[str, str]:
    headers = _login(client, email, temporary)
    changed = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": temporary, "new_password": NEW_PASSWORD},
    )
    assert changed.status_code == 204
    return _login(client, email, NEW_PASSWORD)


def test_patient_gets_only_own_full_name(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    temporary = _provision(
        client,
        create_user,
        login_headers,
        full_name="Maria Ficticia",
        email="maria@example.com",
    )
    headers = _patient_headers(client, "maria@example.com", temporary)

    response = client.get(PATH, headers=headers)

    assert response.status_code == 200
    assert response.json() == {"full_name": "Maria Ficticia"}


def test_two_patients_only_see_their_own_name(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    first = _provision(
        client,
        create_user,
        login_headers,
        full_name="Paciente Um",
        email="um@example.com",
    )
    second = _provision(
        client,
        create_user,
        login_headers,
        full_name="Paciente Dois",
        email="dois@example.com",
    )
    first_headers = _patient_headers(client, "um@example.com", first)
    second_headers = _patient_headers(client, "dois@example.com", second)

    assert client.get(PATH, headers=first_headers).json() == {
        "full_name": "Paciente Um"
    }
    assert client.get(PATH, headers=second_headers).json() == {
        "full_name": "Paciente Dois"
    }


def test_physiotherapist_cannot_read_patient_self_profile(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    create_user(email=PROFESSIONAL, role=UserRole.PHYSIOTHERAPIST)
    headers = login_headers(PROFESSIONAL)

    response = client.get(PATH, headers=headers)

    assert response.status_code == 403
    assert response.json()["code"] == "insufficient_role"


def test_requires_authentication(client: TestClient) -> None:
    assert client.get(PATH).status_code in {401, 403}


def test_pending_temporary_password_blocks_profile(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    temporary = _provision(
        client,
        create_user,
        login_headers,
        full_name="Senha Temporaria",
        email="temp@example.com",
    )
    headers = _login(client, "temp@example.com", temporary)

    response = client.get(PATH, headers=headers)

    assert response.status_code == 403
    assert response.json()["code"] == "password_change_required"


def test_patient_user_without_patient_record_gets_404(
    client: TestClient,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    create_user(email="orphan@example.com", role=UserRole.PATIENT)
    headers = login_headers("orphan@example.com")

    response = client.get(PATH, headers=headers)

    assert response.status_code == 404
    assert response.json()["code"] == "patient_not_found"


def test_inactive_patient_record_gets_404(
    client: TestClient,
    patients_app: FastAPI,
    create_user: Callable[..., User],
    login_headers: Callable[[str, str], dict[str, str]],
) -> None:
    temporary = _provision(
        client,
        create_user,
        login_headers,
        full_name="Paciente Inativo",
        email="inactive@example.com",
    )
    headers = _patient_headers(client, "inactive@example.com", temporary)
    with patients_app.state.database.session() as session:
        patient = session.scalar(
            select(Patient).where(Patient.full_name == "Paciente Inativo")
        )
        assert patient is not None
        patient.is_active = False

    response = client.get(PATH, headers=headers)

    assert response.status_code == 404
    assert response.json()["code"] == "patient_not_found"
