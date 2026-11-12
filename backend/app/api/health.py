from fastapi import APIRouter, Request
from sqlalchemy.exc import SQLAlchemyError

from app.core.errors import ApiError
from app.db.migrations import SchemaNotReadyError, ensure_schema_ready

router = APIRouter(tags=["technical"])


@router.get("/health")
def health() -> dict[str, str]:
    """Return the API process health without exposing configuration details."""
    return {"status": "ok"}


@router.get("/ready")
def readiness(request: Request) -> dict[str, str]:
    """Readiness requires a reachable database at the expected Alembic revision."""
    try:
        ensure_schema_ready(request.app.state.database.engine)
    except (SQLAlchemyError, SchemaNotReadyError) as exc:
        raise ApiError(
            status_code=503,
            code="database_not_ready",
            message="Database is unavailable or migrations are pending.",
            headers={"Retry-After": "1"},
        ) from exc
    return {"status": "ready"}
