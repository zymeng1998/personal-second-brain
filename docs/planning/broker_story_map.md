# Broker Story Map — First Domain App (EPIC-DOMAIN-001)

Refinement of the EPIC-DOMAIN-001 backlog. The coarse epic-stub **SB-900** ("Broker domain app",
*not planned in detail*) is decomposed here into ≤3-pt atomic stories (per the split rule), built
**entirely** on the completed generic core. Companion to [`story_backlog.md`](story_backlog.md)
(cards) and [`open_questions.md`](open_questions.md) (OQ #41–#47, the decision review). Reuses the
binding pattern proven by [`domain_boundary_story_map.md`](domain_boundary_story_map.md)
(`domain-apps/example-readonly`), the surface/least-privilege model of
[`phase_5_story_map.md`](phase_5_story_map.md), and the media/secure_ref reuse of
[`media_intake_story_map.md`](media_intake_story_map.md).

**Status (2026-06-13): ⏸ REFINED — STOPPED FOR THE OQ #41–#47 DECISION REVIEW.** Refinement only;
no broker code, schemas, data models, or implementation yet. All 6 stories are `Backlog`; SB-089
goes `Ready` only after the human confirms (or amends) OQ #41–#47.

## Objective

Stand up the **first real domain app** — a rental-broker assistant — proving the core's domain
independence by building broker workflows **only** through the enforced dispatch under a fixed
`domain-app:broker` identity, with **zero broker code in the core**. The v1 workflow is **client
preference tracking** (the foundational dataset every later broker workflow reads from): turn a
pasted client chat export / manual client note into an immutable L0 capture → a reviewable L1
working note → structured L3 client-preference facts — entirely via the existing
capture / `note promote` / `fact accept` paths. The read-only **showing-match summary** (read client
preferences + captured property notes → ranked matches to stdout) is the v1 payoff and is
gate-independent.

- **Done when (epic gate):** broker reads/writes the core **only** through scoped contracts and the
  core has **zero** broker code; under its `config/grants.json` grant, broker reads succeed and
  every ungranted / `ALWAYS_DENIED` operation is `scope_denied` with the workspace byte-identical;
  the client-intake round-trip (capture → promote → facts) writes exactly the expected L0 + L1 +
  provenance-carrying facts with L0 immutable; no client PII / contact detail / private locator
  appears in any broker-produced note, event, log, snapshot, output, or stdout; and the ADR-001
  domain-neutrality grep over `packages/` + `schemas/` + generic docs stays clean (no broker
  vocabulary leaked into the core). Automated as SB-094.

## Fixed guardrails (from the refinement authorization — not open questions)

- **No broker concepts in the core.** Nothing broker-specific in `packages/interfaces`,
  `packages/core`, generic schemas, generic surfaces, or generic docs. Broker code, vocabulary,
  parsers, and any broker-only datasets live **only** under `domain-apps/broker/` (ADR-001/006).
- **Build on the completed core only.** Broker adds **no** new core primitives, CLI subcommands,
  note types, or schemas. Every operation composes the existing enforced commands (`capture`,
  `note list/get`, `note promote`, `fact add/accept/list`, `query`, …).
- **One enforced boundary.** Broker invokes the core **only** via the existing enforced dispatch —
  programmatic `main(argv, io, "domain-app:broker")` from `@sb/cli` — never `cli`, never importing
  core packages directly, never a second enforcement path. Mirrors OQ #30.
- **Grants from config only.** Broker grants come from the workspace `config/grants.json` under the
  existing domain-app grant model (`grant_config.schema.json`); broker is **never** added as a
  first-party `surface:*` or `cli` identity. Default-deny; least-privilege; **read-only unless a
  specific approved story requires a write scope**.
- **`ALWAYS_DENIED_SCOPES` stay impossible** (`write:raw`, `delete:*`, `read:secure_refs`) — not
  grantable to `domain-app:broker` through any config.
- **No sensitive data anywhere.** No secrets, client PII, private landlord data, signed URLs,
  secure_ref locators, or raw contact details in tests, fixtures, snapshots, logs, or docs.
  Sensitive external references use the **secure_ref** metadata pattern (opaque, never echoed).
- **Domain storage stays separate from generic core contracts.** The client-preference vocabulary
  and any broker-only lookup data are parsed/stored under `domain-apps/broker/`; the core vault holds
  only generic notes/facts the broker captures through the dispatch.
- **No external integration v1.** No WeChat automation, email sending, scraping, calendar/Gmail
  automation, or external-account integration (OQ #47). Prefer local/imported artifacts first
  (pasted chat exports, manual notes, CSV/JSON fixtures, transcripts/media already supported by core).
- Stories atomic ≤3 pts; one atomic commit per story; refinement docs-only; stop after refinement
  for the OQ approval.

## Open decisions — confirm before SB-089 goes `Ready` (leans)

Full text + leans in [`open_questions.md`](open_questions.md) (OQ #41–#47). Summary:

| # | Question | Lean |
|---|---|---|
| 41 | **First broker MVP workflow** (preference tracking / inventory / match summary / schedule prep / manager report)? | **Client preference tracking** — the foundational dataset every other workflow reads from; maps directly onto the completed capture → promote → fact pipeline; uses local/imported artifacts (pasted chat export / manual note). Delivered **read-only-first** (SB-089 binding, zero writes), then minimal intake. **Showing-match summary** is the read-only payoff (SB-093, deferrable). Inventory / viewing-schedule / manager-report = future stories. |
| 42 | **Structured broker data vs ordinary PSB notes/facts?** | **Layered onto generic core types.** Verbatim source = generic **L0** capture; reviewable note = **L1** via `note promote`; structured client preferences (budget band, target areas, bedrooms, move-in window, hard constraints) = generic **L3 facts** with broker-meaningful predicates + provenance. The preference vocabulary/parser and any broker-only datasets (property inventory, area normalization) live **only** under `domain-apps/broker/` — never a core note type or schema. |
| 43 | **CLI-only, dashboard extension, or separate domain app CLI?** | **Separate domain-app CLI** under `domain-apps/broker/`, identity `domain-app:broker`, invoked via `main(argv, io, caller)` — mirrors `example-readonly` / `apps/media-intake`. **Not** folded into core `sb`; **not** a dashboard extension v1 (a broker dashboard view is a later story). |
| 44 | **What write actions, if any, in v1?** | **Read-only binding first** (`read:notes`, `read:facts`); intake then adds, least-privilege per story: `write:capture` → `write:notes` (promote) → `write:facts` + `read:index` (dedup/match). Cumulative v1 grant = `[read:notes, read:facts, read:index, write:capture, write:notes, write:facts]`. **Not** v1: `write:outputs` (deferred to a saved-summary story), `write:secure_refs` (broker is a media-intake *consumer*, OQ #46), `write:distill`, `rebuild:projections`, `write:index`, `append:events`. `ALWAYS_DENIED` impossible. |
| 45 | **How is PII/private client data redacted/represented in tests?** | **Synthetic-only fixtures** — fictional clients ("Client A"), placeholder areas/budgets, sentinel contact handles (e.g. `wechat:REDACTED_SENTINEL`); no real names, numbers, addresses, or WeChat IDs. Where a test proves a private locator does not leak, it reuses the **secure_ref sentinel pattern** (SB-074/087): a known sentinel string lives only inside a secure_ref pointer and is asserted absent from every broker-produced note/event/log/snapshot/output/stdout. Real client PII is never committed. |
| 46 | **How does property media/video reuse media-intake + secure_ref?** | **Broker is a pure consumer.** Property tour videos/photos go through the **existing** `apps/media-intake` (`surface:media-intake`) → transcript L0 + `media_id` + public `ref` or private `secref` handle. Broker (later story) **references** that `media_id`/handle when it reads the resulting note via `read:notes`; broker never stores media binaries, never creates secure_refs in v1, never echoes private locators. |
| 47 | **What is explicitly OUT of scope for this first refinement?** | WeChat live sync / auto-send (drafts stay manual paste-export; broker may *draft* text for a human to send, never send), Gmail/Calendar automation (the env calendar MCP is not used), landlord-portal scraping, external-account integration, auto-send messages, commission/financial calculation, rental-application submission, a broker note type/schema in the core, and dashboard broker views — all OUT. Some are recorded as named future stories. |

## Architecture (proposed — confirm via OQ)

```
LOCAL / IMPORTED ARTIFACTS (preferred first — never scraped, never auto-fetched)
  pasted client chat export (.md/.txt) | manual client note | CSV/JSON fixtures
  property media → handled by EXISTING apps/media-intake (broker only references media_id)
        │  transcript / note TEXT only — synthetic in tests; real client data only in real workspaces
        ▼
domain-apps/broker   caller: domain-app:broker        config/grants.json (workspace, fail-closed):
  client capture --file <export.md>                      { "app": "domain-app:broker",
  client promote <L0-id>                                   "allow": [read:notes, read:facts,
  client facts  --file <proposal.json>                                read:index, write:capture,
  match <client-id>            (read-only, stdout)                     write:notes, write:facts] }
        │                                                              (SB-089 binding grants only
        │  broker owns the preference vocabulary/parser                read:notes + read:facts)
        │  under domain-apps/broker/ (NEVER a core type)                       │
        ▼                                                                      ▼
   main(argv, io, "domain-app:broker") ───────────────► resolveGrant / grantAllows / enforceScope
        │                                                  (the ONE enforced dispatch — no bypass)
        ▼
   capture → L0 raw (verbatim; source:"import")
   note promote → L1 working note in 00_Inbox (cites L0)
   fact accept --file → L3 client-preference facts (provenance: source_ref + observed_at + confidence)
        │
        ▼
   match: read facts + property notes (read:notes/facts/index, query) → ranked summary to STDOUT
          (zero writes; saving as an L5 output is a deferred write story)
```

- Sub-phase **6A** = read-only binding (SB-089); **6B** = client-preference intake — capture
  (SB-090), promote (SB-091), facts (SB-092); **6C** = read-only showing-match summary (SB-093,
  deferrable); **6D** = epic gate (SB-094).
- `domain-apps/broker/` becomes a pnpm workspace package mirroring `domain-apps/example-readonly`
  and `apps/media-intake`; its tests run in root `pnpm test`, Node-only. The current docs-only
  placeholder README is retained and pointed at this map.

## Stories (all ≤3 pts; 14 pts total — SB-900 decomposed)

- **SB-089** (2, P3) — **broker boundary + read-only binding.** Turn `domain-apps/broker/` into a real
  pnpm package mirroring `example-readonly`: `src/index.ts` with fixed `domain-app:broker` identity
  (validated vs `DOMAIN_APP_ID_PATTERN`), invocation **only** via `main(argv, io, caller)`; checked-in
  sample `config/grants.json` granting **`[read:notes, read:facts]`**; README documents the binding,
  the cooperative-enforcement honesty note, and the **synthetic-data policy**. Smoke test: reads
  succeed under the sample config; **every** write form ⇒ `scope_denied`, workspace byte-identical;
  ADR-001 domain-neutrality grep over CORE sources stays clean. **No broker workflow logic yet.**
  Mirrors SB-061.
- **SB-090** (3, P3) — **client-preference capture** (`write:capture`). `client capture --file <export.md>`
  (or `--text`): read a pasted client chat export / manual note **read-only** (extension allowlist,
  size cap, path-safety; synthetic-only fixtures) → route through the enforced `capture` op as
  `domain-app:broker` → **L0 raw** (`source:"import"`), generically tagged (no new note type). Grant
  += `write:capture`. Exactly one L0 + one capture event; denial without the grant; no contact-detail
  leak in output. Mirrors media-intake SB-085 shape (no idempotency ledger required v1; note the
  re-capture behavior).
- **SB-091** (2, P3) — **client working note via promote** (`write:notes`). `client promote <L0-id>`
  reuses the enforced **`note promote`** → an L1 working note in `00_Inbox` citing the L0 client
  capture; provenance L1 → L0 asserted; L0 byte-unchanged. Grant += `write:notes`. **No new writer
  path.** Mirrors media-intake SB-086.
- **SB-092** (3, P3) — **client-preference facts** (`write:facts` + `read:index`). Build a
  `fact accept --file` proposal (the existing `proposal.schema.json` envelope) from a client note:
  structured preference facts (budget band, target areas, bedrooms, move-in window, hard constraints)
  with provenance (`source_ref` = the L1/L0 id, `observed_at`, `confidence`). The preference vocabulary
  + proposal builder live **under `domain-apps/broker/`**; the core stores generic facts via the
  **unchanged** whole-file-validated `fact accept` path (invalid proposal ⇒ nothing written). Grant
  += `write:facts`, `read:index` (dedup/read-back via `fact list` / `query`). Synthetic data only.
  Mirrors the Phase 4 `extract-facts` confirmed-write pattern.
- **SB-093** (2, P3, **deferrable**) — **showing-match summary** (read-only; gate-independent).
  `match <client-id>` reads the client-preference facts + any captured property notes/facts
  (`read:notes` / `read:facts` / `read:index` / `query`) and prints a **ranked match summary to
  stdout** — **zero writes** (no new write scope). Property media is referenced by `media_id` only
  (consumer of media-intake, OQ #46). Saving the summary as an L5 output is a separate future write
  story (`write:outputs`).
- **SB-094** (2, P3) — **broker epic gate** (EPIC-DOMAIN-001 "Done when"). Automated, Node-only, in
  root `pnpm test`: (a) **binding holds** — broker reads succeed under its config grant, every
  ungranted / `ALWAYS_DENIED` form ⇒ `scope_denied`, workspace byte-identical for read-only ops;
  (b) **intake round-trip** — capture → promote → facts writes exactly the expected L0 + L1 + facts
  with provenance, L0 immutable; (c) **no PII / no private-locator leak** — a synthetic sentinel
  contact handle + a secure_ref sentinel appear in **no** broker-produced note/event/log/snapshot/
  output/stdout; (d) **CORE stays domain-neutral** — ADR-001 grep over `packages/` + `schemas/` +
  generic docs finds no broker vocabulary; (e) SB-074 / SB-077 / SB-084 / SB-087 invariants
  re-asserted for `domain-app:broker` (denied outside its grant; `read:secure_refs` / `write:raw` /
  `delete:*` unobtainable; secure_ref locator never echoed).

### Dependency graph
```
SB-089 ─ SB-090 ─ SB-091 ─ SB-092 ─ SB-094 (gate; needs SB-089..092)
                              └────── SB-093 (deferrable; read-only; gate-independent)
```
Recommended order: **SB-089 → SB-090 → SB-091 → SB-092 → SB-094 (→ SB-093 optional, any time after SB-092).**

## Out of scope

- **External integration / automation (OQ #47):** WeChat live sync or auto-send (drafts stay manual
  paste-export; broker may draft text for a human to send, never send); Gmail / Calendar automation
  (the environment calendar MCP is not used by broker v1); landlord-portal scraping; external-account
  integration; auto-fetching signed URLs.
- **Any broker concept in the core:** a broker note type, broker schema, broker CLI subcommand in
  `sb`, or broker vocabulary in `packages/` / generic schemas / generic surfaces / generic docs.
- **Property inventory as a core concept:** a broker-owned local dataset only; not a core note type.
  Property-inventory intake is a named future story.
- **Media handling in broker:** broker stores no media binaries and creates no secure_refs in v1 —
  property media reuses the existing `apps/media-intake` surface; broker only references `media_id`.
- **Saved/composed outputs in v1:** the showing-match summary is stdout-only; an L5 output
  (`write:outputs`) is a deferred write story. Manager report, viewing-schedule prep, commission /
  financial calculation, and rental-application submission are future stories.
- **Dashboard broker views:** a later story; v1 is a separate domain-app CLI only.
- **Real client data in the repo:** fixtures/tests are synthetic-only (OQ #45); real client PII
  lives only in real workspaces, never committed.
