from typing import Annotated

from fastapi import Query
from fastapi.testclient import TestClient

from app.core.config import Environment, Settings
from app.core.errors import ApiError
from app.main import create_app


def test_expected_error_uses_public_contract() -> None:
    app = create_app(
        Settings(
            _env_file=None,
            environment=Environment.TEST,
            database_url="sqlite+pysqlite:///:memory:",
        )
    )

    @app.get("/expected-error")
    def expected_error() -> None:
        raise ApiError(
            status_code=409,
            code="example_conflict",
            message="The example already exists.",
            details={"field": "example"},
        )

    response = TestClient(app).get("/expected-error")

    assert response.status_code == 409
    assert response.json() == {
        "code": "example_conflict",
        "message": "The example already exists.",
        "details": {"field": "example"},
    }


def test_validation_error_uses_public_contract() -> None:
    app = create_app(
        Settings(
            _env_file=None,
            environment=Environment.TEST,
            database_url="sqlite+pysqlite:///:memory:",
        )
    )

    @app.get("/validated")
    def validated(limit: Annotated[int, Query(gt=0)]) -> dict[str, int]:
        return {"limit": limit}

    response = TestClient(app).get("/validated", params={"limit": 0})

    assert response.status_code == 422
    payload = response.json()
    assert payload["code"] == "validation_error"
    assert payload["message"] == "Request validation failed."
    assert payload["details"][0]["field"] == "query.limit"
