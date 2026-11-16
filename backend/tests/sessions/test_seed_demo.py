import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select

from app.modules.sessions.models import SessionResult
from app.modules.workouts.models import Workout

SEED_PATH = Path(__file__).resolve().parents[2] / "scripts" / "seed_demo.py"
SEED_SPEC = importlib.util.spec_from_file_location("seed_demo", SEED_PATH)
assert SEED_SPEC is not None and SEED_SPEC.loader is not None
SEED_MODULE = importlib.util.module_from_spec(SEED_SPEC)
SEED_SPEC.loader.exec_module(SEED_MODULE)
seed_maria_example_session = SEED_MODULE.seed_maria_example_session


def test_maria_demo_seed_is_idempotent(application, data):
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
        result = session.scalar(select(SessionResult))
        assert result.feedback_summary["demo"] is True
        assert "FICTÍCIO" in result.feedback_summary["label"]


# Fictitious test-only credentials; real demo values live only in .env.demo.
OLD = {
    "professional": ("demo.pro@example.com", "OldDemoPassword-1"),
    "Maria [DEMO]": ("demo.maria@example.com", "OldDemoPassword-2"),
    "Ana [DEMO]": ("demo.ana@example.com", "OldDemoPassword-3"),
}
NEW = {
    "professional": ("demo.pro@example.com", "NewDemoPassword-1"),
    "Maria [DEMO]": ("demo.maria@example.com", "NewDemoPassword-2"),
    "Ana [DEMO]": ("demo.ana@example.com", "NewDemoPassword-3"),
}
ENV_NAMES = {
    "professional": ("DEMO_PRO_EMAIL", "DEMO_PRO_PASSWORD"),
    "Maria [DEMO]": ("DEMO_MARIA_EMAIL", "DEMO_MARIA_PASSWORD"),
    "Ana [DEMO]": ("DEMO_ANA_EMAIL", "DEMO_ANA_PASSWORD"),
}


def _set_demo_env(monkeypatch, accounts) -> None:
    for name, (email_var, password_var) in ENV_NAMES.items():
        monkeypatch.setenv(email_var, accounts[name][0])
        monkeypatch.setenv(password_var, accounts[name][1])


def _create_demo_accounts(application) -> None:
    settings = application.state.settings
    with application.state.database.session() as session:
        professional = SEED_MODULE.get_or_create_professional(
            session, *OLD["professional"]
        )
        for name in ("Maria [DEMO]", "Ana [DEMO]"):
            SEED_MODULE.get_or_create_patient(
                session, professional, name, *OLD[name], settings
            )


def _login(client, email: str, password: str):
    return client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )


def _snapshot(application) -> dict[str, tuple[str, int, bool]]:
    from app.modules.auth.models import User

    with application.state.database.session() as session:
        return {
            user.email: (
                user.password_hash,
                user.auth_version,
                user.must_change_password,
            )
            for user in session.scalars(select(User))
        }


def test_seed_refuses_production_with_and_without_reset(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    _set_demo_env(monkeypatch, NEW)

    for argv in (["--reset-passwords"], []):
        with pytest.raises(ValueError, match="cannot run in production"):
            SEED_MODULE.main(argv)


def test_seed_refuses_production_coming_only_from_settings(monkeypatch):
    # APP_ENV set only in backend/.env is invisible to os.getenv.
    monkeypatch.delenv("APP_ENV", raising=False)
    _set_demo_env(monkeypatch, NEW)
    settings = SimpleNamespace(environment=SEED_MODULE.Environment.PRODUCTION)
    monkeypatch.setattr(SEED_MODULE, "get_settings", lambda: settings)

    for argv in (["--reset-passwords"], []):
        with pytest.raises(ValueError, match="cannot run in production"):
            SEED_MODULE.main(argv)


def test_reset_passwords_flag_is_opt_in():
    assert SEED_MODULE.parse_args([]).reset_passwords is False
    assert SEED_MODULE.parse_args(["--reset-passwords"]).reset_passwords is True


def test_reset_passwords_updates_existing_demo_accounts(
    application, client, monkeypatch, capsys
):
    _create_demo_accounts(application)
    old_maria = _login(client, *OLD["Maria [DEMO]"])
    assert old_maria.status_code == 200
    _set_demo_env(monkeypatch, NEW)
    monkeypatch.setattr(SEED_MODULE, "get_settings", lambda: application.state.settings)

    assert SEED_MODULE.main(["--reset-passwords"]) == 0

    output = capsys.readouterr().out
    assert "professional: updated" in output
    assert "Maria [DEMO]: updated" in output
    assert "Ana [DEMO]: updated" in output
    for _email, password in NEW.values():
        assert password not in output
    for name in NEW:
        old_login = _login(client, *OLD[name])
        assert old_login.status_code == 401
        assert old_login.json()["code"] == "invalid_credentials"
        assert _login(client, *NEW[name]).status_code == 200
    revoked = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_maria.json()["refresh_token"]},
    )
    assert revoked.status_code == 401
    assert revoked.json()["code"] == "refresh_token_revoked"

    maria = _login(client, *NEW["Maria [DEMO]"]).json()["access_token"]
    profile = client.get(
        "/api/v1/me/profile", headers={"Authorization": f"Bearer {maria}"}
    )
    assert profile.status_code == 200
    state = _snapshot(application)
    assert state["demo.pro@example.com"][2] is False
    assert state["demo.maria@example.com"][2] is False
    assert state["demo.ana@example.com"][2] is False


def test_reset_passwords_is_idempotent(application):
    _create_demo_accounts(application)
    with application.state.database.session() as session:
        first = SEED_MODULE.reset_demo_passwords(session, NEW)
    after_first = _snapshot(application)
    with application.state.database.session() as session:
        second = SEED_MODULE.reset_demo_passwords(session, NEW)

    assert set(first.values()) == {"updated"}
    assert set(second.values()) == {"unchanged"}
    assert _snapshot(application) == after_first


def test_reset_passwords_reports_missing_accounts_without_creating(application):
    from app.modules.auth.models import User

    with application.state.database.session() as session:
        outcome = SEED_MODULE.reset_demo_passwords(session, NEW)
        assert session.scalar(select(func.count()).select_from(User)) == 0

    assert set(outcome.values()) == {"missing"}


def test_reset_passwords_rejects_wrong_role_without_partial_change(application):
    _create_demo_accounts(application)
    before = _snapshot(application)
    swapped = dict(NEW)
    swapped["Ana [DEMO]"] = ("demo.pro@example.com", "NewDemoPassword-3")

    with application.state.database.session() as session:
        with pytest.raises(ValueError, match="another role"):
            SEED_MODULE.reset_demo_passwords(session, swapped)

    assert _snapshot(application) == before


def test_reset_passwords_keeps_minimum_length(application):
    _create_demo_accounts(application)
    before = _snapshot(application)
    short = dict(NEW)
    short["Ana [DEMO]"] = ("demo.ana@example.com", "short-pass1")

    with application.state.database.session() as session:
        with pytest.raises(ValueError, match="between 12"):
            SEED_MODULE.reset_demo_passwords(session, short)

    assert _snapshot(application) == before
