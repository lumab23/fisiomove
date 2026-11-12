from collections.abc import Callable, Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Environment, Settings
from app.main import create_app
from app.modules.auth.models import User, UserRole
from app.modules.auth.security import PasswordManager

TEST_SECRET = "tests-only-secret-key-with-at-least-32-characters"
DEFAULT_PASSWORD = "SecurePassword123!"


@pytest.fixture
def settings(migrated_database_url: str) -> Settings:
    return Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url=migrated_database_url,
        auth_secret_key=TEST_SECRET,
        auth_access_token_minutes=15,
        auth_refresh_token_days=30,
    )


@pytest.fixture
def patients_app(settings: Settings) -> Generator[FastAPI, None, None]:
    application = create_app(settings)
    try:
        yield application
    finally:
        application.state.database.dispose()


@pytest.fixture
def client(patients_app: FastAPI) -> Generator[TestClient, None, None]:
    with TestClient(patients_app) as test_client:
        yield test_client


@pytest.fixture
def create_user(patients_app: FastAPI) -> Callable[..., User]:
    passwords = PasswordManager()

    def factory(
        *,
        email: str,
        role: UserRole,
        password: str = DEFAULT_PASSWORD,
        is_active: bool = True,
        must_change_password: bool = False,
    ) -> User:
        with patients_app.state.database.session() as session:
            user = User(
                email=email.lower(),
                password_hash=passwords.hash(password),
                role=role,
                is_active=is_active,
                must_change_password=must_change_password,
            )
            session.add(user)
            session.flush()
            return user

    return factory


@pytest.fixture
def login_headers(client: TestClient) -> Callable[[str, str], dict[str, str]]:
    def login(email: str, password: str = DEFAULT_PASSWORD) -> dict[str, str]:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return login
