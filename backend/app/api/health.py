from fastapi import APIRouter

router = APIRouter(tags=["technical"])


@router.get("/health")
def health() -> dict[str, str]:
    """Return the API process health without exposing configuration details."""
    return {"status": "ok"}
