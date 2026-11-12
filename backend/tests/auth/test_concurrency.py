import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event

import pytest
from sqlalchemy import func, select

from app.core.errors import ApiError
from app.modules.auth.models import RefreshToken
from app.modules.auth.services import AuthenticationService, PatientAccountService

pytestmark = pytest.mark.skipif(
    not os.getenv("FISIOMOVE_TEST_POSTGRES_URL"),
    reason="Requires real PostgreSQL row locks",
)


def test_concurrent_refresh_rotates_only_once(client, auth_app, create_user) -> None:
    user = create_user(email="race@example.com")
    tokens = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "SecurePassword123!"},
    ).json()
    barrier = Barrier(2)

    def refresh() -> int:
        barrier.wait(timeout=10)
        return client.post(
            "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(refresh) for _ in range(2)]
        assert sorted(future.result(timeout=20) for future in futures) == [200, 401]
    with auth_app.state.database.session() as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(RefreshToken)
                .where(RefreshToken.revoked_at.is_(None))
            )
            == 1
        )


def test_reset_serializes_with_refresh_and_leaves_no_active_old_credential(
    auth_app, client, create_user
) -> None:
    user = create_user(email="reset-race@example.com")
    tokens = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "SecurePassword123!"},
    ).json()
    reset_holds_lock, release_reset, refresh_started = Event(), Event(), Event()

    def reset() -> None:
        with auth_app.state.database.session() as session:
            PatientAccountService(session).reset_temporary_password(user.id)
            reset_holds_lock.set()
            assert release_reset.wait(timeout=10)

    def refresh() -> str:
        refresh_started.set()
        try:
            with auth_app.state.database.session() as session:
                AuthenticationService(session, auth_app.state.settings).refresh(
                    tokens["refresh_token"]
                )
        except ApiError as exc:
            return exc.error.code
        return "unexpected_success"

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(reset)
        assert reset_holds_lock.wait(timeout=10)
        second = pool.submit(refresh)
        assert refresh_started.wait(timeout=10)
        release_reset.set()
        first.result(timeout=20)
        assert second.result(timeout=20) == "refresh_token_revoked"
    assert (
        client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        ).status_code
        == 401
    )
    with auth_app.state.database.session() as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(RefreshToken)
                .where(RefreshToken.revoked_at.is_(None))
            )
            == 0
        )
