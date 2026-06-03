# Repository & Workspace Structure

Authoritative reference for the core repo tree and the external data workspace.

## Core repository (`personal-second-brain/`) — committed

```text
personal-second-brain/
  README.md  package.json  pnpm-workspace.yaml  .gitignore  .env.example
  AGENTS.md  CLAUDE.md  STATUS.md

  docs/
    product/        prd_v0.2.md
    research/       open_source_second_brain_evaluation.md
    architecture/   system_architecture.md  local_first_strategy.md
                    obsidian_compatibility.md  memory_layers.md
                    retrieval_strategy.md  interface_contracts.md
                    storage_strategy.md  privacy_and_security.md  sidecar_contract.md
    methodology/    basb_code_mapping.md  para_mapping.md  glossary.md
    workflows/      capture_to_distill.md
    decisions/      adr_001 … adr_007
    planning/       implementation_roadmap.md  mvp_scope.md  open_questions.md  repo_structure.md
    prompts/        (reserved)

  apps/             cli/ (MVP)  dashboard/  obsidian-helper/        # READMEs only in Phase 0
  packages/         memory-kernel/ note-vault/ event-log/ entity-graph/
                    fact-store/ task-store/ retrieval/ interfaces/
                    adapters/ surfaces/ ai/                          # READMEs only in Phase 0
  sidecars/         retrieval/ ai/   (Python; boundary docs only — NO code in Phase 0)
  domain-apps/      broker/ (README + docs/ only)                    # docs-only
  schemas/          markdown/ json/ sql/                             # skeletons
  examples/         notes/ captures/ entities/ projects/ outputs/    # placeholders
  scripts/          init_workspace.ts validate_notes.ts
                    index_vault.ts query_memory.ts                   # stubs
```

**Notes**
- `sidecars/` is intentionally outside the pnpm workspace (separate Python toolchain).
- `domain-apps/broker/` stays docs-only to prove the boundary exists. Any future interface
  smoke test uses a generic `domain-apps/example-readonly/`, never broker.

## Data workspace (`PersonalSecondBrainWorkspace/`) — NOT committed

Lives outside the repo, referenced via `SECOND_BRAIN_WORKSPACE`. Created by `scripts/init_workspace.ts`
(stub in Phase 0). Real data is never committed.

```text
PersonalSecondBrainWorkspace/
  vault/
    00_Raw/          # L0 immutable source material — AI never overwrites/deletes
    00_Inbox/        # processing queue
    10_Projects/
    20_Areas/
    30_Resources/
    40_Archives/
    50_Entities/
    60_Outputs/      # L5 generated outputs (must cite sources)
    70_Daily/
    80_Wiki/
    90_System/       # templates, config, schema copies

  events/            # SOURCE OF TRUTH (append-only JSONL audit/replay) — not disposable
    memory_events.jsonl
    capture_events.jsonl
    projection_events.jsonl

  db/
    memory.sqlite    # L3 projections (rebuildable)
    backups/

  indexes/           # L4 — disposable / rebuildable
    full_text/
    vector/
    graph/
    temporal/

  attachments/
    non_sensitive/   # sensitive docs never stored here — see secure_refs/

  secure_refs/       # metadata + pointers to external secure storage (no raw sensitive docs)
    README.md

  logs/              # technical/debug logs ONLY — disposable (distinct from events/)
    capture_logs/
    extraction_logs/
    indexing_logs/
```

**Key distinction (amendment 1):** `events/` holds **source-of-truth** audit/replay records and is
never treated as disposable. `logs/` holds technical/debug output and is disposable.
