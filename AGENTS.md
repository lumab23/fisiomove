# Repository Guidelines

## Project Structure & Module Organization

- `mobile/`: React Native application with strict TypeScript. `App.tsx` connects screens; `src/` contains shared UI, flow logic, and local assets; `__tests__/` contains Jest tests. Native projects live in `android/` and `ios/`.
- `backend/app/`: FastAPI API, configuration, database infrastructure, and domain modules under `modules/` (authentication, patients, workouts, sessions, progress, and achievements).
- `backend/tests/`: pytest suites organized by domain; `backend/migrations/`: Alembic revisions.
- `docs/contracts/`, `docs/modules/`, and `docs/mobile/`: integration contracts, implementation notes, and manual test instructions.

## Build, Test, and Development Commands

Run from each directory:

- `mobile/`: `npm ci` installs locked dependencies; `npm start` starts Metro. Run `npm run android` or `npm run ios` separately to build and launch with configured native SDKs.
- Mobile checks: `npm run lint`, `npm run type-check`, `npm test -- --runInBand`, and `npm run format:check`. Use `npm run format` to apply Prettier.
- `backend/`: create and activate `.venv`, then run `python -m pip install -e '.[dev]'`.
- Configure `.env` from `.env.example`; run `alembic upgrade head` against local PostgreSQL, then `uvicorn app.main:app --reload`.
- Backend checks: `ruff check .`, `ruff format --check .`, and `pytest`.

## Coding Style & Naming Conventions

Use UTF-8, LF endings, and spaces: two-space indentation generally, four for Python. Keep TypeScript strict and annotate Python types. Use PascalCase for React components, camelCase for TypeScript functions, and snake_case for Python modules/functions. Follow Prettier's single quotes and trailing commas; Ruff enforces Python formatting, imports, and an 88-character line length. Confirm new dependencies are necessary, compatible, and maintained; avoid premature abstractions.

## Testing Guidelines

Name mobile tests `*.test.ts` or `*.test.tsx`; name Python tests `test_*.py`. Cover business rules, authorization, failure paths, and navigation changes. No numeric coverage threshold is configured. Run applicable checks before completion. Review UI changes visually across screen sizes, text lengths, empty/error states, and accessibility needs; include screenshots and disclose unavailable device checks.

## Commit & Pull Request Guidelines

Follow existing Conventional Commit examples: `feat(sessions): ...`, `fix(backend): ...`, or `docs(backend): ...`. PRs should explain behavior changes, link relevant issues/contracts, report validation, and include screenshots for UI changes.

## Security & Clinical Safeguards

Never commit credentials, tokens, or `.env` files. Keep camera processing on-device; do not send images or frames to the backend by default. Require explicit specifications for clinical features; never invent clinical rules or independently change exercise parameters. Keep demo fixtures separate from production data. Add migrations without rewriting applied revisions.
