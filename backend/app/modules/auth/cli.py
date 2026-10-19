import argparse
import getpass
import sys
from collections.abc import Sequence

from pydantic import ValidationError

from app.core.config import get_settings
from app.core.errors import ApiError
from app.db.session import Database
from app.modules.auth.services import AccountProvisioningService


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="FisioMove account administration")
    subparsers = parser.add_subparsers(dest="command", required=True)
    create = subparsers.add_parser(
        "create-physiotherapist",
        help="create the first physiotherapist account",
    )
    create.add_argument("--email", required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    password = getpass.getpass("Temporary password: ")
    confirmation = getpass.getpass("Confirm temporary password: ")
    if password != confirmation:
        print("Passwords do not match.", file=sys.stderr)
        return 2

    settings = get_settings()
    database = Database(settings.database_url, echo=settings.db_echo)
    try:
        with database.session() as session:
            user = AccountProvisioningService(session).create_initial_physiotherapist(
                args.email, password
            )
            print(f"Created physiotherapist {user.email} ({user.id}).")
        return 0
    except (ApiError, ValidationError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        database.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
