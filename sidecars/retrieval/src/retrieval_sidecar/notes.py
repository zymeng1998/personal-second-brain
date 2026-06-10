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
_FM_CREATED_RE = re.compile(r"^created:\s*[\"']?([^\"'\n]+?)[\"']?\s*$", re.MULTILINE)
_FM_UPDATED_RE = re.compile(r"^updated:\s*[\"']?([^\"'\n]+?)[\"']?\s*$", re.MULTILINE)
_ENTITIES_HEADER_RE = re.compile(r"^entities:\s*$")
_LIST_ITEM_RE = re.compile(r"^\s+-\s*[\"']?([0-9A-Z]+)[\"']?\s*$")
# [[Target]] / [[Target|alias]] / [[Target#heading]] -> "Target"
_WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]")


@dataclass(frozen=True)
class VaultNote:
    note_id: str
    title: str
    body: str
    relative_path: str
    # SB-055 graph/temporal inputs
    entities: tuple[str, ...] = ()
    wikilinks: tuple[str, ...] = ()
    created: str | None = None
    updated: str | None = None


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


def _entities_of(frontmatter: str) -> tuple[str, ...]:
    """ULIDs from the frontmatter `entities:` block (block-list form only)."""
    refs: list[str] = []
    in_block = False
    for line in frontmatter.splitlines():
        if _ENTITIES_HEADER_RE.match(line):
            in_block = True
            continue
        if in_block:
            item = _LIST_ITEM_RE.match(line)
            if item and ULID_RE.match(item.group(1)):
                refs.append(item.group(1))
                continue
            in_block = False
    return tuple(dict.fromkeys(refs))


def _date_of(pattern: re.Pattern[str], frontmatter: str) -> str | None:
    match = pattern.search(frontmatter)
    return match.group(1).strip() if match else None


def _wikilinks_of(body: str) -> tuple[str, ...]:
    targets = [m.group(1).strip() for m in _WIKILINK_RE.finditer(body)]
    return tuple(dict.fromkeys(t for t in targets if t))


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
                entities=_entities_of(frontmatter),
                wikilinks=_wikilinks_of(body),
                created=_date_of(_FM_CREATED_RE, frontmatter),
                updated=_date_of(_FM_UPDATED_RE, frontmatter),
            )
        )
    return notes
