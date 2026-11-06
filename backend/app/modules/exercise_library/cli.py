"""Exercise library administration.

`python -m app.modules.exercise_library.cli backfill-images` copies the images
of exercises already imported from OpenExerciseBase that have none (DEC-010).
"""

import argparse
import sys
from collections.abc import Sequence

from app.core.config import get_settings
from app.db.session import Database
from app.modules.exercise_library.images import BackfillReport, backfill_images
from app.modules.exercise_library.providers import (
    ExerciseLibraryProvider,
    OpenExerciseBaseProvider,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="FisioMove exercise library")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser(
        "backfill-images",
        help="store images for imported exercises that have none (idempotent)",
    )
    return parser


def _print_report(report: BackfillReport) -> None:
    print(f"Exercises updated: {len(report.updated)}")
    print(f"Already had images: {len(report.already_done)}")
    print(f"No valid image at the source: {len(report.without_valid_images)}")
    print(f"No longer in the source: {len(report.not_found)}")
    print(f"Source unavailable: {len(report.unavailable)}")
    for label, ids in (
        ("no valid image", report.without_valid_images),
        ("not found", report.not_found),
        ("unavailable", report.unavailable),
    ):
        for exercise_id in ids:
            print(f"  {label}: {exercise_id}")


def main(
    argv: Sequence[str] | None = None,
    *,
    database: Database | None = None,
    provider: ExerciseLibraryProvider | None = None,
) -> int:
    build_parser().parse_args(argv)
    owns_database = database is None
    if database is None or provider is None:
        settings = get_settings()
        if not settings.exercise_library_enabled:
            print("The external exercise library is disabled.", file=sys.stderr)
            return 1
        database = database or Database(settings.database_url, echo=settings.db_echo)
        provider = provider or OpenExerciseBaseProvider.from_settings(settings)
    try:
        report = backfill_images(database, provider)
    finally:
        if owns_database:
            database.dispose()
    _print_report(report)
    return 1 if report.unavailable else 0


if __name__ == "__main__":
    raise SystemExit(main())
