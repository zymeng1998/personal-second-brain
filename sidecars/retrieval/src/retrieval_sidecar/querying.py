"""`query` op: lexical (BM25), vector (cosine), and hybrid search. Read-only.

Hybrid (the default mode, SB-049): fetch a candidate pool from both rankers,
min-max normalize each score list to [0,1], combine as
`vector_weight * vec + (1 - vector_weight) * lex` (default 0.7/0.3, tunable via
args.vector_weight), deterministic id tie-break.
"""

from __future__ import annotations

from typing import Any

import duckdb

from .embeddings import embed_query, model_name
from .errors import OpError
from .index_store import index_path, resolve_workspace

DEFAULT_K = 10
DEFAULT_MODE = "hybrid"
DEFAULT_VECTOR_WEIGHT = 0.7
SNIPPET_CHARS = 200
SUPPORTED_MODES = ("lexical", "vector", "hybrid")
_POOL_FLOOR = 20  # hybrid candidate pool: max(k * 4, _POOL_FLOOR) per ranker


def _validate(args: dict[str, Any]) -> tuple[str, int, str, float]:
    q = args.get("q")
    if not isinstance(q, str) or q.strip() == "":
        raise OpError("invalid_args", "args.q (non-empty string) is required")
    k = args.get("k", DEFAULT_K)
    if not isinstance(k, int) or isinstance(k, bool) or k < 1:
        raise OpError("invalid_args", "args.k must be a positive integer")
    mode = args.get("mode", DEFAULT_MODE)
    if mode not in SUPPORTED_MODES:
        raise OpError(
            "unsupported_mode", f"mode '{mode}' not supported (lexical|vector|hybrid)"
        )
    weight = args.get("vector_weight", DEFAULT_VECTOR_WEIGHT)
    if not isinstance(weight, (int, float)) or isinstance(weight, bool) or not 0 <= weight <= 1:
        raise OpError("invalid_args", "args.vector_weight must be a number in [0, 1]")
    return q, k, mode, float(weight)


def _check_model_matches(connection: duckdb.DuckDBPyConnection) -> None:
    row = connection.execute("SELECT value FROM meta WHERE key = 'embed_model'").fetchone()
    indexed_model = row[0] if row else None
    if indexed_model != model_name():
        raise OpError(
            "index_model_mismatch",
            f"index built with '{indexed_model}' but current model is '{model_name()}'; "
            "re-run index_vault",
        )


def _lexical_rows(
    connection: duckdb.DuckDBPyConnection, q: str, n: int
) -> list[tuple[str, str, float, str]]:
    return connection.execute(
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
        [SNIPPET_CHARS, q, n],
    ).fetchall()


def _vector_rows(
    connection: duckdb.DuckDBPyConnection, q: str, n: int
) -> list[tuple[str, str, float, str]]:
    _check_model_matches(connection)
    dim_row = connection.execute("SELECT value FROM meta WHERE key = 'embed_dim'").fetchone()
    dim = int(dim_row[0]) if dim_row else 0
    query_vector = embed_query(q)
    return connection.execute(
        f"""
        SELECT e.chunk_id, c.note_id,
               1.0 - array_cosine_distance(e.vec, CAST(? AS FLOAT[{dim}])) AS score,
               substr(c.text, 1, ?) AS snippet
        FROM embeddings e
        JOIN chunks c ON c.chunk_id = e.chunk_id
        ORDER BY array_cosine_distance(e.vec, CAST(? AS FLOAT[{dim}])) ASC, e.chunk_id ASC
        LIMIT ?
        """,
        [query_vector, SNIPPET_CHARS, query_vector, n],
    ).fetchall()


def _normalized(rows: list[tuple[str, str, float, str]]) -> dict[str, float]:
    """Min-max normalize scores to [0,1]; a single candidate (or flat list) maps to 1.0."""
    if not rows:
        return {}
    scores = [row[2] for row in rows]
    low, high = min(scores), max(scores)
    if high == low:
        return {row[0]: 1.0 for row in rows}
    return {row[0]: (row[2] - low) / (high - low) for row in rows}


def _hybrid_rows(
    connection: duckdb.DuckDBPyConnection, q: str, k: int, weight: float
) -> list[tuple[str, str, float, str]]:
    pool = max(k * 4, _POOL_FLOOR)
    lexical = _lexical_rows(connection, q, pool)
    vector = _vector_rows(connection, q, pool)
    lex_norm = _normalized(lexical)
    vec_norm = _normalized(vector)
    by_id: dict[str, tuple[str, str, float, str]] = {}
    for row in [*vector, *lexical]:  # vector first so its snippet wins on overlap
        by_id.setdefault(row[0], row)
    combined = [
        (
            chunk_id,
            row[1],
            weight * vec_norm.get(chunk_id, 0.0) + (1 - weight) * lex_norm.get(chunk_id, 0.0),
            row[3],
        )
        for chunk_id, row in by_id.items()
    ]
    combined.sort(key=lambda row: (-row[2], row[0]))
    return combined[:k]


def op_query(args: dict[str, Any]) -> dict[str, Any]:
    workspace = resolve_workspace(args)
    q, k, mode, weight = _validate(args)
    db_path = index_path(workspace)
    if not db_path.is_file():
        raise OpError("index_missing", f"no index at {db_path}; run index_vault first")
    connection = duckdb.connect(str(db_path), read_only=True)
    try:
        connection.execute("LOAD fts")
        connection.execute("LOAD vss")
        if mode == "lexical":
            rows = _lexical_rows(connection, q, k)
        elif mode == "vector":
            rows = _vector_rows(connection, q, k)
        else:
            rows = _hybrid_rows(connection, q, k, weight)
    except duckdb.Error as exc:
        raise OpError("query_failed", f"duckdb: {exc}") from exc
    finally:
        connection.close()
    hits = [
        {"id": chunk_id, "score": float(score), "snippet": snippet, "source_ref": note_id}
        for chunk_id, note_id, score, snippet in rows
    ]
    return {"hits": hits}
