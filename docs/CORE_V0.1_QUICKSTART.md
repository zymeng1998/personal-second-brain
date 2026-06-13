# Core v0.1 — Usable Workflow (Quickstart)

The complete core is usable end-to-end **before any domain (broker) logic**. This quickstart is the
dogfood path: every command below is exercised by [`scripts/smoke_core_v0.1.sh`](../scripts/smoke_core_v0.1.sh)
(`pnpm run smoke`) against a throwaway workspace, so it stays reproducible from a clean clone.

All real data lives in a **workspace outside this repo** (`SECOND_BRAIN_WORKSPACE`) — never the repo,
your home dir, or `/`. **Requires Node ≥ 22.5** (`node:sqlite`).

```bash
cp .env.example .env
pnpm install
export SECOND_BRAIN_WORKSPACE=/absolute/path/to/PersonalSecondBrainWorkspace   # outside the repo
```

> Root scripts (`init:workspace`, `validate:notes`) and every app read the workspace from
> `SECOND_BRAIN_WORKSPACE`. The CLI apps and `validate:notes` also accept `--workspace <path>`
> (after a `--` separator, e.g. `pnpm validate:notes -- --workspace /abs/path`); `init:workspace`
> is env-var only.

## 1. Create the workspace (idempotent, non-destructive)

```bash
pnpm init:workspace        # 27 dirs + 5 files; never overwrites existing data
pnpm verify:workspace      # read-only structure check
```

## 2. Capture → L0 raw + an append-only capture event

```bash
pnpm --filter @sb/cli capture -- --content "espresso ratio is 1:2" --source paste --title "Espresso"
echo "captured via stdin" | pnpm --filter @sb/cli capture -- --source paste
```

## 3. Read back (read-only; never mutates vault or events)

```bash
pnpm --filter @sb/cli note -- list           # id  type  title (sorted by id)
pnpm --filter @sb/cli note -- get <ULID>      # verbatim markdown for one note
pnpm validate:notes                            # frontmatter validation (exit 0 valid / 1 invalid / 2 operational)
```

## 4. Media-transcription intake (EPIC-CORE-013)

Ingest a transcript produced by the separate `psb-media-transcriber` as an immutable L0 note. The
**transcript text** is captured; the original media binary never enters the vault. The media
reference is recorded as auditable, non-leaking provenance — a public pointer is stored as plain
`ref`; a private/signed/token/ambiguous pointer becomes an opaque `secure_ref` (use `--media-secref`).

```bash
# artifact-dir mode: reads <dir>/transcript.md; media_id = the dir name (content hash)
pnpm --filter @sb/media-intake start -- ingest \
  --artifact-dir /path/to/PersonalSecondBrainMediaArtifacts/2026/06/54c63db258a34d84 \
  --media-ref "https://example.org/lectures/intro.mp4"

# re-ingesting the same media_id + transcript + reference is idempotent (zero writes);
# a changed transcript or reference fails closed as media_id_conflict.

# --review also seeds an L1 working note in 00_Inbox (reuses `note promote`) so the
# transcript enters the distill/review flow:
pnpm --filter @sb/media-intake start -- ingest --artifact-dir <dir> --media-ref <url> --review
```

`.srt`/`.vtt` transcripts are accepted via `--transcript <file> --media-id <hash>` and normalized to
prose (timestamps stripped) before capture.

## 5. Distill L1 → L2 (human-confirmed)

```bash
pnpm --filter @sb/cli distill -- propose                 # READ-ONLY: lists L1 candidates + scaffold
cat proposal.json | pnpm --filter @sb/cli distill -- accept   # accept is the only writing step
```

## 6. Projections + retrieval (rebuildable from L0–L2 + events)

```bash
pnpm --filter @sb/cli rebuild                            # L3 facts/entities/edges/tasks (SQLite)
pnpm --filter @sb/cli index                              # build the disposable retrieval index (needs the Python sidecar)
pnpm --filter @sb/cli query -- "espresso" --k 5          # READ-ONLY ranked hits
```

> `index` / `query` use the Python retrieval sidecar (`sidecars/retrieval`, `uv`). Without it,
> capture/read/distill/projection still work; retrieval is the only step that needs Python.

## 7. Surfaces (read views over the same enforced boundary)

```bash
# Obsidian companion CLI (never the writer of record): vault compat report, templates, draft capture
pnpm --filter @sb/obsidian-helper start -- check
pnpm --filter @sb/obsidian-helper start -- templates install

# Local dashboard — 127.0.0.1 only, read views + a CSRF-guarded capture form + a review queue
pnpm --filter @sb/dashboard start -- --port 8765
# open http://127.0.0.1:8765/
```

Each surface runs as its own least-privilege identity (`surface:obsidian-helper`,
`surface:dashboard`, `surface:media-intake`) through the **one enforced dispatch** — no surface
bypasses the resolver/enforcer, and `secure_refs` are never surfaced.

## 8. Verify the whole thing

```bash
pnpm test            # 321 tests (immutability, replay, security, surface, media-intake gates)
pnpm run test:coverage   # ~93% lines (non-blocking; target ≥80%)
pnpm run test:sidecar    # env-gated TS↔Python real-sidecar E2E (needs uv; SKIPs visibly otherwise)
pnpm run smoke           # this quickstart, end-to-end, against a throwaway workspace
```

## What's NOT here yet

Domain-specific logic (the broker app, EPIC-DOMAIN-001) is intentionally **deferred** — it will be
built entirely on `packages/interfaces` under scoped permissions, with zero broker concepts in the
core. The generic `domain-apps/example-readonly/` shows the integration pattern.
