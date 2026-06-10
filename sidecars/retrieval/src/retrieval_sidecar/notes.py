"""Read-only vault scanning.

Reads `<workspace>/vault/**/*.md`, splits frontmatter from body, and recovers
each note's canonical ULID id (frontmatter `id:`, falling back to the
`<ULID>--slug.md` filename convention). NEVER writes anything.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

ULID_RE = re.compile(r"^[0-7][0-9A-HJKMNP-TV-Z]{25}$")
_FM_ID_RE = re.compile(r"^id:\s*[\"']?([0-9A-Za-z]+)[\"']?\s*$", re.MULTILINE)
_FM_TITLE_RE = re.compile(r"^title:\s*(.+?)\s*$", re.MULTILINE)


@dataclass(frozen=True)
class VaultNote:
    note_id: str
    title: str
    body: str
    relative_path: str


def split_frontmatter(text: str) -> tuple[str, str]:
    """Return (frontmatter_block, body). Lenient: no frontmatter -> ("", text)."""
    if not text.startswith("---\n") and text != "---":
        return "", text
    end = text.find("\n---", 4)
    if end == -1:
        return "", text
    frontmatter = text[4:end]
    after = text.find("\n", end + 1)
    body = "" if after == -1 else text[after + 1 :]
    return frontmatter, body


def _note_id_of(frontmatter: str, path: Path) -> str | None:
    match = _FM_ID_RE.search(frontmatter)
    if match and ULID_RE.match(match.group(1)):
        return match.group(1)
    stem_prefix = path.stem.split("--", 1)[0]
    if ULID_RE.match(stem_prefix):
        return stem_prefix
    return None


def _title_of(frontmatter: str) -> str:
    match = _FM_TITLE_RE.search(frontmatter)
    if match is None:
        return ""
    return match.group(1).strip().strip("\"'")


def scan_vault(workspace: Path) -> list[VaultNote]:
    """Deterministic (path-sorted) read-only scan of every vault markdown note."""
    vault = workspace / "vault"
    if not vault.is_dir():
        return []
    notes: list[VaultNote] = []
    for path in sorted(vault.rglob("*.md")):
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            print(f"[retrieval-sidecar] skipping unreadable {path}: {exc}", file=sys.stderr)
            continue
        frontmatter, body = split_frontmatter(text)
        note_id = _note_id_of(frontmatter, path)
        if note_id is None:
            print(f"[retrieval-sidecar] skipping {path}: no ULID id", file=sys.stderr)
            continue
        notes.append(
            VaultNote(
                note_id=note_id,
                title=_title_of(frontmatter),
                body=body,
                relative_path=str(path.relative_to(workspace)),
            )
        )
    return notes
