"""`GET /me/notes`: the patient reads only their own `patient_visible` notes."""

from uuid import uuid4

from app.modules.auth.models import User, UserRole
from app.modules.auth.security import PasswordManager
from app.modules.notes.models import Note
from app.modules.patients.models import Patient, ProfessionalPatientLink

URL = "/api/v1/me/notes"


def add_note(application, data, patient_id, content, visibility):
    with application.state.database.session() as session:
        session.add(
            Note(
                patient_id=patient_id,
                author_id=data["pro"].id,
                content=content,
                visibility=visibility,
            )
        )


def other_patient(application, data):
    with application.state.database.session() as session:
        user = User(
            email=f"{uuid4()}@example.com",
            role=UserRole.PATIENT,
            password_hash=PasswordManager().hash("TestPassword123!"),
        )
        session.add(user)
        session.flush()
        patient = Patient(full_name="Other test patient", user_id=user.id)
        session.add(patient)
        session.flush()
        session.add(
            ProfessionalPatientLink(
                physiotherapist_id=data["pro"].id, patient_id=patient.id
            )
        )
        return user, patient


def test_own_notes_are_empty_by_default(client, data, headers):
    response = client.get(URL, headers=headers(data["patient_user"]))
    assert response.status_code == 200
    assert response.json() == dict(items=[], total=0, pages=0, page=1, page_size=20)


def test_only_own_patient_visible_notes_without_internal_fields(
    application, client, data, headers
):
    other_user, other = other_patient(application, data)
    add_note(
        application, data, data["patient"].id, "Visible test note", "patient_visible"
    )
    add_note(
        application, data, data["patient"].id, "Private test note", "professional_only"
    )
    add_note(application, data, other.id, "Other visible test note", "patient_visible")
    add_note(
        application, data, other.id, "Other private test note", "professional_only"
    )

    body = client.get(URL, headers=headers(data["patient_user"])).json()
    assert body["total"] == 1
    assert body["pages"] == 1
    assert [x["content"] for x in body["items"]] == ["Visible test note"]
    assert set(body["items"][0]) == {
        "id",
        "content",
        "emoji",
        "created_at",
        "updated_at",
    }

    other_body = client.get(URL, headers=headers(other_user)).json()
    assert other_body["total"] == 1
    assert [x["content"] for x in other_body["items"]] == ["Other visible test note"]


def test_pagination_counts_only_visible_notes(application, client, data, headers):
    for index in range(3):
        add_note(
            application, data, data["patient"].id, f"Visible {index}", "patient_visible"
        )
        add_note(
            application,
            data,
            data["patient"].id,
            f"Private {index}",
            "professional_only",
        )
    auth = headers(data["patient_user"])
    first = client.get(URL + "?page_size=2", headers=auth).json()
    assert (first["total"], first["pages"], len(first["items"])) == (3, 2, 2)
    second = client.get(URL + "?page=2&page_size=2", headers=auth).json()
    assert len(second["items"]) == 1
    seen = [x["content"] for x in first["items"] + second["items"]]
    assert sorted(seen) == ["Visible 0", "Visible 1", "Visible 2"]
    assert client.get(URL + "?page=3&page_size=2", headers=auth).json()["items"] == []
    assert client.get(URL + "?page=0", headers=auth).status_code == 422
    assert client.get(URL + "?page_size=101", headers=auth).status_code == 422


def test_note_hidden_after_visibility_change(client, data, headers):
    created = client.post(
        f"/api/v1/patients/{data['patient'].id}/notes",
        headers=headers(data["pro"]),
        json={"content": "Test note", "visibility": "patient_visible"},
    )
    assert created.status_code == 201
    auth = headers(data["patient_user"])
    assert client.get(URL, headers=auth).json()["total"] == 1
    client.patch(
        f"/api/v1/notes/{created.json()['id']}",
        headers=headers(data["pro"]),
        json={"visibility": "professional_only"},
    )
    assert client.get(URL, headers=auth).json() == dict(
        items=[], total=0, pages=0, page=1, page_size=20
    )


def test_physiotherapist_cannot_use_own_notes(client, data, headers):
    response = client.get(URL, headers=headers(data["pro"]))
    assert response.status_code == 403
    assert response.json()["code"] == "insufficient_role"


def test_authentication_and_temporary_password(application, client, data, headers):
    response = client.get(URL)
    assert response.status_code == 401
    assert response.json()["code"] == "authentication_required"
    auth = headers(data["patient_user"])
    with application.state.database.session() as session:
        session.get(User, data["patient_user"].id).must_change_password = True
    response = client.get(URL, headers=auth)
    assert response.status_code == 403
    assert response.json()["code"] == "password_change_required"


def test_patient_account_without_active_record(application, client, data, headers):
    add_note(
        application, data, data["patient"].id, "Visible test note", "patient_visible"
    )
    with application.state.database.session() as session:
        session.get(Patient, data["patient"].id).is_active = False
    response = client.get(URL, headers=headers(data["patient_user"]))
    assert response.status_code == 404
    assert response.json()["code"] == "patient_not_found"
