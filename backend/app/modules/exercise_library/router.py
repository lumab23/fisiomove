from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request, Response
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import get_db_session
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import User, UserRole
from app.modules.exercise_library.importing import (
    CatalogImportRequest,
    CatalogImportService,
)
from app.modules.exercise_library.providers import (
    EXTERNAL_ID_PATTERN,
    ExerciseLibraryProvider,
    OpenExerciseBaseProvider,
)
from app.modules.exercise_library.schemas import (
    LibraryExerciseDetailResponse,
    LibraryExercisePage,
)
from app.modules.exercise_library.services import (
    ExerciseLibraryService,
    raise_unavailable,
)
from app.modules.exercises.schemas import ExerciseResponse

# One dependency object, so FastAPI resolves the user once per request.
_require_physiotherapist = require_role(UserRole.PHYSIOTHERAPIST)

# Role is checked at router level so it always runs before the provider.
router = APIRouter(
    prefix="/exercise-library",
    tags=["exercise-library"],
    dependencies=[Depends(_require_physiotherapist)],
)
Professional = Annotated[User, Depends(_require_physiotherapist)]
DatabaseSession = Annotated[Session, Depends(get_db_session, scope="function")]
ExternalId = Annotated[str, Path(pattern=EXTERNAL_ID_PATTERN)]


def get_exercise_library_provider(request: Request) -> ExerciseLibraryProvider:
    """Build the live provider once per app; tests override this dependency."""
    settings: Settings = request.app.state.settings
    if not settings.exercise_library_enabled:
        raise_unavailable("The external exercise library is disabled.")
    provider: ExerciseLibraryProvider | None = getattr(
        request.app.state, "exercise_library_provider", None
    )
    if provider is None:
        provider = OpenExerciseBaseProvider.from_settings(settings)
        request.app.state.exercise_library_provider = provider
    return provider


Provider = Annotated[ExerciseLibraryProvider, Depends(get_exercise_library_provider)]


@router.get("", response_model=LibraryExercisePage)
def search_library(
    provider: Provider,
    query: Annotated[str | None, Query(max_length=100)] = None,
    body_part: Annotated[str | None, Query(max_length=50)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> LibraryExercisePage:
    return ExerciseLibraryService(provider).search(
        query=query, body_part=body_part, page=page, page_size=page_size
    )


@router.get("/{external_id}", response_model=LibraryExerciseDetailResponse)
def get_library_exercise(
    provider: Provider,
    external_id: ExternalId,
    user: Professional,
    session: DatabaseSession,
) -> LibraryExerciseDetailResponse:
    detail = ExerciseLibraryService(provider).get(external_id)
    detail.catalog_exercise = CatalogImportService(session).status(user, external_id)
    return detail


@router.post(
    "/{external_id}/catalog",
    response_model=ExerciseResponse,
    status_code=201,
    responses={200: {"model": ExerciseResponse}},
)
def add_to_catalog(
    provider: Provider,
    external_id: ExternalId,
    payload: CatalogImportRequest,
    user: Professional,
    session: DatabaseSession,
    response: Response,
) -> ExerciseResponse:
    """Add a reference exercise to the catalog (DEC-006); 200 if already there."""
    exercise, created = CatalogImportService(session).add(
        user, provider, external_id, payload
    )
    if not created:
        response.status_code = 200
    return exercise
