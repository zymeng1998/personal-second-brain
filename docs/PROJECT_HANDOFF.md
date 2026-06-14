# Project Handoff — Personal Second Brain (v0.1)

**Status:** Core v0.1 complete **+ the first real domain app (rental broker, EPIC-DOMAIN-001)**.
This is the operational pilot checkpoint — the system is ready for real-world dogfooding.

This document is the single entry point for **how the system is actually used from a fresh
clone**. It contains no secrets, no real client data, no private URLs, and no secure_ref locators —
all examples use synthetic placeholders. For the conceptual overview see [`../README.md`](../README.md);
for the core-only walkthrough see [`CORE_V0.1_QUICKSTART.md`](CORE_V0.1_QUICKSTART.md); for the broker
specifics see [`../domain-apps/broker/README.md`](../domain-apps/broker/README.md).

---

## 1. What this is

A **local-first, open-format, domain-independent personal second brain**. It captures messy input,
organizes it (PARA + CODE), distills it, projects queryable facts, and generates outputs — over plain
Markdown + YAML frontmatter, an append-only JSON event log, and rebuildable SQLite/DuckDB projections.

Two hard rules shape everything:

- **Memory-layer discipline.** L0 raw is immutable; L1/L2 are interpretation; L3 facts are a
  projection (always carry provenance); L4 indexes are disposable/rebuildable; the event log is
  source of truth.
- **Domain independence (ADR-001).** The core has zero broker concepts. Domain apps live only under
  `domain-apps/` and reach the core only through `packages/interfaces`, under scoped permissions
  enforced at one dispatch boundary. The rental-broker app is the first proof of this.

---

## 2. Prerequisites

| Requirement | Why |
|---|---|
| **Node ≥ 22.5** | The L3 projection store uses the built-in `node:sqlite` driver (experimental; the `ExperimentalWarning` on stderr is expected). |
| **pnpm 9** | Workspace/monorepo package manager (`corepack enable` provides the shim). |
| **uv + Python 3.11** | *Optional* — only the retrieval sidecar (`index` / `query`) needs Python. Everything else works without it. |

The workspace holding real data lives **outside this repo** — never the repo, your home dir, or `/`.

---

## 3. Fresh-clone setup

```bash
git clone <repo> personal-second-brain
cd personal-second-brain

cp .env.example .env                 # set SECOND_BRAIN_WORKSPACE to an absolute path OUTSIDE the repo
corepack enable                      # provides the pnpm 9 shim
pnpm install
export SECOND_BRAIN_WORKSPACE=/absolute/path/to/PersonalSecondBrainWorkspace

pnpm init:workspace                  # create the workspace tree (idempotent; never overwrites data)
pnpm verify:workspace                # read-only structure check
```

> Root scripts (`init:workspace`, `validate:notes`) and every app read `SECOND_BRAIN_WORKSPACE`.
> The CLI apps and `validate:notes` also accept `--workspace <path>` after a `--` separator;
> `init:workspace` is env-var only.

---

## 4. Completed epics

| Epic | What shipped |
|---|---|
| **Phase 1 / 1H** — MVP core + distillation | Capture → L0 raw + append-only event; read-only `note list`/`get`; frontmatter validation; raw-immutability guard; human-confirmed `distill` (L1→L2). |
| **Phase 2** — Projections | `fact-store` (ADD-only + supersede), `entity-graph` (+ manual merge), `task-store` in rebuildable SQLite via `sb rebuild`; drop-`db/`-and-replay reproducibility gate. |
| **Phase 3 (EPIC-CORE-009)** — Retrieval sidecar | Python sidecar (DuckDB FTS+VSS, stdio JSONL), embeddings, hybrid `sb index` / `sb query`; delete-`indexes/`-rebuild lossless gate. |
| **Phase 4 (EPIC-CORE-014)** — AI workflows | Skills-first: `extract-facts`, `braindump`, `review`, `compose-output`; `sb fact` + `sb output create` confirmed-write paths; propose-without-accept writes nothing. |
| **Phase 5 (EPIC-CORE-010)** — Surfaces | `obsidian-helper` + localhost `dashboard`, each a least-privilege `surface:*` identity through the one enforced dispatch; CSRF-guarded dashboard writes. |
| **EPIC-CORE-011** — Security & privacy | `secure_refs` pointer primitive; real permission model (`grantAllows` resolver, first-party grants registry, enforcement at the operations boundary, no env bypass). |
| **EPIC-CORE-012** — Domain-app boundary | Strict fail-closed `config/grants.json` for `domain-app:*` callers; generic `domain-apps/example-readonly/` template. |
| **EPIC-CORE-013** — Media-transcription intake | `apps/media-intake`: transcript **text** → L0 with auditable, non-leaking media-reference provenance; strict `media_id` idempotency; never the media binary. |
| **EPIC-DOMAIN-001** — Broker domain app | First real domain app, built entirely on the core via `domain-app:broker`. v1 = client preference tracking + read-only showing-match summary. No broker code in the core (ADR-001 grep green). |

