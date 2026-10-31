from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest

from app.modules.auth.security import TokenService


@pytest.mark.parametrize(
    "change",
    [
        {"auth_version": True},
        {"auth_version": "1"},
        {"auth_version": -1},
        {"jti": "not-a-uuid"},
        {"exp": float("inf")},
        {"exp": float("nan")},
        {"iat": True},
        {"type": "refresh"},
        {"role": "admin"},
        {"aud": ["fisiomove-mobile"]},
    ],
)
def test_malformed_signed_claims_are_rejected_as_401(
    change, client, auth_app, create_user
) -> None:
    user = create_user(email="claims@example.com")
    service = TokenService(auth_app.state.settings)
    key = auth_app.state.settings.auth_secret_key.get_secret_value()
    payload = jwt.decode(
        service.create_access_token(user),
        key,
        algorithms=["HS256"],
        audience="fisiomove-mobile",
        issuer="fisiomove-api",
    )
    payload.update(change)
    token = jwt.encode(payload, key, algorithm="HS256")
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_access_token"


def test_invalid_algorithm_is_not_negotiated_from_the_token(
    client, auth_app, create_user
) -> None:
    user = create_user(email="algorithm@example.com")
    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "jti": str(uuid4()),
        "iat": now,
        "exp": now + timedelta(minutes=1),
    }
    token = jwt.encode(
        payload,
        "algorithm-probe-only-" * 4,
        algorithm="HS384",
    )
    assert (
        client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        ).status_code
        == 401
    )
