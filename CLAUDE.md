# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

FisioMove is an academic TCC project (UNIFOR): a mobile app supporting home physiotherapy exercises with computer vision and gamification. Docs, code comments in `docs/` and user-facing text are in Portuguese. `AGENTS.md` holds the binding project rules; the most important are repeated below.

## Non-negotiable rules (from AGENTS.md)

- Never send camera images/frames to the backend. Pose estimation, calibration and real-time feedback run on the device; the backend only receives derived session data. There is intentionally no media upload endpoint.
- Do not invent clinical rules, exercise parameters, angles, tolerances or corrective texts, and do not implement clinical features without explicit specification. The production exercise catalog is intentionally empty until a physiotherapist approves the first exercise (see `docs/contracts/clinical-catalog.md`).
- Keep TypeScript `strict`; use type hints in Python. Confirm a new dependency is necessary, compatible and maintained before adding it. Avoid premature abstractions.
- Run lint, type checks and tests before considering a task done.

## Commands

Backend (`backend/`, Python 3.12+, PostgreSQL):

```bash
python -m pip install -e '.[dev]'     # inside a venv
cp .env.example .env                   # set DATABASE_URL and AUTH_SECRET_KEY (>=32 chars)
alembic upgrade head
uvicorn app.main:app --reload          # GET /health; API under /api/v1
ruff check . && ruff format --check . && pytest
pytest tests/sessions/test_sessions.py::test_name   # single test
python -m app.modules.auth.cli create-physiotherapist --email ...   # first account (interactive password)
python -m scripts.seed_demo            # idempotent fictional demo seed
```

Tests run on temporary SQLite (`APP_ENV=test` is the only env where SQLite is accepted). The PostgreSQL integration test runs only when `FISIOMOVE_TEST_POSTGRES_URL` points to a dedicated test server.

Mobile (`mobile/`, React Native 0.87, Node 22.13+):

```bash
npm install && npm start               # Metro; then npm run android / npm run ios
npm run lint && npm run type-check && npm test && npm run format:check
npx jest __tests__/flow.test.ts        # single test file
```

## Backend architecture

- `app/main.py` exposes `create_app(settings)`: settings and the `Database` are injected and stored on `app.state`; tests build their own app with a temp DB and run Alembic migrations to `head` (see `tests/conftest.py`).
- Each domain lives in `app/modules/<name>/` with `router.py` → `services.py` (business logic, takes a SQLAlchemy `Session`) → `models.py`, plus `schemas.py` (Pydantic) and sometimes `repositories.py`. Routers are aggregated in `app/api/router.py`.
- New models must be registered in `app/db/models.py` (Alembic import registry). Migrations live in `migrations/versions/`; add new revisions on the current head and never rewrite applied ones.
- Auth: JWT access tokens + rotating/revocable refresh tokens, Argon2 passwords, roles via `require_role(UserRole.…)`. No public sign-up: physiotherapists provision patient access and the temporary password must be changed on first login.
- Authorization is by professional–patient link (`patients/authorization.py`); the professional ID is always taken from the authenticated identity, never from the request body. Patients only see `/me/...` routes.
- Key domain invariants:
  - Workouts are versioned revisions that snapshot the exercise and its parameters (`rule_version`); sessions record the revision current at session start, so history is never rewritten.
  - Session creation is idempotent (retries return the same session); `score` is computed server-side (one point per accepted repetition, capped at the prescription) — clients never send it. No reward for exceeding prescription; achievements require hitting the exact goal.
  - Exercises are usable only when the current version has an `approved` governance record (`ExerciseGovernanceService`, internal only, append-only events). Test fixtures (`fictional-test-only`) must never be promoted to production.
  - `professional_only` notes are filtered before pagination/counting.
- Contracts and module specs: `docs/contracts/` and `docs/modules/`; MVP traceability in `docs/backend-mvp-audit.md`.

## Mobile architecture

Currently a local, navigable demo (`App.tsx` + `src/flow.ts` reducer/screens + `src/ui.tsx`): camera permission, voice, and repetitions are simulated; no API calls, persistence, or real scoring. The demo's 2×8 repetitions come from the prototype, not a prescription. Flow and manual test script: `docs/mobile/patient-flow.md`. Calibration contract (on-device): `docs/modules/calibration.md`.
