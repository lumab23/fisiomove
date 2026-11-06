from datetime import timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.auth.models import User
from app.modules.patients.models import Patient, ProfessionalPatientLink
from app.modules.physiotherapists.models import PhysiotherapistProfile

OWN = "/api/v1/me/physiotherapist-profile"
LINKED = "/api/v1/me/physiotherapist"


def _set_name(application: FastAPI, user: User, full_name: str) -> None:
    with application.state.database.session() as session:
        session.add(PhysiotherapistProfile(user_id=user.id, full_name=full_name))


def _require_password_change(application: FastAPI, user: User) -> User:
    with application.state.database.session() as session:
        stored = session.get(User, user.id)
        assert stored is not None
        stored.must_change_password = True
        session.flush()
        session.expunge(stored)
        return stored


def test_physiotherapist_without_profile_reads_null_name(
    client: TestClient, data, headers
) -> None:
    response = client.get(OWN, headers=headers(data["pro"]))

    assert response.status_code == 200
    assert response.json() == {"full_name": None}


def test_physiotherapist_sets_and_updates_own_name(
    client: TestClient, application: FastAPI, data, headers
) -> None:
    created = client.put(
        OWN, headers=headers(data["pro"]), json={"full_name": "  Dra. Ficticia  "}
    )
    updated = client.put(
        OWN, headers=headers(data["pro"]), json={"full_name": "Dra. Ficticia Silva"}
    )
    read = client.get(OWN, headers=headers(data["pro"]))
    other = client.get(OWN, headers=headers(data["other"]))

    assert created.status_code == 200
    assert created.json() == {"full_name": "Dra. Ficticia"}
    assert updated.json() == {"full_name": "Dra. Ficticia Silva"}
    assert read.json() == {"full_name": "Dra. Ficticia Silva"}
    assert other.json() == {"full_name": None}
    with application.state.database.session() as session:
        assert len(session.query(PhysiotherapistProfile).all()) == 1


def test_profile_update_validates_name_and_rejects_extra_fields(
    client: TestClient, data, headers
) -> None:
    invalid_bodies = [
        {"full_name": "A"},
        {"full_name": "   A   "},
        {"full_name": "x" * 201},
        {"full_name": None},
        {},
        {"full_name": "Dra. Ficticia", "email": "pro@example.com"},
    ]
    for body in invalid_bodies:
        response = client.put(OWN, headers=headers(data["pro"]), json=body)
        assert response.status_code == 422, body
        assert response.json()["code"] == "validation_error"

    assert client.get(OWN, headers=headers(data["pro"])).json() == {"full_name": None}


def test_profile_accepts_name_boundaries(client: TestClient, data, headers) -> None:
    for name in ("Ab", "x" * 200):
        response = client.put(
            OWN, headers=headers(data["pro"]), json={"full_name": name}
        )
        assert response.status_code == 200
        assert response.json() == {"full_name": name}


def test_patient_cannot_use_physiotherapist_profile_routes(
    client: TestClient, data, headers
) -> None:
    for response in (
        client.get(OWN, headers=headers(data["patient_user"])),
        client.put(
            OWN,
            headers=headers(data["patient_user"]),
            json={"full_name": "Paciente"},
        ),
    ):
        assert response.status_code == 403
        assert response.json()["code"] == "insufficient_role"


def test_physiotherapist_cannot_use_patient_route(
    client: TestClient, data, headers
) -> None:
    response = client.get(LINKED, headers=headers(data["pro"]))

    assert response.status_code == 403
    assert response.json()["code"] == "insufficient_role"


def test_routes_require_authentication(client: TestClient) -> None:
    for response in (
        client.get(OWN),
        client.put(OWN, json={"full_name": "Dra. Ficticia"}),
        client.get(LINKED),
    ):
        assert response.status_code == 401
        assert response.json()["code"] == "authentication_required"


def test_temporary_password_blocks_profile_routes(
    client: TestClient, application: FastAPI, data, headers
) -> None:
    professional = _require_password_change(application, data["pro"])
    patient_user = _require_password_change(application, data["patient_user"])

    for response in (
        client.get(OWN, headers=headers(professional)),
        client.put(OWN, headers=headers(professional), json={"full_name": "Dra. X"}),
        client.get(LINKED, headers=headers(patient_user)),
    ):
        assert response.status_code == 403
        assert response.json()["code"] == "password_change_required"


def test_patient_sees_only_linked_physiotherapist_name(
    client: TestClient, application: FastAPI, data, headers
) -> None:
    _set_name(application, data["pro"], "Dra. Ficticia")
    _set_name(application, data["other"], "Dr. Nao Vinculado")

    response = client.get(LINKED, headers=headers(data["patient_user"]))

    assert response.status_code == 200
    assert response.json() == {"full_name": "Dra. Ficticia"}


def test_linked_physiotherapist_without_profile_returns_null_name(
    client: TestClient, data, headers
) -> None:
    response = client.get(LINKED, headers=headers(data["patient_user"]))

    assert response.status_code == 200
    assert response.json() == {"full_name": None}


def test_patient_without_active_link_gets_404(
    client: TestClient, application: FastAPI, data, headers
) -> None:
    _set_name(application, data["pro"], "Dra. Ficticia")
    with application.state.database.session() as session:
        link = session.get(ProfessionalPatientLink, data["link"].id)
        assert link is not None
        link.is_active = False

    response = client.get(LINKED, headers=headers(data["patient_user"]))

    assert response.status_code == 404
    assert response.json()["code"] == "physiotherapist_not_found"


def test_inactive_patient_record_gets_404(
    client: TestClient, application: FastAPI, data, headers
) -> None:
    with application.state.database.session() as session:
        patient = session.get(Patient, data["patient"].id)
        assert patient is not None
        patient.is_active = False

    response = client.get(LINKED, headers=headers(data["patient_user"]))

    assert response.status_code == 404
    assert response.json()["code"] == "patient_not_found"


def test_multiple_active_links_use_the_oldest(
    client: TestClient, application: FastAPI, data, headers
) -> None:
    _set_name(application, data["pro"], "Dra. Mais Recente")
    _set_name(application, data["other"], "Dr. Mais Antigo")
    with application.state.database.session() as session:
        session.add(
            ProfessionalPatientLink(
                physiotherapist_id=data["other"].id,
                patient_id=data["patient"].id,
                created_at=data["link"].created_at - timedelta(days=1),
            )
        )

    response = client.get(LINKED, headers=headers(data["patient_user"]))

    assert response.json() == {"full_name": "Dr. Mais Antigo"}
