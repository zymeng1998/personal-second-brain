# STATUS

**Project:** personal-second-brain (Second Brain Core)
**Phase:** 0 — scaffold & planning
**Last updated:** 2026-06-03

## Just completed
- Open-source evaluation of 8 primary candidates + mem0/ReMe (see `docs/research/`).
- Architecture, methodology, and decision docs (ADRs 001–007).
- Phase 0 scaffold: repo tree, READMEs, schema skeletons, configs, stub scripts.
- Applied 7 user amendments (event log first-class, `00_Raw/`, no sidecar code, stdio JSON contract,
  broker docs-only, license safety rule, MVP scope unchanged).

## Next concrete action
- Human review of the scaffold and docs.
- On approval: begin **Phase 1 (MVP)** — CLI capture → L0 raw + append-only event log; vault
  read/write with raw-immutability guard; frontmatter validation; `interfaces` v0.

## Key constraints
- Domain-independent core; broker only under `domain-apps/`, via `interfaces` only.
- Raw (L0) immutable; event log append-only source of truth; indexes disposable.
- No real data in repo (workspace lives outside; created by `scripts/init_workspace.ts`).

## Open questions
See `docs/planning/open_questions.md`.

## Blockers
None. Awaiting human review of Phase 0.
