"""Central import registry for SQLAlchemy models used by Alembic."""

from app.modules.auth.models import RefreshToken, User
from app.modules.patients.models import Patient, ProfessionalPatientLink

__all__ = ["Patient", "ProfessionalPatientLink", "RefreshToken", "User"]
