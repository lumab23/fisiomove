from copy import deepcopy

from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.exercises.schemas import ExerciseResponse
from app.modules.exercises.services import ExerciseService
from app.modules.workouts.models import WorkoutItem
from app.modules.workouts.schemas import WorkoutItemInput


def prepare_items(session: Session, items: list[WorkoutItemInput]) -> list[WorkoutItem]:
    """Validate without writing; pin the rule independently from prescribed values.

    No clinical parameter language has been agreed. Empty parameter contracts are
    supported; nonempty contracts fail closed until a versioned validator is approved.
    """
    result = []
    for item in items:
        exercise = ExerciseService(session).get(item.exercise_id)
        if item.side not in exercise.allowed_sides:
            raise ApiError(
                status_code=422,
                code="unsupported_side",
                message="The exercise does not support this side.",
            )
        if exercise.supported_parameters:
            raise ApiError(
                status_code=409,
                code="parameter_contract_pending",
                message="This exercise requires an approved parameter validator.",
            )
        if item.parameters:
            raise ApiError(
                status_code=422,
                code="unsupported_parameters",
                message="The exercise does not accept additional parameters.",
            )
        values = item.model_dump()
        values["side"] = item.side.value
        result.append(
            WorkoutItem(
                **values,
                rule_version=exercise.rule_version,
                exercise_snapshot=deepcopy(
                    ExerciseResponse.model_validate(exercise).model_dump(mode="json")
                ),
            )
        )
    return result
