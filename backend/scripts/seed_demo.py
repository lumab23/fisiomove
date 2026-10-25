"""Create fictitious Maria/Ana accounts and one labeled example session for Maria.

Required environment variables:
DEMO_PRO_EMAIL, DEMO_PRO_PASSWORD, DEMO_MARIA_EMAIL, DEMO_MARIA_PASSWORD,
DEMO_ANA_EMAIL, DEMO_ANA_PASSWORD. Run after ``alembic upgrade head``.
"""

import os
from datetime import UTC, datetime, timedelta
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Environment, Settings, get_settings
from app.core.errors import ApiError
from app.db.session import Database
from app.modules.auth.models import User, UserRole
from app.modules.auth.repositories import SqlAlchemyUserRepository
from app.modules.auth.services import (
    AccountProvisioningService,
    AuthenticationService,
)
from app.modules.exercises.models import Exercise
from app.modules.patients.models import Patient, ProfessionalPatientLink
from app.modules.patients.schemas import (
    PatientAccessOperation,
    PatientCreate,
)
from app.modules.patients.services import PatientService
from app.modules.sessions.models import SessionResult
from app.modules.sessions.schemas import SessionResultCreate
from app.modules.sessions.services import SessionService
from app.modules.workouts.models import Workout, WorkoutItem, WorkoutRevision
from app.modules.workouts.schemas import WorkoutCreate, WorkoutItemInput
from app.modules.workouts.services import WorkoutService

DEMO_MARKER = "DEMO FICTÍCIO: resultado de demonstração, sem valor clínico."


def required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Required environment variable {name} is not set")
    return value


def configured_accounts() -> dict[str, tuple[str, str]]:
    return {
        "professional": (required("DEMO_PRO_EMAIL"), required("DEMO_PRO_PASSWORD")),
        "Maria [DEMO]": (required("DEMO_MARIA_EMAIL"), required("DEMO_MARIA_PASSWORD")),
        "Ana [DEMO]": (required("DEMO_ANA_EMAIL"), required("DEMO_ANA_PASSWORD")),
    }


def get_or_create_professional(session: Session, email: str, password: str) -> User:
    users = SqlAlchemyUserRepository(session)
    user = users.get_by_email(email.strip().lower())
    if user is not None:
        if user.role is not UserRole.PHYSIOTHERAPIST:
            raise ValueError("DEMO_PRO_EMAIL belongs to a non-professional account")
        return user
    return AccountProvisioningService(session).create_initial_physiotherapist(
        email, password
    )


def get_or_create_patient(
    session: Session,
    professional: User,
    name: str,
    email: str,
    password: str,
    settings: Settings,
) -> tuple[Patient, User]:
    normalized_email = email.strip().lower()
    account = SqlAlchemyUserRepository(session).get_by_email(normalized_email)
    patient = session.scalar(select(Patient).where(Patient.email == normalized_email))
    if patient is None:
        if account is not None:
            raise ValueError(f"{name} email already belongs to an unrelated account")
        response = PatientService(session).create(
            professional.id,
            PatientCreate(full_name=name, email=normalized_email),
        )
        patient = session.get(Patient, response.id)
    if patient is None or not patient.is_active:
        raise ValueError(f"{name} demo profile is unavailable or inactive")
    link = session.scalar(
        select(ProfessionalPatientLink).where(
            ProfessionalPatientLink.patient_id == patient.id,
            ProfessionalPatientLink.physiotherapist_id == professional.id,
            ProfessionalPatientLink.is_active.is_(True),
        )
    )
    if link is None:
        raise ValueError(f"{name} is not linked to the configured demo professional")

    if patient.user_id is None:
        credential = PatientService(session).manage_access(
            professional.id,
            patient.id,
            PatientAccessOperation.ACTIVATE,
        )
        account = session.get(User, credential.user_id)
        if account is None:
            raise ValueError(f"{name} account could not be created")
        AuthenticationService(session, settings).change_password(
            account, credential.temporary_password, password
        )
        patient.user_id = account.id
    else:
        account = session.get(User, patient.user_id)
    if account is None or account.role is not UserRole.PATIENT:
        raise ValueError(f"{name} demo account is unavailable")
    return patient, account


