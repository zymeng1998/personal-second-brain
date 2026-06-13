# Open Questions

To resolve before / during the noted phase. Tracked here so they don't block scaffolding.

## Must decide before Phase 1

| # | Question | Options / lean |
|---|---|---|
| 1 | Frontmatter schema v1 fields per note type (raw/working/distilled/entity/project/concept/case/daily) | **RESOLVED (SB-008):** `frontmatter.schema.json` v1. Common required `id,type,layer,created`; each type pins its layer + required fields (raw=L0 no `updated`; working=L1 needs `source_ref`; distilled/entity/concept/case=L2 need `title`; project=L1/L2; daily=L1; output=L5 needs `title`+non-empty `sources`). Validated by 9 example notes under `examples/notes/`. |
| 2 | Event schema v1 fields (`capture`/`memory`/`projection`) | **RESOLVED (SB-009):** `event.schema.json` v1. Common envelope required `event_id(ULID),stream,kind,occurred_at,actor`; optional `recorded_at,subject_id,source_ref,schema_version,payload`. `actor` pattern `human\|cli\|skill:<name>\|sidecar:<name>`. Per-stream kinds via allOf: capture→`captured` (subject_id req); memory→`note_created/note_updated/fact_added/fact_superseded/entity_merged/distillation_accepted` (subject_id req); projection→`indexed/projection_rebuilt/projection_reset`. APPEND-ONLY documented in schema; corrections are new events. Validated by `examples/captures/events.sample.jsonl`. |
| 3 | Note id scheme | **RESOLVED (SB-008):** **ULID** is the canonical immutable `id` for all notes (and events/captures/facts/entities/tasks/outputs). Pattern `^[0-7][0-9A-HJKMNP-TV-Z]{25}$`. Filename convention `<ULID>--<optional-slug>.md`; slugs may change, the `id` never does. ULID is not the retrieval mechanism — retrieval uses metadata/title/tags/links/entities + FTS/vector/graph/temporal indexes. |
| 4 | Workspace creation | **RESOLVED (SB-001..007):** `scripts/init_workspace.ts` creates the tree (27 dirs + 5 files) idempotently and non-destructively at `$SECOND_BRAIN_WORKSPACE` (or `--workspace`), with `--dry-run` + read-only `--verify`. **No template seeding** in Phase 1 (raw notes are written by `capture`; templates can be a later story). |
| 5 | Repo visibility | Private recommended (data sensitivity), even though core code is non-sensitive |

## Decide during Phase 2 (projections)

| # | Question | Lean |
|---|---|---|
| 6 | Fact model detail (confidence scale, supersede semantics) | mem0-style ADD-only; numeric confidence 0–1 |
| 7 | Entity identity/merge rules | Manual-confirm merges; never auto-merge |
| 8 | Replay determinism guarantees | Pure function of L0–L2 + events |

## Decide during Phase 3 (retrieval)

**All eight RESOLVED (2026-06-10): human approved every decision exactly as leaned** at the Phase 3
refinement review. Recorded here; full context in [`phase_3_story_map.md`](phase_3_story_map.md).

