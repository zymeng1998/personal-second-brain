"""`query` op: lexical (BM25) search over the FTS index. Read-only."""

from __future__ import annotations

from typing import Any

import duckdb

from .errors import OpError
from .index_store import index_path, resolve_workspace

DEFAULT_K = 10
SNIPPET_CHARS = 200
SUPPORTED_MODES = ("lexical",)  # vector/hybrid land with SB-049


def _validate(args: dict[str, Any]) -> tuple[str, int, str]:
    q = args.get("q")
    if not isinstance(q, str) or q.strip() == "":
        raise OpError("invalid_args", "args.q (non-empty string) is required")
    k = args.get("k", DEFAULT_K)
    if not isinstance(k, int) or isinstance(k, bool) or k < 1:
        raise OpError("invalid_args", "args.k must be a positive integer")
    mode = args.get("mode", "lexical")
    if mode not in SUPPORTED_MODES:
        raise OpError("unsupported_mode", f"mode '{mode}' not available yet (supported: lexical)")
    return q, k, mode


def op_query(args: dict[str, Any]) -> dict[str, Any]:
    workspace = resolve_workspace(args)
    q, k, _mode = _validate(args)
    db_path = index_path(workspace)
    if not db_path.is_file():
        raise OpError("index_missing", f"no index at {db_path}; run index_vault first")
    connection = duckdb.connect(str(db_path), read_only=True)
    try:
        connection.execute("LOAD fts")
        rows = connection.execute(
            """
            SELECT chunk_id, note_id, score, substr(text, 1, ?) AS snippet
            FROM (
              SELECT *, fts_main_chunks.match_bm25(chunk_id, ?) AS score
              FROM chunks
            )
            WHERE score IS NOT NULL
            ORDER BY score DESC, chunk_id ASC
            LIMIT ?
            """,
            [SNIPPET_CHARS, q, k],
        ).fetchall()
    except duckdb.Error as exc:
        raise OpError("query_failed", f"duckdb: {exc}") from exc
    finally:
        connection.close()
    hits = [
        {"id": chunk_id, "score": float(score), "snippet": snippet, "source_ref": note_id}
        for chunk_id, note_id, score, snippet in rows
    ]
    return {"hits": hits}
