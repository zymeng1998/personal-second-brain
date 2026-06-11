# Security Story Map — Security & Privacy Hardening (EPIC-CORE-011, cross-phase)

Refinement of the EPIC-CORE-011 backlog (the `5→split` SB-051/052 decomposed into ≤3-pt atomic
stories, per the split rule). Companion to [`story_backlog.md`](story_backlog.md) (cards) and
[`phase_4_story_map.md`](phase_4_story_map.md) (prior refinement).

**Status (2026-06-10): DECISION REVIEW PASSED — OQ #26–#28 approved exactly as leaned** (recorded
in [`open_questions.md`](open_questions.md)) with guardrails: secure_ref = reference primitive
only; no raw secrets anywhere; the CLI uses the same grant resolver as every caller; **no
env/test/dev bypass**; audit evidence without secret values. **EPIC GATE MET — all 6 stories `Done` (2026-06-10, one autonomous session):** SB-050 → 067 →
068 → 069 → 073 → 074, one atomic commit each. The SB-074 gate (under-privileged callers denied
on every write op; `ALWAYS_DENIED_SCOPES` unobtainable even via explicit allow; secure-ref
round-trip with a full workspace byte-leak scan) is green in root `pnpm test`. Story ids skip
SB-070–072 (EPIC-CORE-013 media intake).

## Objective

Harden the privacy boundary ([`privacy_and_security.md`](../architecture/privacy_and_security.md)):
(1) the **`secure_refs/` pointer pattern** becomes real — sensitive documents stay in external
secure storage, the workspace stores metadata-only pointer files; (2) the **permission/scope
model** designed in `@sb/interfaces` (scopes, `CapabilityGrant`, `ALWAYS_DENIED_SCOPES`,
`OPERATION_CONTRACTS`) gains a pure grant resolver, declared caller grants, and **enforcement at
the interfaces boundary** (OQ #13 lean: capability checks where operations enter).

- **Done when (epic gate):** a metadata-only secure ref round-trips (create → list → cited from
  notes) with raw sensitive bytes never entering the workspace (test-locked), and an over-scoped
  caller is rejected with `scope_denied` on **every** write operation while `ALWAYS_DENIED_SCOPES`
  are unobtainable by any grant. Automated as SB-074.

## Open decisions — confirm before SB-050 goes `Ready` (leans)

| # | Question | Lean |
|---|---|---|
| 26 | **Grant declaration/loading** | Static in-code registry in `@sb/interfaces` for first-party callers (`cli`, `skill:*` via cli, `sidecar:retrieval`); workspace `config/grants.json` reserved for domain apps (EPIC-CORE-012), not built yet. |
| 27 | **Enforcement default** | Enforce at the operations boundary for ALL callers; `cli` (the human's proxy) holds a default grant of every scope **except** `ALWAYS_DENIED_SCOPES` (`write:raw`, `delete:*`, `read:secure_refs` stay hard-denied — raw writes happen only inside `capture` itself). No env bypass. |
| 28 | **secure_ref validation home** | New `schemas/markdown/secure_ref.schema.json` (frontmatter-only file under `secure_refs/`); validated by `validate_notes.ts` as a separate pass (secure_refs lives outside `vault/`). The pointer file must have NO body content. |

## Stories (all ≤3 pts; 15 pts total)

- **SB-050** (3, P0) — **secure_refs pointer primitive**: `secure_ref.schema.json` (metadata-only:
  `id` secref pattern, `kind`, `location: external`, opaque `locator`, `captured_at`, `notes`;
  body must be empty) + `@sb/note-vault` `writeSecureRef`/`listSecureRefs` (exclusive create,
  refuses any document content field, never under `vault/`).
- **SB-067** (2, P0) — **`sb secref add/list` CLI** + validate_notes secure_refs pass (OQ #28);
  notes cite `secref_…` ids freely.
- **SB-068** (2, P1) — **pure grant resolver** in `@sb/interfaces`: `grantAllows(grant, scope)`
  (wildcard segments, deny-overrides-allow, `ALWAYS_DENIED_SCOPES` hard deny) + table tests.
  No I/O, no enforcement.
- **SB-069** (3, P1) — **caller grants registry** (OQ #26/#27): typed first-party registry +
  `grantFor(caller)`; documents every caller's least-privilege grant; no enforcement yet.
- **SB-073** (3, P1) — **enforcement at the boundary** (splits old SB-052): `enforceScope(caller,
  operation)` consulted at every CLI command entry (the operations boundary); deny →
  `scope_denied` structured error; all existing tests stay green under the default grants.
- **SB-074** (2, P1) — **epic gate**: over-scoped caller rejected on every write op;
  `ALWAYS_DENIED_SCOPES` unobtainable; secure-ref round-trip with byte-leak assertion. Wired into
  root `pnpm test`.

### Dependency graph
```
SB-050 ─ SB-067            SB-068 ─ SB-069 ─ SB-073
   └──────────┬───────────────────────────────┘
              SB-074 (gate)
```
Recommended order: **SB-050 → SB-067 → SB-068 → SB-069 → SB-073 → SB-074.**

## Out of scope

- `config/grants.json` loading for domain apps (EPIC-CORE-012, SB-060/061).
- Encryption-at-rest, OS keychain integration, secret rotation (the locator stays opaque).
- Retroactive scope checks inside packages (enforcement sits at the operations boundary).