| # | Question | Decision (2026-06-10) |
|---|---|---|
| 9 | Embedding model | **RESOLVED — fallback adopted (SB-049, 2026-06-10):** `bge-small-en-v1.5` (384-d). BGE-M3 is **unloadable** on this machine, not merely slow: its HF repo ships only `pytorch_model.bin`, transformers requires torch ≥2.6 for `.bin` loads (CVE-2025-32434), and torch on macOS x86_64 caps at 2.2.2. Fallback benchmark (i9-9880H CPU, `benchmarks/bench_embed.py`): 5.93 chunks/s indexing, 14 ms median query embed. Override via `SB_EMBED_MODEL`; known limitation: English-only (revisit on torch ≥2.6-capable hardware or via ONNX). |
| 10 | Index store | **RESOLVED:** DuckDB for both FTS and vector (VSS/HNSW) — one engine, one disposable file. |
| 11 | stdio JSONL vs local HTTP | **RESOLVED:** stdio JSONL; local HTTP only if warm-model latency later forces it. |
| 12 | Embed mem0/ReMe as a Python dep, or reference only? | **RESOLVED:** reference only — no dependency. |
| 17 | Python toolchain (machine had only system Python 3.9.6) | **RESOLVED:** **uv** with a pinned Python ≥3.11 in `sidecars/retrieval/` (`pyproject.toml` + `uv.lock`; uv installs the interpreter — no system-Python dependency). |
| 18 | Test policy for Python-dependent tests | **RESOLVED:** root `pnpm test` stays Node-only deterministic; sidecar = `pytest`; TS↔Python integration behind an env-gated `test:sidecar` target (visible SKIP when env absent). |
| 19 | Index artifact layout | **RESOLVED:** single `indexes/retrieval.duckdb` (FTS + vector + later graph/temporal tables, one disposable file); existing `indexes/*` subdirs reserved for aux artifacts; model cache outside the workspace. |
| 20 | Chunking | **RESOLVED:** ~512-token heading-aware chunks; chunk id `<note ULID>#<seq>`; every chunk carries `source_ref` = note id. |

## Decide before Phase 4 implementation (AI workflows)

Raised at the 2026-06-10 Phase 4 refinement ([`phase_4_story_map.md`](phase_4_story_map.md)).
**ALL FIVE RESOLVED (2026-06-10): human approved every decision exactly as leaned** ("all five
positions are approved"), including the OQ #21 roadmap deviation (skills-first; `sidecars/ai`
stays boundary-docs until a batch/non-interactive need appears).

| # | Question | Decision (2026-06-10, approved as leaned) |
|---|---|---|
| 21 | **AI engine:** Claude-Code skills (agent drafts; CLI validates + writes) vs implementing `sidecars/ai` (local LLM / API) now | **Skills-first**; `sidecars/ai` stays boundary-docs until a batch/non-interactive workflow needs it. **Deviates from the roadmap's `sidecars/ai` wording — needs explicit approval.** |
| 22 | Proposal artifact format for accept steps | Shared versioned `schemas/json/proposal.schema.json` envelope (`workflow`/`version`/`proposed_at`/`items[]`) with per-workflow item payloads; accept commands validate against it (mirrors `distill accept --file`). |
| 23 | Duplicate facts on re-extraction | No auto-dedupe; the extract-facts skill surfaces near-duplicates (`sb fact list` + `sb query`) in the proposal; human picks add / supersede / skip per item. |
| 24 | L5 `sources` validation depth | `sb output create` resolves note-id sources via `getNote` (missing ⇒ fail, nothing written); non-note ULIDs (fact ids) accepted as-is; schema already enforces non-empty. |
| 25 | Review-skill scope v1 | Deterministic candidate queries only (inbox working notes older than N days; never-promoted raws; stale-`status` tasks); heuristics live in the skill; no new CLI surface. |

## Decide before EPIC-CORE-011 implementation (security hardening)

Raised at the 2026-06-10 security refinement ([`security_story_map.md`](security_story_map.md)).
**ALL THREE RESOLVED (2026-06-10): human approved exactly as leaned**, with explicit guardrails:
secure_ref is a reference primitive, never a secret container; raw secrets appear nowhere
(notes/events/tests/fixtures/logs/errors); the CLI goes through the SAME grant resolver as every
other caller; **no env/test/dev bypass of enforcement is allowed**; audit evidence must not leak
secret values.

