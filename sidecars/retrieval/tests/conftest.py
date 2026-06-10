"""Shared fixtures: a synthetic throwaway workspace (never real data)."""

from pathlib import Path

import pytest

# Valid ULIDs (Crockford base32, 26 chars, leading char 0-7).
ULID_A = "01ARZ3NDEKTSV4RRFFQ69G5FAV"
ULID_B = "01BX5ZZKBKACTAV9WEVGEMMVRY"
ULID_C = "01BX5ZZKBKACTAV9WEVGEMMVS0"


def write_note(vault_dir: Path, note_id: str, title: str, body: str, folder: str = "00_Raw") -> Path:
    folder_path = vault_dir / folder
    folder_path.mkdir(parents=True, exist_ok=True)
    path = folder_path / f"{note_id}--note.md"
    path.write_text(
        f"---\nid: {note_id}\ntype: raw\nlayer: 0\ncreated: 2026-06-10T00:00:00Z\ntitle: {title}\n---\n\n{body}\n",
        encoding="utf-8",
    )
    return path


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    (tmp_path / "vault").mkdir()
    return tmp_path


def snapshot_tree(root: Path, exclude_top: set[str]) -> dict[str, bytes]:
    """Map of relative path -> bytes for everything outside the excluded top dirs."""
    snapshot: dict[str, bytes] = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if relative.parts and relative.parts[0] in exclude_top:
            continue
        if path.is_file():
            snapshot[str(relative)] = path.read_bytes()
    return snapshot
