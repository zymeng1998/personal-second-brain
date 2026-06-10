"""`index_vault` op: vault (read-only) -> DuckDB FTS + vector index (full rebuild).

The index is rebuilt from scratch each run — `indexes/retrieval.duckdb` is
disposable by contract, and a full rebuild keeps the build idempotent and
deterministic (single-threaded build connection so the HNSW graph construction
order is stable). The build lands in a `.tmp` file that atomically replaces the
previous index only on success, so a failed build never leaves the workspace
index-less.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import duckdb

from .chunking import Chunk, chunk_note
from .embeddings import embed_passages, embedding_dim, model_name
from .errors import OpError
from .index_store import index_path, resolve_workspace
from .notes import VaultNote, scan_vault

# event streams whose timestamps feed the temporal index (read-only; the
# projection stream describes index builds, not notes, so it is excluded)
_EVENT_STREAMS = ("capture_events.jsonl", "memory_events.jsonl")


def _graph_edges(notes: list[VaultNote]) -> list[tuple[str, str, str, str]]:
    """L4 graph edges: frontmatter `entities` refs + body `[[wikilinks]]`.

    Wikilinks resolve by exact note title (path-sorted first note wins on a
    duplicate title — deterministic); unresolved links and self-links are
    skipped. `source_ref` = the linking note (provenance).
    """
    title_to_id: dict[str, str] = {}
    for note in notes:  # notes are path-sorted, so collisions resolve deterministically
        if note.title and note.title not in title_to_id:
            title_to_id[note.title] = note.note_id
    edges: list[tuple[str, str, str, str]] = []
    for note in notes:
        for ref in note.entities:
            if ref != note.note_id:
                edges.append((note.note_id, ref, "entity_ref", note.note_id))
        for target_title in note.wikilinks:
            target = title_to_id.get(target_title)
            if target is not None and target != note.note_id:
                edges.append((note.note_id, target, "wikilink", note.note_id))
    return list(dict.fromkeys(edges))


def _temporal_rows(workspace: Path, notes: list[VaultNote]) -> list[tuple[str, str, str]]:
    """(note_id, iso_ts, source) rows from frontmatter dates + event timestamps."""
    rows: list[tuple[str, str, str]] = []
    for note in notes:
        if note.created:
            rows.append((note.note_id, note.created, "frontmatter:created"))
        if note.updated:
            rows.append((note.note_id, note.updated, "frontmatter:updated"))
    note_ids = {note.note_id for note in notes}
    for stream in _EVENT_STREAMS:
        path = workspace / "events" / stream
        if not path.is_file():
            continue
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeDecodeError) as exc:
            print(f"[retrieval-sidecar] skipping unreadable {path}: {exc}", file=sys.stderr)
            continue
        for line in lines:
            if line.strip() == "":
                continue
            try:
                event = json.loads(line)
            except ValueError:
                continue  # event validity is TS-owned; the indexer just skips junk
            subject = event.get("subject_id")
            occurred = event.get("occurred_at")
            if isinstance(subject, str) and subject in note_ids and isinstance(occurred, str):
                rows.append((subject, occurred, f"event:{event.get('kind', 'unknown')}"))
    return list(dict.fromkeys(rows))


def _rebuild(
    db_path: Path,
    chunks: list[Chunk],
    vectors: list[list[float]],
    dim: int,
    edges: list[tuple[str, str, str, str]],
    temporal: list[tuple[str, str, str]],
) -> None:
    """Build into `<file>.tmp`, then atomically swap it in (review MEDIUM #2):
    a failed build leaves the previous index untouched instead of an index-less
    workspace."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = db_path.with_name(db_path.name + ".tmp")
    _delete_index_files(tmp_path)
    try:
        _build_into(tmp_path, chunks, vectors, dim, edges, temporal)
    except BaseException:
        _delete_index_files(tmp_path)
        raise
    # success: the stale WAL (if any) must go before the rename, never after
    _delete_index_files(db_path)
    tmp_path.replace(db_path)


def _delete_index_files(path: Path) -> None:
    path.unlink(missing_ok=True)
    path.with_name(path.name + ".wal").unlink(missing_ok=True)


def _build_into(
    db_path: Path,
    chunks: list[Chunk],
    vectors: list[list[float]],
    dim: int,
    edges: list[tuple[str, str, str, str]],
    temporal: list[tuple[str, str, str]],
) -> None:
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
        connection.execute(
            """
            CREATE TABLE graph_edges (
              from_id    TEXT NOT NULL,
              to_id      TEXT NOT NULL,
              kind       TEXT NOT NULL,
              source_ref TEXT NOT NULL
            )
            """
        )
        if edges:
            connection.executemany("INSERT INTO graph_edges VALUES (?, ?, ?, ?)", edges)
        connection.execute(
            """
            CREATE TABLE temporal (
              note_id TEXT NOT NULL,
              ts      TIMESTAMP,
              bucket  DATE,
              source  TEXT NOT NULL
            )
            """
        )
        if temporal:
            connection.executemany(
                """
                INSERT INTO temporal
                SELECT ?, TRY_CAST(? AS TIMESTAMP),
                       CAST(TRY_CAST(? AS TIMESTAMP) AS DATE), ?
                """,
                [(n, ts, ts, src) for n, ts, src in temporal],
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
    edges = _graph_edges(notes)
    temporal = _temporal_rows(workspace, notes)
    try:
        _rebuild(index_path(workspace), chunks, vectors, embedding_dim(), edges, temporal)
    except duckdb.Error as exc:
        raise OpError("index_build_failed", f"duckdb: {exc}") from exc
    return {
        "notes": len(notes),
        "chunks": len(chunks),
        "built": ["fts", "vector", "graph", "temporal"],
    }