| # | Question | Decision (2026-06-10, approved as leaned) |
|---|---|---|
| 26 | Grant declaration/loading | **RESOLVED:** static in-code registry for first-party callers this phase; workspace `config/grants.json` reserved for domain apps (EPIC-CORE-012), not built yet. |
| 27 | Enforcement default | **RESOLVED:** enforce for ALL callers at the operations boundary; `cli` may hold every scope except `ALWAYS_DENIED_SCOPES` but goes through the same resolver; **no env bypass**. (Refines OQ #13.) |
| 28 | secure_ref validation home | **RESOLVED:** `schemas/markdown/secure_ref.schema.json`; validated by `validate_notes.ts` as a separate pass (secure_refs lives outside `vault/`); pointer files must have no body. |

## Decide before EPIC-CORE-012 implementation (domain app boundary)

Filed 2026-06-11 during the EPIC-CORE-012 refinement (SB-060/075/076/061/077 — see
[`domain_boundary_story_map.md`](domain_boundary_story_map.md)).
**ALL THREE RESOLVED (2026-06-11): human approved exactly as leaned**, with one additional
guardrail: **duplicate `domain-app:*` entries in `config/grants.json` fail closed** (whole-file
rejection — never merge, never last-write-wins). Epic-wide guardrails fixed by the authorization:
external grants default-deny; `ALWAYS_DENIED_SCOPES` ungrantable even through config; config never
overrides/shadows/mutates the first-party registry; fail closed on unknown caller / unknown scope /
malformed config / duplicate app entry / reserved caller identity / privileged-scope attempts;
read-only generic example app; same resolver/enforcer path for all CLI ops; one atomic commit per
story; SB-074 re-run inside SB-077.

| # | Question | Decision (2026-06-11, approved as leaned) |
|---|---|---|
| 29 | Grant config validation mechanism | **RESOLVED:** `grant_config.schema.json` is the published contract; runtime validation is a strict dependency-free TS validator in `@sb/interfaces` (zero runtime deps preserved). Ajv stays test-only: a lock-step test proves schema/runtime verdict parity on shared fixtures. |
| 30 | Domain-app invocation boundary | **RESOLVED:** domain apps invoke core operations only through the existing enforced CLI dispatch — programmatic `main(argv, io, caller)` with a fixed `domain-app:<name>` identity; config consulted only for non-first-party callers; **no second enforcing facade**. Cooperative-enforcement honesty note documented. (Refines OQ #13/#14.) |
| 31 | Config rejection semantics + caller namespace | **RESOLVED:** fail-closed **whole-file rejection** as `grant_config_invalid` for ANY invalid content (unknown scope, privileged scope, reserved app id, schema violation, **duplicate app entry**); missing file = valid empty config (default-deny); only `^domain-app:[a-z0-9][a-z0-9-]*$` apps representable. |

## Decide before Phase 5 implementation (Surfaces, EPIC-CORE-010)

Filed 2026-06-11 during the Phase 5 refinement (SB-078..084 — see
[`phase_5_story_map.md`](phase_5_story_map.md)).
**ALL FOUR RESOLVED (2026-06-11): human approved exactly as leaned, with ONE AMENDMENT — the
no-auth-v1 dashboard requires a same-origin write guard on EVERY mutating endpoint:** a
server-issued nonce delivered to the dashboard page and echoed back as `X-SB-CSRF`; cross-site or
missing-token POSTs fail with ZERO filesystem writes (applies to `POST /api/capture` and any later
review-queue accept endpoint). Epic-wide guardrails fixed by the authorization: surfaces never
bypass the resolver/enforcer; least-privilege `surface:*` grants only; `127.0.0.1` binding only;
security headers on every response; secure_refs locators/sentinels never in helper output,
dashboard JSON/HTML, logs, tests, snapshots, or errors; templates domain-neutral + never
overwrite; capture = exactly one L0 note + one capture event (draft byte-untouched for the
bridge); review queue explicit-confirmation over unchanged accept paths; no broker leakage; one
atomic commit per story; SB-074 + SB-077 re-run inside SB-084.

| # | Question | Decision (2026-06-11, approved as leaned + CSRF amendment) |
|---|---|---|
| 32 | **Surface caller identity** — run as `cli`, config grants, or first-party registry entries? | **First-party in-code registry entries** (these apps are first-party, in-repo — OQ #26's registry is exactly for them): `surface:obsidian-helper` = `write:capture`+`read:notes`; `surface:dashboard` = `read:notes`+`read:facts`+`read:index`+`write:capture` (SB-083 later adds `write:distill`+`write:facts`). Same resolver as everyone; invocation = programmatic `main(argv, io, "surface:…")` (one boundary, mirrors OQ #30); config grants stay reserved for external `domain-app:*` callers. |
| 33 | **Dashboard runtime shape** — framework/bundler vs zero-dep? | **Zero-runtime-dependency `node:http` server**, bound `127.0.0.1` only; no-build static UI (plain HTML/CSS/ES modules); strict headers (CSP `default-src 'self'`, nosniff, frame DENY); structured JSON error envelopes; no auth in v1 (local single-user — binding is the boundary, documented). Tests = `node:test` HTTP round-trips; root `pnpm test` stays browser-free. |
| 34 | **Obsidian helper shape** — real plugin vs companion CLI? | **No plugin this phase** (ADR-003: plugins stay optional; headless-testable). `apps/obsidian-helper` companion CLI: `check` (read-only compat report: frontmatter validity, dangling wikilinks, folder layout), `templates install` (domain-neutral, `vault/90_System/`, never overwrites), `capture --file <draft.md>` (draft → enforced capture op, L0 + event, draft byte-untouched). Obsidian remains never-the-writer-of-record. |
| 35 | **Dashboard v1 write surface** — which writes, gated how? | **Capture only** (SB-082) for the roadmap gate; the review queue (SB-083, deferrable) is a confirmation-gated front over the UNCHANGED Phase 4 accept paths: read-only candidates + paste/upload of a human-reviewed proposal JSON passed verbatim into whole-file-validated `distill accept`/`fact accept` (invalid ⇒ nothing written). Explicit button-press = the confirmation; no server-side proposal generation/editing; no auto-accept; no AI in surfaces. |

## Decide before EPIC-CORE-013 implementation (Media Transcription Intake)

Filed 2026-06-12 during the EPIC-CORE-013 refinement (SB-070/071/072 + SB-085/086/087, deferrable
SB-088 — see [`media_intake_story_map.md`](media_intake_story_map.md)).
**ALL FIVE RESOLVED (2026-06-12): human approved exactly as leaned, with TWO AMENDMENTS:**
**(A) Strict idempotency** — re-ingesting the same `media_id` with the same transcript hash AND the
same media reference is idempotent (no-op, reports the existing note); re-ingesting the same
`media_id` with a different transcript content/hash OR a different media reference **fails closed as
`media_id_conflict` with ZERO writes**. **(B) Auditable-but-non-leaking classification** — store
only non-sensitive classification metadata (`public_ref`, `signed_url_detected`, `token_detected`,
`local_private_path`, `ambiguous_default_private`); **never** store or echo the raw private
URL/path/locator in notes, events, logs, snapshots, fixtures, HTTP responses, CLI output, or errors.
Epic-wide guardrails: core never stores media binaries (transcript text + references only); private
media pointers use secure_ref (opaque, never echoed; `read:secure_refs` hard-denied); intake reuses
the enforced dispatch under `surface:media-intake` (never `cli`, no resolver/enforcer bypass);
least-privilege grant (capture, read/promote notes, write secure_ref metadata); `media_id`
deterministic from the artifact-dir name unless overridden, strictly validated; v1 does NOT parse
`source-metadata.json`/`manifest.json` (pointer via explicit flag); L1 reuses `note promote` (no
new writer path); domain-neutral; one atomic commit per story; SB-074/077/084 re-run inside SB-087.

| # | Question | Decision (2026-06-12, approved as leaned + amendments A/B) |
|---|---|---|
| 36 | Minimal transcript input format for v1 | **RESOLVED:** `.txt` + `.md` captured verbatim (the transcriber's prose `transcript.md` is the canonical input). `.srt`/`.vtt` → prose normalization is the deferrable, gate-independent **SB-088** (after the gate path if still small; timestamps NOT kept in the note body unless explicitly documented as non-sensitive metadata). |
| 37 | Transcripts only, or also pre-register media? | **RESOLVED:** transcripts only; the media reference is recorded **with** the transcript at ingest, never standalone. No media-only pre-registration. |
| 38 | L0 only, or also a distillation/review path? | **RESOLVED:** L0 verbatim + a thin L1 bridge that **reuses `note promote`** (no new note writer path, no new distillation logic); the transcript enters the existing capture → distill / review flow. |
| 39 | Media reference: plain `ref` vs `secure_ref`? | **RESOLVED:** both, sensitivity-classified. Signed URLs, token-bearing URLs, private paths, keychain-style locators, and **ambiguous pointers (private-by-default)** become opaque `secure_ref`s; only non-sensitive pointers use plain `ref`. Per amendment B, only the classification (`public_ref`/`signed_url_detected`/`token_detected`/`local_private_path`/`ambiguous_default_private`) is stored — never the raw locator. |
| 40 | Which surface exposes v1 first? | **RESOLVED:** a dedicated optional `apps/media-intake` CLI adapter, identity `surface:media-intake` — not the core `sb` CLI, not dashboard/Obsidian yet. |

## Decide before EPIC-DOMAIN-001 implementation (Broker Domain App)

Filed 2026-06-13 during the EPIC-DOMAIN-001 refinement (SB-089..094, deferrable SB-093 — see
[`broker_story_map.md`](broker_story_map.md)). **⏸ AWAITING THE DECISION REVIEW — leans recorded;
human confirms (or amends) → SB-089 goes `Ready`.** Epic-wide guardrails fixed by the refinement
authorization (not open questions): no broker concepts in `packages/interfaces`, `packages/core`,
generic schemas, generic surfaces, or generic docs; broker code lives only under
`domain-apps/broker/`; broker invokes the core only via the enforced dispatch
(`main(argv, io, "domain-app:broker")`) — never `cli`/`surface:*`, never a second enforcement path;
grants come only from the workspace `config/grants.json` under the existing domain-app grant model;
least-privilege, read-only unless a specific story requires a write; `ALWAYS_DENIED_SCOPES`
(`write:raw`, `delete:*`, `read:secure_refs`) ungrantable; no secrets / client PII / private
landlord data / signed URLs / secure_ref locators / raw contact details in tests, fixtures,
snapshots, logs, or docs; sensitive references use the secure_ref pattern; domain-specific
parsing/storage stays separate from generic core contracts; no WeChat/email/scraping/external
integration v1; prefer local/imported artifacts first; one atomic commit per story; refinement
docs-only; SB-074/077/084/087 re-run inside SB-094.

| # | Question | Lean (2026-06-13) |
|---|---|---|
| 41 | First broker MVP workflow — preference tracking / property inventory / showing-match summary / viewing-schedule prep / manager report? | **Client preference tracking** — the foundational dataset every later broker workflow reads from; maps directly onto the completed capture → promote → fact pipeline; uses local/imported artifacts (pasted chat export / manual note). Delivered **read-only-first** (SB-089 binding, zero writes), then minimal intake (SB-090/091/092). **Showing-match summary** is the read-only payoff (SB-093, deferrable). Property inventory, viewing-schedule prep, and manager report = named future stories. |
| 42 | Structured broker-domain data vs ordinary PSB notes/facts? | **Layered onto generic core types.** Verbatim source = generic **L0** capture; reviewable note = **L1** via `note promote`; structured client preferences (budget band, target areas, bedrooms, move-in window, hard constraints) = generic **L3 facts** with broker-meaningful predicates + provenance. The preference vocabulary/parser and any broker-only datasets (property inventory, area normalization) live **only** under `domain-apps/broker/` — never a core note type or schema. |
| 43 | Broker v1 surface — CLI-only (core `sb`), dashboard extension, or separate domain app CLI? | **Separate domain-app CLI** under `domain-apps/broker/`, identity `domain-app:broker`, invoked via `main(argv, io, caller)` — mirrors `example-readonly` / `apps/media-intake`. **Not** folded into core `sb` (that would put broker in the core); **not** a dashboard extension v1 (a broker dashboard view is a later story). |
| 44 | What write actions, if any, are needed in v1? | **Read-only binding first** (`read:notes`, `read:facts`); intake then adds, least-privilege per story: `write:capture` → `write:notes` (promote) → `write:facts` + `read:index` (dedup/match read-back). Cumulative v1 grant = `[read:notes, read:facts, read:index, write:capture, write:notes, write:facts]`. **Not** v1: `write:outputs` (deferred saved-summary story), `write:secure_refs` (broker is a media-intake *consumer*, OQ #46), `write:distill`, `rebuild:projections`, `write:index`, `append:events`. `ALWAYS_DENIED` impossible. |
| 45 | How will PII / private client data be redacted or represented in tests? | **Synthetic-only fixtures** — fictional clients ("Client A"), placeholder areas/budgets, sentinel contact handles (e.g. `wechat:REDACTED_SENTINEL`); no real names, numbers, addresses, or WeChat IDs. Where a test proves a private locator does not leak, it reuses the **secure_ref sentinel pattern** (SB-074/087): a known sentinel lives only inside a secure_ref pointer and is asserted absent from every broker-produced note/event/log/snapshot/output/stdout. Real client PII is never committed. |
| 46 | How should property media/videos reuse the completed media-intake + secure_ref patterns? | **Broker is a pure consumer.** Property tour videos/photos go through the **existing** `apps/media-intake` (`surface:media-intake`) → transcript L0 + `media_id` + public `ref` or private `secref` handle. Broker (later story) **references** that `media_id`/handle when it reads the resulting note via `read:notes`; broker never stores media binaries, never creates secure_refs in v1, never echoes private locators. |
| 47 | What remains explicitly out of scope (WeChat live sync, Gmail/Calendar automation, landlord portal scraping, auto-send)? | **All OUT of the first refinement:** WeChat live sync / auto-send (drafts stay manual paste-export; broker may *draft* text for a human to send, never send), Gmail / Calendar automation (the environment calendar MCP is unused), landlord-portal scraping, external-account integration, auto-send messages, commission / financial calculation, rental-application submission, a broker note type/schema in the core, and dashboard broker views. Some are recorded as named future stories. |

## Decide later

| # | Question | Lean |
|---|---|---|
| 13 | Permission-scope enforcement mechanism | Capability tokens checked at the `interfaces` boundary |
| 14 | Interface smoke test before broker | Generic `domain-apps/example-readonly/`, never broker |
| 15 | MCP adapter timing | Only after `interfaces` stabilizes; never in Phase 0/1 |
| 16 | Sync mechanism | Git for text; iCloud/Syncthing optional; user choice |

## Tech debt (tracked)

- ~~**ULID generation is currently duplicated.**~~ **RESOLVED (SB-034, 2026-06-05):** centralized in
  `@sb/interfaces` (`ulid()` in `src/ulid.ts`, exported from the package index); `apps/cli/src/ulid.ts`
  removed and its consumers now import `ulid` from `@sb/interfaces`. Output is byte-identical (same standard
  ULID encoding); `isUlid()` still accepts every produced value.

## Answered (recorded in ADRs)

- Build vs fork → **combine** (ADR-007 + evaluation).
- Stack → **hybrid contracts-first** (ADR-007).
- Obsidian → **optional surface** (ADR-003).
- Domain independence → **enforced** (ADR-001, ADR-006).
- Local-first/open-format → **yes** (ADR-002).
- Layered memory → **yes** (ADR-004).
- Retrieval-aware organization → **yes** (ADR-005).
