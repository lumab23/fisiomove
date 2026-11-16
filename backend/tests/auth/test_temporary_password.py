import re

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.auth.security import (
    MIN_PASSWORD_LENGTH,
    TEMPORARY_PASSWORD_ALPHABET,
    generate_temporary_password,
    validate_password,
)
from app.modules.auth.services import PatientAccountService
from tests.auth.test_password_and_roles import add_protected_routes, bearer

# Written out independently of the implementation constant on purpose.
SYMBOL = "[23456789ABCDEFGHJKMNPQRSTUVWXYZ]"
FORMAT = re.compile(rf"^{SYMBOL}{{4}}-{SYMBOL}{{4}}-{SYMBOL}{{4}}$")


def test_temporary_password_uses_readable_grouped_format() -> None:
    for _ in range(200):
        password = generate_temporary_password()

        assert FORMAT.fullmatch(password), password
        assert len(password) == 14
        groups = password.split("-")
        assert [len(group) for group in groups] == [4, 4, 4]
        assert len("".join(groups)) == 12
        assert len(password) >= MIN_PASSWORD_LENGTH
        validate_password(password)


def test_temporary_password_alphabet_excludes_ambiguous_characters() -> None:
    assert len(TEMPORARY_PASSWORD_ALPHABET) == 31
    assert len(set(TEMPORARY_PASSWORD_ALPHABET)) == 31
    for ambiguous in "0O1IL":
        assert ambiguous not in TEMPORARY_PASSWORD_ALPHABET
    assert TEMPORARY_PASSWORD_ALPHABET == TEMPORARY_PASSWORD_ALPHABET.upper()


def test_temporary_passwords_are_unique_in_a_reasonable_sample() -> None:
    sample = {generate_temporary_password() for _ in range(1000)}

    assert len(sample) == 1000


def test_generated_temporary_password_logs_in_and_requires_change(
    client: TestClient,
    auth_app: FastAPI,
) -> None:
    add_protected_routes(auth_app)
    with auth_app.state.database.session() as session:
        credential = PatientAccountService(session).create_access(
            "readable@example.com"
        )
    assert FORMAT.fullmatch(credential.temporary_password)

    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "readable@example.com",
            "password": credential.temporary_password,
        },
    )
    assert login.status_code == 200
    access = login.json()["access_token"]

    me = client.get("/api/v1/auth/me", headers=bearer(access))
    blocked = client.get("/api/v1/test/business", headers=bearer(access))

    assert me.status_code == 200
    assert me.json()["must_change_password"] is True
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "password_change_required"

    lowercase = client.post(
        "/api/v1/auth/login",
        json={
            "email": "readable@example.com",
            "password": credential.temporary_password.lower(),
        },
    )
    assert lowercase.status_code == 401
    assert lowercase.json()["code"] == "invalid_credentials"