**Test posture at checkpoint:** root `pnpm test` **340 tests** (exit 0); broker package **19 tests**;
`pnpm run smoke` **PASS**; `pnpm run test:sidecar` **2/2** (real Python sidecar); coverage ~93% lines
(non-blocking, target ≥80%).

---

## 5. Supported workflows (exact commands)

### 5.1 Core capture / read

```bash
# capture → immutable L0 raw note + an append-only capture event
pnpm --filter @sb/cli capture -- --content "espresso ratio is 1:2" --source paste --title "Espresso"
echo "captured via stdin" | pnpm --filter @sb/cli capture -- --source paste

# read back (read-only; never mutates the vault or events)
pnpm --filter @sb/cli note -- list            # id  type  title (sorted by id)
pnpm --filter @sb/cli note -- get <ULID>      # verbatim markdown for one note
pnpm validate:notes                            # frontmatter validation (exit 0 valid / 1 invalid / 2 op)

# distill L1 → L2 (human-confirmed; propose is read-only, accept is the only write)
pnpm --filter @sb/cli distill -- propose
cat proposal.json | pnpm --filter @sb/cli distill -- accept

# build L3 projections (rebuildable from L0–L2 + events)
pnpm --filter @sb/cli rebuild

# retrieval (needs the Python sidecar; capture/read/distill/projection work without it)
pnpm --filter @sb/cli index
pnpm --filter @sb/cli query -- "espresso" --k 5
```

### 5.2 Media-intake (transcript ingest / review)

Ingests a transcript produced by the separate `psb-media-transcriber` as an immutable L0 note. The
transcript **text** is captured; the original media binary never enters the vault. A public pointer is
stored as plain `ref`; a private/signed/token/ambiguous pointer becomes an opaque `secure_ref`.

```bash
# artifact-dir mode: reads <dir>/transcript.md; media_id = the dir name (content hash)
pnpm --filter @sb/media-intake start -- ingest \
  --artifact-dir /path/to/MediaArtifacts/2026/06/<content-hash> \
  --media-ref "https://example.org/lectures/intro.mp4"

# re-ingesting the same media_id + transcript + reference is idempotent (zero writes);
# a changed transcript or reference fails closed as media_id_conflict.

# --review also seeds an L1 working note in 00_Inbox (reuses `note promote`) for the distill flow:
pnpm --filter @sb/media-intake start -- ingest --artifact-dir <dir> --media-ref <url> --review
```

`.srt`/`.vtt` transcripts: `--transcript <file> --media-id <hash>` (normalized to prose, timestamps stripped).

### 5.3 Dashboard (localhost read + capture surface)

```bash
pnpm --filter @sb/dashboard start -- --port 8765
# open http://127.0.0.1:8765/
```

127.0.0.1 only, strict security headers everywhere, no-build static UI. Read views + a capture form +
a confirmation-gated review queue behind the per-start **X-SB-CSRF** same-origin write guard
(cross-site / missing-token POSTs fail with zero writes). `secure_refs` are never surfaced.

### 5.4 Obsidian-helper (companion CLI — never the writer of record)

```bash
pnpm --filter @sb/obsidian-helper start -- check                 # read-only vault compat report
pnpm --filter @sb/obsidian-helper start -- templates install     # body-only, domain-neutral; never overwrites
pnpm --filter @sb/obsidian-helper start -- capture --file <draft.md>   # one L0 + one event; draft byte-untouched
```

### 5.5 Broker — client preference tracking (EPIC-DOMAIN-001)

The broker is a **programmatic domain app** (no standalone CLI binary). Every operation runs as the
fixed `domain-app:broker` identity through the same enforced dispatch as every other caller, using
grants that come **only** from the workspace's `config/grants.json`.

**One-time grant setup** (copy the checked-in synthetic sample into the workspace):

```bash
mkdir -p "$SECOND_BRAIN_WORKSPACE/config"
cp examples/grants/broker.sample.json "$SECOND_BRAIN_WORKSPACE/config/grants.json"
# grants exactly: read:notes, read:facts, read:index, write:capture, write:notes, write:facts
# (write:secure_refs / write:raw / delete:* / read:secure_refs can NEVER be granted)
```

No config ⇒ no grants ⇒ every operation denied (default-deny). The v1 grant is the least-privilege
union the four write steps need; `write:outputs`/`write:secure_refs`/`rebuild` are deliberately absent.

**Usage** (TypeScript, e.g. a small script or `tsx` REPL against the package exports):

