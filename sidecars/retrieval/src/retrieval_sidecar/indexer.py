"""`index_vault` op: vault (read-only) -> DuckDB FTS + vector index (full rebuild).

The previous index file is deleted and rebuilt from scratch each run —
`indexes/retrieval.duckdb` is disposable by contract, and a full rebuild keeps
the build idempotent and deterministic (single-threaded build connection so the
HNSW graph construction order is stable).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb

from .chunking import Chunk, chunk_note
from .embeddings import embed_passages, embedding_dim, model_name
from .errors import OpError
from .index_store import index_path, resolve_workspace
from .notes import scan_vault


def _rebuild(db_path: Path, chunks: list[Chunk], vectors: list[list[float]], dim: int) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.unlink(missing_ok=True)
    db_path.with_suffix(db_path.suffix + ".wal").unlink(missing_ok=True)
    connection = duckdb.connect(str(db_path))
    try:
        connection.execute("SET threads = 1")  # deterministic HNSW construction
        connection.execute("INSTALL fts")
        connection.execute("LOAD fts")
        connection.execute("INSTALL vss")
        connection.execute("LOAD vss")
        # the index file is disposable/rebuildable, so experimental persistence is acceptable
        connection.execute("SET hnsw_enable_experimental_persistence = true")
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
        connection.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        connection.execute(
            "INSERT INTO meta VALUES ('embed_model', ?), ('embed_dim', ?)",
            [model_name(), str(dim)],
        )
        connection.execute(
            f"CREATE TABLE embeddings (chunk_id TEXT PRIMARY KEY, vec FLOAT[{dim}] NOT NULL)"
        )
        if chunks:
            connection.executemany(
                "INSERT INTO chunks VALUES (?, ?, ?, ?)",
                [(c.chunk_id, c.note_id, c.seq, c.text) for c in chunks],
            )
            connection.executemany(
                f"INSERT INTO embeddings SELECT ?, CAST(? AS FLOAT[{dim}])",
                [(c.chunk_id, v) for c, v in zip(chunks, vectors, strict=True)],
            )
        connection.execute("PRAGMA create_fts_index('chunks', 'chunk_id', 'text', overwrite=1)")
        connection.execute(
            "CREATE INDEX embeddings_hnsw ON embeddings USING HNSW (vec) WITH (metric = 'cosine')"
        )
    finally:
        connection.close()


def op_index_vault(args: dict[str, Any]) -> dict[str, Any]:
    workspace = resolve_workspace(args)
    notes = scan_vault(workspace)
    chunks: list[Chunk] = []
    for note in notes:
        chunks.extend(chunk_note(note.note_id, note.title, note.body))
    vectors = embed_passages([c.text for c in chunks])  # raises OpError if the model is unavailable
    try:
        _rebuild(index_path(workspace), chunks, vectors, embedding_dim())
    except duckdb.Error as exc:
        raise OpError("index_build_failed", f"duckdb: {exc}") from exc
    return {"notes": len(notes), "chunks": len(chunks), "built": ["fts", "vector"]}
