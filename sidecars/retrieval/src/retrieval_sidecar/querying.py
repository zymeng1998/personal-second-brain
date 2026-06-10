"""`query` op: lexical (BM25), vector (cosine), and hybrid search. Read-only.

Hybrid (the default mode, SB-049): fetch a candidate pool from both rankers,
min-max normalize each score list to [0,1], combine as
`vector_weight * vec + (1 - vector_weight) * lex` (default 0.7/0.3, tunable via
args.vector_weight), deterministic id tie-break.

Filters (SB-055) compose with every mode via `args.filters`:
  near: <note ULID>  -> restrict to the 1-hop graph neighborhood (plus the note itself)
  from / to: ISO ts  -> restrict to notes with a temporal row in the inclusive range
Multiple filters intersect. An empty allowed set short-circuits to zero hits.
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


def _validate_filters(args: dict[str, Any]) -> dict[str, str]:
    filters = args.get("filters")
    if filters is None:
        return {}
    if not isinstance(filters, dict):
        raise OpError("invalid_args", "args.filters must be an object")
    validated: dict[str, str] = {}
    for key in ("near", "from", "to"):
        value = filters.get(key)
        if value is None:
            continue
        if not isinstance(value, str) or value.strip() == "":
            raise OpError("invalid_args", f"args.filters.{key} must be a non-empty string")
        validated[key] = value
    unknown = set(filters) - {"near", "from", "to"}
    if unknown:
        raise OpError("invalid_args", f"unknown filter keys: {sorted(unknown)}")
    return validated


def _assert_castable_timestamp(connection: duckdb.DuckDBPyConnection, key: str, value: str) -> None:
    row = connection.execute("SELECT TRY_CAST(? AS TIMESTAMP)", [value]).fetchone()
    if row is None or row[0] is None:
        raise OpError("invalid_args", f"args.filters.{key} is not a parseable timestamp: {value}")


def _allowed_note_ids(
    connection: duckdb.DuckDBPyConnection, filters: dict[str, str]
) -> set[str] | None:
    """The note-id set the filters allow; None means unfiltered."""
    allowed: set[str] | None = None
    near = filters.get("near")
    if near is not None:
        rows = connection.execute(
            "SELECT to_id FROM graph_edges WHERE from_id = ? "
            "UNION SELECT from_id FROM graph_edges WHERE to_id = ?",
            [near, near],
        ).fetchall()
        allowed = {near} | {row[0] for row in rows}
    lower, upper = filters.get("from"), filters.get("to")
    if lower is not None or upper is not None:
        sql = "SELECT DISTINCT note_id FROM temporal WHERE ts IS NOT NULL"
        params: list[str] = []
        if lower is not None:
            _assert_castable_timestamp(connection, "from", lower)
            sql += " AND ts >= TRY_CAST(? AS TIMESTAMP)"
            params.append(lower)
        if upper is not None:
            _assert_castable_timestamp(connection, "to", upper)
            sql += " AND ts <= TRY_CAST(? AS TIMESTAMP)"
            params.append(upper)
        in_range = {row[0] for row in connection.execute(sql, params).fetchall()}
        allowed = in_range if allowed is None else allowed & in_range
    return allowed


def _check_model_matches(connection: duckdb.DuckDBPyConnection) -> None:
    row = connection.execute("SELECT value FROM meta WHERE key = 'embed_model'").fetchone()
    indexed_model = row[0] if row else None
    if indexed_model != model_name():
        raise OpError(
            "index_model_mismatch",
            f"index built with '{indexed_model}' but current model is '{model_name()}'; "
            "re-run index_vault",
        )


def _in_clause(column: str, allowed: set[str] | None) -> tuple[str, list[list[str]]]:
    """Bounded filter clause: ONE list parameter regardless of the allowed-set
    size (review MEDIUM #5 — a wide temporal range used to expand into one `?`
    per note id, growing the SQL statement without bound)."""
    if allowed is None:
        return "", []
    return f" AND list_contains(?, {column})", [sorted(allowed)]


def _lexical_rows(
    connection: duckdb.DuckDBPyConnection, q: str, n: int, allowed: set[str] | None = None
) -> list[tuple[str, str, float, str]]:
    clause, in_params = _in_clause("note_id", allowed)
    return connection.execute(
        f"""
        SELECT chunk_id, note_id, score, substr(text, 1, ?) AS snippet
        FROM (
          SELECT *, fts_main_chunks.match_bm25(chunk_id, ?) AS score
          FROM chunks
        )
        WHERE score IS NOT NULL{clause}
        ORDER BY score DESC, chunk_id ASC
        LIMIT ?
        """,
        [SNIPPET_CHARS, q, *in_params, n],
    ).fetchall()


def _vector_rows(
    connection: duckdb.DuckDBPyConnection, q: str, n: int, allowed: set[str] | None = None
) -> list[tuple[str, str, float, str]]:
    _check_model_matches(connection)
    dim_row = connection.execute("SELECT value FROM meta WHERE key = 'embed_dim'").fetchone()
    dim = int(dim_row[0]) if dim_row else 0
    query_vector = embed_query(q)
    clause, in_params = _in_clause("c.note_id", allowed)
    return connection.execute(
        f"""
        SELECT e.chunk_id, c.note_id,
               1.0 - array_cosine_distance(e.vec, CAST(? AS FLOAT[{dim}])) AS score,
               substr(c.text, 1, ?) AS snippet
        FROM embeddings e
        JOIN chunks c ON c.chunk_id = e.chunk_id
        WHERE 1 = 1{clause}
        ORDER BY array_cosine_distance(e.vec, CAST(? AS FLOAT[{dim}])) ASC, e.chunk_id ASC
        LIMIT ?
        """,
        [query_vector, SNIPPET_CHARS, *in_params, query_vector, n],
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
    connection: duckdb.DuckDBPyConnection,
    q: str,
    k: int,
    weight: float,
    allowed: set[str] | None = None,
) -> list[tuple[str, str, float, str]]:
    pool = max(k * 4, _POOL_FLOOR)
    lexical = _lexical_rows(connection, q, pool, allowed)
    vector = _vector_rows(connection, q, pool, allowed)
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
    filters = _validate_filters(args)
    db_path = index_path(workspace)
    if not db_path.is_file():
        raise OpError("index_missing", f"no index at {db_path}; run index_vault first")
    connection = duckdb.connect(str(db_path), read_only=True)
    try:
        connection.execute("LOAD fts")
        connection.execute("LOAD vss")
        allowed = _allowed_note_ids(connection, filters)
        if allowed is not None and not allowed:
            rows = []
        elif mode == "lexical":
            rows = _lexical_rows(connection, q, k, allowed)
        elif mode == "vector":
            rows = _vector_rows(connection, q, k, allowed)
        else:
            rows = _hybrid_rows(connection, q, k, weight, allowed)
    except duckdb.Error as exc:
        raise OpError("query_failed", f"duckdb: {exc}") from exc
    finally:
        connection.close()
    hits = [
        {"id": chunk_id, "score": float(score), "snippet": snippet, "source_ref": note_id}
        for chunk_id, note_id, score, snippet in rows
    ]
    return {"hits": hits}
