from collections.abc import Callable

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import Settings
from app.core.errors import ApiError
from app.modules.auth import cli
from app.modules.auth.cli import build_parser
from app.modules.auth.models import User, UserRole
from app.modules.auth.security import PasswordManager
from app.modules.auth.services import (
    AccountProvisioningService,
    PatientAccountService,
)


def test_local_service_creates_only_initial_physiotherapist(auth_app: FastAPI) -> None:
    with auth_app.state.database.session() as session:
        service = AccountProvisioningService(session)
        user = service.create_initial_physiotherapist(
            "PHYSIO@EXAMPLE.COM",
            "TemporaryPassword123!",
        )
        assert user.role is UserRole.PHYSIOTHERAPIST
        assert user.email == "physio@example.com"
        assert user.must_change_password is True
        assert user.password_hash.startswith("$argon2")

    with auth_app.state.database.session() as session:
        service = AccountProvisioningService(session)
        try:
            service.create_initial_physiotherapist(
                "other@example.com",
                "TemporaryPassword456!",
            )
        except ApiError as exc:
            assert exc.error.code == "initial_physiotherapist_exists"
        else:
            raise AssertionError("A second initial physiotherapist was accepted")


def test_admin_command_has_no_password_argument() -> None:
    args = build_parser().parse_args(
        ["create-physiotherapist", "--email", "physio@example.com"]
    )

    assert args.email == "physio@example.com"
    assert not hasattr(args, "password")


def test_patient_access_has_no_public_account_creation_endpoint(
    client: TestClient,
    auth_app: FastAPI,
) -> None:
    with auth_app.state.database.session() as session:
        credential = PatientAccountService(session).create_access("PATIENT@EXAMPLE.COM")
        user_id = credential.user_id
        first_password = credential.temporary_password
        stored = session.get(User, user_id)
        assert stored is not None
        assert stored.role is UserRole.PATIENT
        assert stored.must_change_password is True
        assert PasswordManager().verify(first_password, stored.password_hash)
        assert first_password not in stored.password_hash

    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/v1/patients/{patient_id}/access" in paths
    assert "/api/v1/auth/register" not in paths
    protected_access = client.post(
        f"/api/v1/patients/{user_id}/access",
        json={"operation": "activate"},
    )
    assert protected_access.status_code == 401

    first_login = client.post(
        "/api/v1/auth/login",
        json={"email": "patient@example.com", "password": first_password},
    )
    assert first_login.status_code == 200

    with auth_app.state.database.session() as session:
        credential = PatientAccountService(session).reset_temporary_password(user_id)
        second_password = credential.temporary_password

    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "patient@example.com", "password": first_password},
    )
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "patient@example.com", "password": second_password},
    )

    assert old_login.status_code == 401
    assert new_login.status_code == 200

    with auth_app.state.database.session() as session:
        users = session.scalars(select(User)).all()
        assert len(users) == 1


def test_internal_service_activates_patient_with_new_temporary_credential(
    auth_app: FastAPI,
) -> None:
    with auth_app.state.database.session() as session:
        created = PatientAccountService(session).create_access("patient@example.com")
        user = session.get(User, created.user_id)
        assert user is not None
        user.is_active = False

    with auth_app.state.database.session() as session:
        activated = PatientAccountService(session).activate_access(created.user_id)
        user = session.get(User, created.user_id)
        assert user is not None
        assert user.is_active is True
        assert user.must_change_password is True
        assert activated.temporary_password != created.temporary_password
        assert PasswordManager().verify(
            activated.temporary_password,
            user.password_hash,
        )


ADDITIONAL_PASSWORD = "AdditionalTemporary123!"
CHANGED_PASSWORD = "ChangedProfessional123!"


def _run_cli(
    monkeypatch: pytest.MonkeyPatch,
    settings: Settings,
    argv: list[str],
    answers: list[str],
) -> int:
    prompts = iter(answers)
    monkeypatch.setattr(cli.getpass, "getpass", lambda _prompt: next(prompts))
    monkeypatch.setattr(cli, "get_settings", lambda: settings)
    return cli.main(argv)


def _professional_headers(client: TestClient, email: str) -> dict[str, str]:
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": ADDITIONAL_PASSWORD},
    )
    assert login.status_code == 200
    temporary = {"Authorization": f"Bearer {login.json()['access_token']}"}
    changed = client.post(
        "/api/v1/auth/change-password",
        headers=temporary,
        json={
            "current_password": ADDITIONAL_PASSWORD,
            "new_password": CHANGED_PASSWORD,
        },
    )
    assert changed.status_code == 204
    relogin = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": CHANGED_PASSWORD},
    )
    assert relogin.status_code == 200
    return {"Authorization": f"Bearer {relogin.json()['access_token']}"}


def test_add_physiotherapist_command_has_no_password_argument() -> None:
    args = build_parser().parse_args(
        ["add-physiotherapist", "--email", "second@example.com"]
    )

    assert args.command == "add-physiotherapist"
    assert args.email == "second@example.com"
    assert not hasattr(args, "password")


