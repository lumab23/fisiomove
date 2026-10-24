import importlib.util
from pathlib import Path

from sqlalchemy import func, select

from app.modules.achievements.models import Achievement
from app.modules.sessions.models import SessionResult
from app.modules.workouts.models import Workout

SEED_PATH = Path(__file__).resolve().parents[2] / "scripts" / "seed_demo.py"
SEED_SPEC = importlib.util.spec_from_file_location("seed_demo", SEED_PATH)
assert SEED_SPEC is not None and SEED_SPEC.loader is not None
SEED_MODULE = importlib.util.module_from_spec(SEED_SPEC)
SEED_SPEC.loader.exec_module(SEED_MODULE)
seed_maria_example_session = SEED_MODULE.seed_maria_example_session


def test_maria_demo_seed_is_idempotent_and_awards_sample_goal(application, data):
    with application.state.database.session() as session:
        seed_maria_example_session(
            session,
            data["pro"],
            data["patient"],
            data["patient_user"],
        )
        seed_maria_example_session(
            session,
            data["pro"],
            data["patient"],
            data["patient_user"],
        )
        assert session.scalar(select(func.count()).select_from(Workout)) == 1
        assert session.scalar(select(func.count()).select_from(SessionResult)) == 1
        assert session.scalar(select(func.count()).select_from(Achievement)) == 1
        result = session.scalar(select(SessionResult))
        assert result.feedback_summary["demo"] is True
        assert "FICTÍCIO" in result.feedback_summary["label"]
