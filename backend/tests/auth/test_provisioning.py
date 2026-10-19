from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.errors import ApiError
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