def test_add_physiotherapist_cli_creates_account_after_initial_one(
    monkeypatch: pytest.MonkeyPatch,
    settings: Settings,
    auth_app: FastAPI,
    capsys: pytest.CaptureFixture[str],
) -> None:
    first = _run_cli(
        monkeypatch,
        settings,
        ["create-physiotherapist", "--email", "first@example.com"],
        [ADDITIONAL_PASSWORD, ADDITIONAL_PASSWORD],
    )
    second = _run_cli(
        monkeypatch,
        settings,
        ["add-physiotherapist", "--email", "SECOND@example.com"],
        [ADDITIONAL_PASSWORD, ADDITIONAL_PASSWORD],
    )

    assert (first, second) == (0, 0)
    assert ADDITIONAL_PASSWORD not in capsys.readouterr().out
    with auth_app.state.database.session() as session:
        stored = session.scalar(select(User).where(User.email == "second@example.com"))
        assert stored is not None
        assert stored.role is UserRole.PHYSIOTHERAPIST
        assert stored.must_change_password is True
        assert stored.is_active is True
        assert PasswordManager().verify(ADDITIONAL_PASSWORD, stored.password_hash)


def test_add_physiotherapist_cli_rejects_mismatched_confirmation(
    monkeypatch: pytest.MonkeyPatch,
    settings: Settings,
    auth_app: FastAPI,
) -> None:
    result = _run_cli(
        monkeypatch,
        settings,
        ["add-physiotherapist", "--email", "second@example.com"],
        [ADDITIONAL_PASSWORD, "DifferentPassword123!"],
    )

    assert result == 2
    with auth_app.state.database.session() as session:
        assert session.scalars(select(User)).all() == []


def test_add_physiotherapist_cli_rejects_email_already_used(
    monkeypatch: pytest.MonkeyPatch,
    settings: Settings,
    auth_app: FastAPI,
    create_user: Callable[..., User],
    capsys: pytest.CaptureFixture[str],
) -> None:
    create_user(email="taken@example.com", role=UserRole.PATIENT)

    result = _run_cli(
        monkeypatch,
        settings,
        ["add-physiotherapist", "--email", "Taken@Example.com"],
        [ADDITIONAL_PASSWORD, ADDITIONAL_PASSWORD],
    )

    assert result == 1
    assert "An account already uses this email." in capsys.readouterr().err
    with auth_app.state.database.session() as session:
        users = session.scalars(select(User)).all()
        assert [user.role for user in users] == [UserRole.PATIENT]


def test_add_physiotherapist_service_rejects_short_temporary_password(
    auth_app: FastAPI,
) -> None:
    with auth_app.state.database.session() as session:
        with pytest.raises(ValueError, match="between 12 and 128"):
            AccountProvisioningService(session).add_physiotherapist(
                "short@example.com", "short"
            )
        assert session.scalars(select(User)).all() == []


def test_add_physiotherapist_requires_password_change_before_business_routes(
    client: TestClient,
    auth_app: FastAPI,
) -> None:
    with auth_app.state.database.session() as session:
        AccountProvisioningService(session).add_physiotherapist(
            "second@example.com", ADDITIONAL_PASSWORD
        )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "second@example.com", "password": ADDITIONAL_PASSWORD},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = client.get("/api/v1/patients", headers=headers)

    assert response.status_code == 403
    assert response.json()["code"] == "password_change_required"


def test_two_physiotherapists_only_see_their_own_patients(
    client: TestClient,
    auth_app: FastAPI,
) -> None:
    with auth_app.state.database.session() as session:
        service = AccountProvisioningService(session)
        service.create_initial_physiotherapist("first@example.com", ADDITIONAL_PASSWORD)
        service.add_physiotherapist("second@example.com", ADDITIONAL_PASSWORD)
    first = _professional_headers(client, "first@example.com")
    second = _professional_headers(client, "second@example.com")
    first_patient = client.post(
        "/api/v1/patients", headers=first, json={"full_name": "Paciente Um"}
    ).json()
    second_patient = client.post(
        "/api/v1/patients", headers=second, json={"full_name": "Paciente Dois"}
    ).json()

    first_list = client.get("/api/v1/patients", headers=first).json()
    second_list = client.get("/api/v1/patients", headers=second).json()
    foreign_read = client.get(f"/api/v1/patients/{second_patient['id']}", headers=first)
    foreign_update = client.patch(
        f"/api/v1/patients/{first_patient['id']}",
        headers=second,
        json={"full_name": "Alterado"},
    )
    foreign_access = client.post(
        f"/api/v1/patients/{first_patient['id']}/access",
        headers=second,
        json={"operation": "activate"},
    )

    assert [item["id"] for item in first_list["items"]] == [first_patient["id"]]
    assert [item["id"] for item in second_list["items"]] == [second_patient["id"]]
    for response in (foreign_read, foreign_update, foreign_access):
        assert response.status_code == 404
        assert response.json()["code"] == "patient_not_found"
