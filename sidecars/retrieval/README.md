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
| `index_vault` | `{workspace}` | `{"notes", "chunks", "built"}` | `invalid_args`, `embed_model_unavailable`, `index_build_failed` |
| `query` | `{workspace, q, k?, mode?, vector_weight?}` | `{"hits": [{id, score, snippet, source_ref}]}` | `invalid_args`, `unsupported_mode`, `index_missing`, `index_model_mismatch`, `query_failed` |
| (any other) | — | — | `unknown_op` |

Error codes so far: `malformed_request`, `unknown_op`, `internal_error`, `invalid_args`,
`unsupported_mode`, `index_missing`, `index_build_failed`, `query_failed`,
`embed_model_unavailable`, `index_model_mismatch`.

`index_vault` scans `vault/**/*.md` read-only, chunks heading-aware (~512 tokens, chunk id
`<note ULID>#<seq>`, `source_ref` = note id), embeds every chunk, and full-rebuilds
`indexes/retrieval.duckdb` (FTS/BM25 + a DuckDB **VSS HNSW** vector index, cosine metric; the file
is deleted + rebuilt — disposable by contract, which is why VSS experimental persistence is
acceptable). `query` modes: `lexical` (BM25), `vector` (cosine), `hybrid` (**default**: candidate
pools from both rankers, min-max normalized, combined `vector_weight`·vec + (1−w)·lex; default
weight 0.7, tunable via `args.vector_weight`). Ordering is score desc with a deterministic id
tie-break. DuckDB's `fts`/`vss` extensions cache in `~/.duckdb` (outside the workspace).

## Embedding model (OQ #9 resolution, 2026-06-10)

Default: **`BAAI/bge-small-en-v1.5` (384-d)** — the pre-approved OQ #9 fallback. **BGE-M3 is not
loadable on this machine**: its HF repo ships only `pytorch_model.bin` (no safetensors),
transformers ≥4.53 requires torch ≥2.6 to load `.bin` weights (CVE-2025-32434), and torch wheels
for macOS x86_64 stop at 2.2.2. Benchmark of the fallback on this Mac (i9-9880H, CPU):
load 0.93 s, **5.93 chunks/s** indexing (32 × ~512-token chunks), **14 ms** median query embed
(`benchmarks/bench_embed.py`). Override via `SB_EMBED_MODEL` (a model switch requires re-running
`index_vault`; mismatches are rejected as `index_model_mismatch`). The model cache is the default
HF cache (`~/.cache/huggingface`) — outside the workspace per OQ #19. Known limitation:
bge-small-en-v1.5 is English-only (BGE-M3 was chosen for multilinguality); revisit if/when the
hardware supports torch ≥2.6 or an ONNX path is added.

## Tests

```sh
uv run pytest
```

Covers: ping/health round-trip, unknown op, malformed lines, `req_id` correlation, stdout
purity under garbage input, stderr-only logging, clean EOF exit.
