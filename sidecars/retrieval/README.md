# sidecars/retrieval (Python) — stdio JSONL retrieval sidecar

The Phase 3 retrieval sidecar: indexes the vault into disposable L4 indexes and answers queries.
Driven by the TS facade (`@sb/retrieval`) over **stdio JSONL**. See
[`docs/architecture/sidecar_contract.md`](../../docs/architecture/sidecar_contract.md) and
[`docs/planning/phase_3_story_map.md`](../../docs/planning/phase_3_story_map.md).

## Boundary (non-negotiable)

- **Reads the vault read-only**; never owns or mutates it; never writes raw (L0).
- Writes go **only** under `<workspace>/indexes/` (L4 — disposable; delete + rebuild is lossless).
- **Never writes events.** The event log is TS-owned; the CLI appends the `indexed` projection event.
- Model caches (when embeddings land, SB-049) live **outside** the workspace (default HF cache).

## Setup (one command)

Requires [uv](https://docs.astral.sh/uv/) (`brew install uv`). uv installs the pinned
Python (≥3.11, see `.python-version`) — no system-Python dependency.

```sh
cd sidecars/retrieval
uv sync
```

## Run

```sh
uv run python -m retrieval_sidecar
```

The process reads one JSON request per stdin line, writes one JSON response per stdout line
(stdout carries envelopes ONLY; logs go to stderr), and exits cleanly on stdin EOF.

Smoke test:

```sh
printf '{"op":"ping","req_id":"r1"}\n' | uv run python -m retrieval_sidecar
# {"req_id":"r1","ok":true,"data":{"pong":true}}
```

## Protocol (mirrors `@sb/interfaces` `retrieval.ts`)

Request: `{"op": string, "req_id": string, "args"?: object}` — `req_id` is echoed verbatim.

Response: `{"req_id", "ok": true, "data": {…}}` or
`{"req_id", "ok": false, "error": {"code", "message"}}`. Errors are always structured —
never an exception across the boundary, never a non-JSON stdout line. A line whose `req_id`
cannot be recovered (malformed JSON, missing `req_id`) is answered with `req_id: ""`.

| op | args | data | errors |
|---|---|---|---|
| `ping` | — | `{"pong": true}` | — |
| `health` | — | `{"version", "python"}` | — |
| `index_vault` | `{workspace}` | `{"notes", "chunks", "built"}` | `invalid_args`, `index_build_failed` |
| `query` | `{workspace, q, k?, mode?}` | `{"hits": [{id, score, snippet, source_ref}]}` | `invalid_args`, `unsupported_mode`, `index_missing`, `query_failed` |
| (any other) | — | — | `unknown_op` |

Error codes so far: `malformed_request`, `unknown_op`, `internal_error`, `invalid_args`,
`unsupported_mode`, `index_missing`, `index_build_failed`, `query_failed`.

`index_vault` scans `vault/**/*.md` read-only, chunks heading-aware (~512 tokens, chunk id
`<note ULID>#<seq>`, `source_ref` = note id), and full-rebuilds the DuckDB FTS index in
`indexes/retrieval.duckdb` (the file is deleted + rebuilt — disposable by contract).
`query` is lexical BM25 (modes `vector`/`hybrid` land with SB-049), ordered score desc with a
deterministic id tie-break. DuckDB's `fts` extension is cached in `~/.duckdb` (outside the
workspace) on first use.

## Tests

```sh
uv run pytest
```

Covers: ping/health round-trip, unknown op, malformed lines, `req_id` correlation, stdout
purity under garbage input, stderr-only logging, clean EOF exit.
