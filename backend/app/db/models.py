"""Central import registry for SQLAlchemy models used by Alembic."""

from app.modules.auth.models import RefreshToken, User
from app.modules.exercises.models import (
    Exercise,
    ExerciseApprovalEvent,
    ExerciseImage,
)
from app.modules.notes.models import Note
from app.modules.patients.models import Patient, ProfessionalPatientLink
from app.modules.physiotherapists.models import PhysiotherapistProfile
from app.modules.sessions.models import SessionResult
from app.modules.workouts.models import Workout, WorkoutItem, WorkoutRevision

__all__ = [
    "Exercise",
    "ExerciseApprovalEvent",
    "ExerciseImage",
    "Note",
    "Patient",
    "PhysiotherapistProfile",
    "ProfessionalPatientLink",
    "RefreshToken",
    "SessionResult",
    "User",
    "Workout",
    "WorkoutItem",
    "WorkoutRevision",
]
