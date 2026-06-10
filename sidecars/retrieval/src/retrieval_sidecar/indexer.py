"""`index_vault` op: vault (read-only) -> DuckDB FTS index (full rebuild).

The previous index file is deleted and rebuilt from scratch each run —
`indexes/retrieval.duckdb` is disposable by contract, and a full rebuild keeps
the build idempotent and deterministic.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb

from .chunking import Chunk, chunk_note
from .errors import OpError
from .index_store import index_path, resolve_workspace
from .notes import scan_vault


def _rebuild(db_path: Path, chunks: list[Chunk]) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.unlink(missing_ok=True)
    db_path.with_suffix(db_path.suffix + ".wal").unlink(missing_ok=True)
    connection = duckdb.connect(str(db_path))
    try:
        connection.execute("INSTALL fts")
        connection.execute("LOAD fts")
        connection.execute(
            """
            CREATE TABLE chunks (
              chunk_id TEXT PRIMARY KEY,
              note_id  TEXT NOT NULL,
              seq      INTEGER NOT NULL,
              text     TEXT NOT NULL
            )
            """
        )
        if chunks:
            connection.executemany(
                "INSERT INTO chunks VALUES (?, ?, ?, ?)",
                [(c.chunk_id, c.note_id, c.seq, c.text) for c in chunks],
            )
        connection.execute("PRAGMA create_fts_index('chunks', 'chunk_id', 'text', overwrite=1)")
    finally:
        connection.close()


def op_index_vault(args: dict[str, Any]) -> dict[str, Any]:
    workspace = resolve_workspace(args)
    notes = scan_vault(workspace)
    chunks: list[Chunk] = []
    for note in notes:
        chunks.extend(chunk_note(note.note_id, note.title, note.body))
    try:
        _rebuild(index_path(workspace), chunks)
    except duckdb.Error as exc:
        raise OpError("index_build_failed", f"duckdb: {exc}") from exc
    return {"notes": len(notes), "chunks": len(chunks), "built": ["fts"]}
