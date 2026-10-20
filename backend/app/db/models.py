"""Central import registry for SQLAlchemy models used by Alembic."""

from app.modules.auth.models import RefreshToken, User
from app.modules.exercises.models import Exercise
from app.modules.notes.models import Note
from app.modules.patients.models import Patient, ProfessionalPatientLink
from app.modules.workouts.models import Workout, WorkoutItem, WorkoutRevision

__all__ = [
    "Exercise",
    "Note",
    "Patient",
    "ProfessionalPatientLink",
    "RefreshToken",
    "User",
    "Workout",
    "WorkoutItem",
    "WorkoutRevision",
]
