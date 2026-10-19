from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.modules.auth.models import User
from app.modules.notes.models import Note
from app.modules.patients.models import Patient, ProfessionalPatientLink


def path(data):
    return f"/api/v1/patients/{data['patient'].id}/notes"


def create(client, data, headers, visibility="professional_only"):
    response = client.post(
        path(data),
        headers=headers(data["pro"]),
        json={"content": " Test observation ", "visibility": visibility},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_empty_notes(client, data, headers):
    for actor in ["pro", "patient_user"]:
        response = client.get(path(data), headers=headers(data[actor]))
        assert response.json() == dict(items=[], total=0, pages=0, page=1, page_size=20)


def test_private_notes_never_leak_in_items_or_counts(client, data, headers):
    private = create(client, data, headers)
    public = create(client, data, headers, "patient_visible")
    assert private["author_id"] == str(data["pro"].id)
    assert private["content"] == "Test observation"
    auth = headers(data["patient_user"])
    response = client.get(path(data) + "?page_size=1", headers=auth).json()
    assert response["total"] == 1
    assert response["pages"] == 1
    assert [x["id"] for x in response["items"]] == [public["id"]]
    assert (
        client.get(path(data) + "?page=2&page_size=1", headers=auth).json()["items"]
        == []
    )
    assert client.get(path(data), headers=headers(data["pro"])).json()["total"] == 2
    assert client.get(path(data), headers=headers(data["other"])).status_code == 404
    patch = client.patch(
        f"/api/v1/notes/{public['id']}",
        headers=headers(data["pro"]),
        json={"visibility": "professional_only"},
    )
    assert patch.status_code == 200
    assert client.get(path(data), headers=auth).json()["items"] == []
    assert client.get(path(data), headers=auth).json()["total"] == 0


def test_only_linked_author_edits(application, client, data, headers):
    note = create(client, data, headers)
    url = f"/api/v1/notes/{note['id']}"
    auth = headers(data["pro"])
    response = client.patch(url, headers=auth, json={"content": "Edited"})
    assert response.status_code == 200
    changed = response.json()
    assert changed["created_at"] == note["created_at"]
    assert changed["updated_at"] >= note["updated_at"]
    assert changed["author_id"] == note["author_id"]
    with application.state.database.session() as session:
        session.add(
            ProfessionalPatientLink(
                physiotherapist_id=data["other"].id, patient_id=data["patient"].id
            )
        )
    assert client.get(path(data), headers=headers(data["other"])).status_code == 200
    assert (
        client.patch(
            url, headers=headers(data["other"]), json={"content": "Denied"}
        ).status_code
        == 403
    )
    with application.state.database.session() as session:
        session.get(ProfessionalPatientLink, data["link"].id).is_active = False
    assert (
        client.patch(url, headers=auth, json={"content": "Denied"}).status_code == 404
    )
    with application.state.database.session() as session:
        saved = session.scalar(select(Note))
        assert saved.content == "Edited"
        assert saved.author_id == data["pro"].id


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"content": ""},
        {"content": "   "},
        {"content": None},
        {"visibility": None},
        {"visibility": "public"},
        {"author_id": str(uuid4())},
        {"patient_id": str(uuid4())},
    ],
)
def test_invalid_note_patches(client, data, headers, body):
    note = create(client, data, headers)
    assert (
        client.patch(
            f"/api/v1/notes/{note['id']}", headers=headers(data["pro"]), json=body
        ).status_code
        == 422
    )


@pytest.mark.parametrize(
    "body",
    [
        {"content": "x"},
        {"content": " ", "visibility": "patient_visible"},
        {"content": "x", "visibility": "wrong"},
        {"content": "x", "visibility": "patient_visible", "author_id": str(uuid4())},
    ],
)
def test_invalid_note_creates(client, data, headers, body):
    assert (
        client.post(path(data), headers=headers(data["pro"]), json=body).status_code
        == 422
    )


def test_patient_mutations_and_other_patient_reads(application, client, data, headers):
    note = create(client, data, headers, "patient_visible")
    auth = headers(data["patient_user"])
    assert (
        client.post(
            path(data),
            headers=auth,
            json={"content": "Denied", "visibility": "patient_visible"},
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/notes/{note['id']}", headers=auth, json={"content": "Denied"}
        ).status_code
        == 403
    )
    with application.state.database.session() as session:
        session.get(Patient, data["patient"].id).user_id = None
    assert client.get(path(data), headers=auth).status_code == 404


def test_auth_pagination_and_missing_notes(application, client, data, headers):
    assert client.get(path(data)).status_code == 401
    assert (
        client.post(
            path(data), json={"content": "x", "visibility": "patient_visible"}
        ).status_code
        == 401
    )
    auth = headers(data["pro"])
    assert client.get(path(data) + "?page=0", headers=auth).status_code == 422
    assert client.get(path(data) + "?page_size=101", headers=auth).status_code == 422
    assert (
        client.patch(
            f"/api/v1/notes/{uuid4()}", headers=auth, json={"content": "x"}
        ).status_code
        == 404
    )
    with application.state.database.session() as session:
        session.get(User, data["pro"].id).must_change_password = True
    assert (
        client.get(path(data), headers=auth).json()["code"]
        == "password_change_required"
    )


def test_note_database_constraints(application, data):
    for content, visibility in [(" ", "patient_visible"), ("Valid", "invalid")]:
        with application.state.database.session() as session:
            session.add(
                Note(
                    patient_id=data["patient"].id,
                    author_id=data["pro"].id,
                    content=content,
                    visibility=visibility,
                )
            )
            with pytest.raises(IntegrityError):
                session.flush()
            session.rollback()
