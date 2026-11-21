"""pt-BR name and steps for the library's validated track (DEC-011, revised).

`translations_pt_br.json` maps each `external_id` to a Portuguese name, its
steps and the SHA-256 of the English text it was translated from. The steps
are used only while the source text is unchanged, so an upstream edit falls
back to the English original instead of showing a stale translation. The
translation was made by the FisioMove team and was not reviewed by a
physiotherapist; a translation saved by a physiotherapist always wins.
"""

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path

TRANSLATION_FILE = Path(__file__).with_name("translations_pt_br.json")
TRANSLATED_AT = datetime(2026, 11, 21, tzinfo=UTC)
TRANSLATOR_NAME = "equipe do FisioMove"


@dataclass(frozen=True)
class LibraryTranslation:
    name: str
    instructions: tuple[str, ...]
    source_sha256: str

    def matches(self, name: str, instructions: str) -> bool:
        """True when `name` and the stored "n. step" text are the translated ones."""
        return bool(self.instructions) and (
            source_fingerprint(name, instructions) == self.source_sha256
        )


def source_fingerprint(name: str, instructions: str) -> str:
    """Hash of the English name and steps in the catalog's "n. step" format."""
    return hashlib.sha256(f"{name}\n{instructions}".encode()).hexdigest()


@lru_cache(maxsize=1)
def _translations() -> dict[str, LibraryTranslation]:
    data = json.loads(TRANSLATION_FILE.read_text(encoding="utf-8"))
    return {
        external_id: LibraryTranslation(
            name=item["name"],
            instructions=tuple(item["instructions"]),
            source_sha256=item["source_sha256"],
        )
        for external_id, item in data.items()
    }


def library_translation(external_id: str | None) -> LibraryTranslation | None:
    if external_id is None:
        return None
    return _translations().get(external_id)