def seed_maria_example_session(
    session: Session, professional: User, patient: Patient, user: User
) -> None:
    client_session_id = uuid5(NAMESPACE_URL, "fisiomove:demo:maria:session:v1")
    existing = session.scalar(
        select(SessionResult).where(
            SessionResult.patient_id == patient.id,
            SessionResult.client_session_id == client_session_id,
        )
    )
    if existing is not None:
        return

    workout_marker = f"{DEMO_MARKER} maria-workout-v1"
    workout = session.scalar(
        select(Workout)
        .join(WorkoutRevision, WorkoutRevision.workout_id == Workout.id)
        .where(
            Workout.patient_id == patient.id,
            Workout.created_by == professional.id,
            WorkoutRevision.instructions == workout_marker,
        )
        .order_by(Workout.created_at)
    )
    if workout is None:
        exercise = next(
            (
                candidate
                for candidate in session.scalars(
                    select(Exercise)
                    .where(
                        Exercise.is_active.is_(True),
                        Exercise.approval_status == "approved",
                        Exercise.approved_rule_version == Exercise.rule_version,
                    )
                    .order_by(Exercise.code)
                )
                if not candidate.supported_parameters
            ),
            None,
        )
        if exercise is None:
            raise ValueError(
                "An active catalog exercise with an empty parameter contract is "
                "required to create the labeled demo result"
            )
        workout_response = WorkoutService(session).create(
            professional,
            patient.id,
            WorkoutCreate(
                instructions=workout_marker,
                items=[
                    WorkoutItemInput(
                        position=1,
                        exercise_id=exercise.id,
                        side=exercise.allowed_sides[0],
                        sets=1,
                        repetitions=1,
                        rest_duration_ms=0,
                        parameters={},
                    )
                ],
            ),
        )
        workout = session.get(Workout, workout_response.id)
    if workout.status == "draft":
        WorkoutService(session).publish(professional, workout.id)
    revision = session.get(WorkoutRevision, workout.current_revision_id)
    if revision is None:
        raise ValueError("The Maria demo workout is missing its published revision")
    item = session.scalar(
        select(WorkoutItem).where(WorkoutItem.revision_id == revision.id)
    )
    if item is None:
        raise ValueError("The Maria demo workout is missing its published revision")
    published_at = revision.published_at
    if published_at is None:
        raise ValueError("The Maria demo workout revision is not published")
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=UTC)
    now = max(datetime.now(UTC), published_at).replace(microsecond=0)
    SessionService(session).create(
        user,
        SessionResultCreate(
            client_session_id=client_session_id,
            workout_id=workout.id,
            workout_revision_id=revision.id,
            status="completed",
            started_at=published_at,
            finished_at=max(now, published_at + timedelta(minutes=2)),
            active_duration_ms=120_000,
            feedback_summary={"demo": True, "label": DEMO_MARKER},
            items=[
                {
                    "workout_item_id": item.id,
                    "position": item.position,
                    "completed_sets": item.sets,
                    "completed_repetitions": item.sets * item.repetitions,
                    "active_duration_ms": 120_000,
                    "interrupted": False,
                }
            ],
        ),
    )


def main() -> int:
    if os.getenv("APP_ENV", "development").lower() == Environment.PRODUCTION.value:
        raise ValueError("The fictitious demo seed cannot run in production")
    accounts = configured_accounts()
    settings = get_settings()
    database = Database(settings.database_url, echo=settings.db_echo)
    try:
        with database.session() as session:
            professional = get_or_create_professional(
                session, *accounts["professional"]
            )
            patients = {
                name: get_or_create_patient(
                    session, professional, name, email, password, settings
                )
                for name, (email, password) in accounts.items()
                if name != "professional"
            }
            maria, maria_user = patients["Maria [DEMO]"]
            ana, _ana_user = patients["Ana [DEMO]"]
            ana_sessions = session.scalar(
                select(SessionResult.id)
                .where(SessionResult.patient_id == ana.id)
                .limit(1)
            )
            if ana_sessions is not None:
                raise ValueError(
                    "Ana [DEMO] must start without sessions; use a fresh demo profile"
                )
            seed_maria_example_session(session, professional, maria, maria_user)
            # Ana is intentionally created without session results.
        print("Demo data ensured: Maria has a labeled sample result; Ana has none.")
        return 0
    finally:
        database.dispose()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ApiError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