```ts
import {
  captureClientNote,        // → immutable L0 (source:"import"), tagged client-intake
  promoteClient,            // → L1 working note in 00_Inbox citing the L0 (reuses note promote)
  buildPreferenceProposal,  // broker vocabulary → an extract-facts proposal envelope
  acceptPreferenceFacts,    // forwards the human-reviewed proposal through the unchanged fact accept
  matchClient,              // read-only: preferences + property notes → ranked match (zero writes)
  renderMatchSummary,
} from "@sb-domain/broker";

const ws = process.env.SECOND_BRAIN_WORKSPACE!;

// 1) capture a pasted client export / manual brief (file or inline text) → L0
const cap = await captureClientNote({ workspace: ws, file: "client-brief.md", title: "Client A brief" });
//   or: await captureClientNote({ workspace: ws, text: "Client B wants a studio near the metro" });

// 2) promote the L0 → an L1 working note that enters the distill/review flow
const l1 = await promoteClient(ws, cap.note_id);

// 3) accept human-reviewed preference facts (budget band, areas, bedrooms, move-in, constraints)
//    Write the broker-built proposal to a file, then accept it through the unchanged fact path:
const proposal = buildPreferenceProposal(/* preferences with source_ref = the L1/L0 id */);
//    (persist `proposal` to proposalPath as JSON)
const accepted = await acceptPreferenceFacts(ws, proposalPath);   // invalid proposal ⇒ zero facts written

// 4) read-only showing-match summary (no write scope; prints a deterministic ranked summary)
const result = await matchClient(ws, "Client A");
console.log(renderMatchSummary(result));
```

Property media is referenced by `media_id` only — the broker is a **consumer** of `apps/media-intake`
and never stores media binaries or writes secure_refs. The preference vocabulary/parser lives only
under `domain-apps/broker/`; the core stores generic L0/L1 notes and generic L3 facts.

The broker's own gate (`pnpm --filter @sb-domain/broker test`) exercises this full round-trip plus the
denial sweeps on synthetic data.

---

## 6. Verify the whole thing

```bash
pnpm test                              # 340 core tests (immutability, replay, security, surface, media gates)
pnpm --filter @sb-domain/broker test   # 19 broker tests (binding + intake round-trip + no-leak + domain-neutral)
pnpm run smoke                         # the core quickstart end-to-end against a throwaway workspace
pnpm run test:coverage                 # ~93% lines (non-blocking; target ≥80%)
pnpm run test:sidecar                  # env-gated TS↔Python real-sidecar E2E (needs uv; SKIPs visibly otherwise)
```

---

## 7. Known limitations / out of scope

- **Cooperative enforcement, not a sandbox.** The permission boundary is test-locked architectural
  discipline (reads work; ungranted writes are denied with zero filesystem writes; hostile configs
  fail closed) — not adversarial isolation. It makes integrations safe-by-construction and reviewable.
- **Retrieval needs Python.** `index` / `query` require the `uv` sidecar; everything else is Node-only.
  Embeddings use `bge-small-en-v1.5` (BGE-M3 is unloadable on the current Intel Mac — see
  `docs/planning/open_questions.md`).
- **Broker is programmatic.** v1 has no standalone CLI binary or dashboard UI — it is invoked through
  its exported functions. No WeChat/Gmail/Calendar integration, no landlord-portal scraping, no
  auto-send, no commission/financial calculation, no rental-application submission.
- **Secrets store is a pointer primitive only.** `secure_refs` records opaque references; it is not an
  encrypted secret container. Locators are never echoed to output/logs.
- **Single-user, local-first.** No multi-user, sync, or hosted deployment.
- **`node:sqlite` is experimental.** The swap point is `openProjectionStore` in `@sb/memory-kernel`
  if its API ever breaks.

---

## 8. Future backlog (named only — NOT implemented)

These are recorded for planning; none are built, and each must be separately refined and approved
under the backlog workflow before any implementation. The core stays domain-neutral regardless.

- **WeChat import** — manual chat-export ingest (drafts stay manual paste; never auto-send).
- **Gmail / Calendar integration** — read-in / scheduling assist.
- **Property inventory** — broker property-note intake as a structured workflow.
- **Manager reports** — generated broker summaries (would need a `write:outputs` grant + L5 path).
- **Dashboard broker UI** — surfacing broker workflows in the localhost dashboard.
- **Viewing-schedule prep** — derive showing schedules from matches.
- **Production packaging** — distributable build / install path.
- **Real encrypted secret store** — replace the `secure_refs` pointer primitive with an encrypted backend.

---

## 9. Resume discipline

`STATUS.md` (root) is the live handoff log and reflects the latest completed work; the durable
checkpoint beneath it is the git history (`git log --oneline`). On resume: read `STATUS.md`, read the
last commits, and re-verify any claim against the filesystem before building on it. The project is
managed JIRA-style — see [`planning/backlog_workflow.md`](planning/backlog_workflow.md): no
implementation starts until a story is `Ready` with acceptance criteria.
