# Domain Boundary Story Map — Domain App Boundary (EPIC-CORE-012)

Refinement of the EPIC-CORE-012 backlog (the coarse SB-060/061 decomposed into ≤3-pt atomic
stories, per the split rule). Companion to [`story_backlog.md`](story_backlog.md) (cards) and
[`security_story_map.md`](security_story_map.md) (the security model this epic extends —
EPIC-CORE-011 is `Done` and MUST NOT be weakened here).

**Status (2026-06-11): DECISION REVIEW PASSED — OQ #29–#31 approved exactly as leaned** (recorded
in [`open_questions.md`](open_questions.md)) with one additional guardrail: **duplicate
`domain-app:*` entries fail closed** (whole-file rejection, never merge/last-write-wins).
Implementation authorized in dependency order SB-060 → SB-075 → SB-076 → SB-061 → SB-077, one
atomic commit per story; SB-074 re-run inside SB-077.

## Objective

Make the domain/app integration boundary real and safe **before** any user-facing surface or
domain app is built: external (non-first-party) callers get capability grants only through a
**strictly validated, fail-closed `config/grants.json`** that can never weaken the completed
security model, and a **generic read-only example app** (`domain-apps/example-readonly/`, never
broker — OQ #14) proves interface-only access end-to-end.

- **Done when (epic gate):** a config-granted read-only domain app can read notes/facts through
  the same resolver/enforcer path as every caller while being `scope_denied` on every write
  operation, and **no possible `config/grants.json` content** can (a) obtain any
  `ALWAYS_DENIED_SCOPES`, (b) alter any first-party grant, or (c) survive malformation —
  malformed/invalid config fails closed (all config-dependent callers denied). Automated as
  SB-077, wired into root `pnpm test`.

## Fixed guardrails (from the epic authorization — not open questions)

- `config/grants.json` must not weaken EPIC-CORE-011: external/domain grants are **default-deny**;
  `ALWAYS_DENIED_SCOPES` (`write:raw`, `delete:*`, `read:secure_refs`) remain impossible to grant,
  even through config (structurally excluded from the schema AND hard-denied by `grantAllows` —
  defense in depth).
- Config-loaded grants must not override or mutate the in-code first-party registry
  (`cli`, `sidecar:retrieval`, `skill:*` precedence is absolute and non-configurable).
- Unknown caller, unknown scope, malformed config, and attempted privileged-scope grants all
  **fail closed**.
- The example app is **read-only** (`read:notes` + `read:facts` only); no story in this epic
  grants a write scope.
- All existing CLI operations keep going through the same `grantFor`/`grantAllows`/`enforceScope`
  path — zero behavior change for first-party callers.
- One atomic commit per story; tests proving config grants cannot bypass the security model.

## Open decisions — confirm before SB-060 goes `Ready` (leans)

| # | Question | Lean |
|---|---|---|
| 29 | **Config validation mechanism** | `schemas/json/grant_config.schema.json` is the published contract; **runtime validation is a dependency-free strict TS validator in `@sb/interfaces`** (the package currently has zero runtime deps — keep it that way). Ajv stays test-only: a test validates the same fixtures against the schema and asserts the TS validator agrees (accept AND reject sets), so the schema and validator cannot drift. Mirrors the existing note-vault pattern (TS validation in code, Ajv in tests). |
| 30 | **Domain-app invocation boundary** | Domain apps reach core operations **only through the existing enforced CLI dispatch** — `main(argv, io, caller)` invoked programmatically with the app's own identity (`domain-app:<name>`). No second enforcement path is built; `enforceScope` gains an optional grant-config parameter threaded from dispatch, and the config is consulted **only** for callers outside the first-party registry. Honesty note: in a local single-process system this is **cooperative architectural enforcement** (test-locked discipline), not adversarial sandboxing — documented as such. |
| 31 | **Config rejection semantics + caller namespace** | Config may only declare apps matching `^domain-app:[a-z0-9][a-z0-9-]*$` — reserved identities (`cli`, `sidecar:*`, `skill:*`, anything else) are unrepresentable in the schema and re-rejected by the loader. **Any invalid entry rejects the ENTIRE file** (structured `grant_config_invalid` error; all config-dependent callers denied) rather than skipping bad entries — fail closed and loud, no partial grants. A missing `config/grants.json` is valid and means "no external grants" (default-deny). |

## Architecture (fixed)

```
                       ┌──────────────────────────────┐
                       │ first-party registry (code)  │  ◄─ never configurable
caller identity ──►    │ cli / sidecar:retrieval / …  │
"domain-app:<name>"    └──────────────┬───────────────┘
        │                             │ precedence: registry first, always
        ▼                             ▼
config/grants.json ─► strict parse ─► resolveGrant(caller, config) ─► grantAllows ─► enforceScope
   (workspace)        (fail closed:                                  (ALWAYS_DENIED    (CLI dispatch =
                       any violation ⇒                                hard deny —       the single
                       whole file rejected)                           unchanged)        boundary)
```

- The grant model stays in `@sb/interfaces` (`scope.ts` untouched semantics; `grants.ts` gains
  config-aware resolution; `enforce.ts` threads the optional config).
- `domain-apps/example-readonly/` is a minimal generic TS consumer (no domain vocabulary enters
  the core — ADR-001 grep stays clean).
- Sub-phase A = contract + loader + resolution (SB-060 → SB-075 → SB-076);
  sub-phase B = example app + epic gate (SB-061 → SB-077).

## Stories (all ≤3 pts; 12 pts total)

- **SB-060** (2, P1) — **grant config contract**: `grant_config.schema.json` (strict, versioned,
  `additionalProperties:false`; `app` pattern `domain-app:*` only; allow/deny items drawn from a
  grantable-scope set that structurally excludes `ALWAYS_DENIED_SCOPES`) + `@sb/interfaces`
  `GrantConfig` types + example fixture. No loading.
- **SB-075** (3, P1) — **fail-closed config loader**: pure `parseGrantConfig(text)` + thin
  `loadGrantConfig(workspace)`; any violation (JSON/schema/reserved app/unknown scope/privileged
  scope/duplicate app) ⇒ structured error, whole file rejected (OQ #31); missing file = empty
  config; dependency-free TS validation kept in lock-step with the schema by an Ajv test (OQ #29).
- **SB-076** (2, P1) — **config-aware grant resolution**: `resolveGrant(caller, config?)` with
  absolute first-party precedence (config ignored for registry callers even if a hostile entry
  somehow existed); `enforceScope(caller, op, config?)`; CLI dispatch loads workspace config only
  for non-first-party callers. First-party behavior byte-identical; all existing tests green.
- **SB-061** (3, P1) — **generic example read-only domain app**: `domain-apps/example-readonly/`
  acting as `domain-app:example-readonly` with `read:notes` + `read:facts` via a sample config;
  reads succeed, **every** write command `scope_denied` with zero filesystem writes; ADR-001
  domain-leakage grep stays clean.
- **SB-077** (2, P1) — **epic gate**: privileged-scope config rejected + caller fully denied;
  first-party-redefinition config rejected + registry behavior unchanged; malformed config fails
  closed; unknown caller/scope denied; SB-074 security gate re-asserted green. Root `pnpm test`.

### Dependency graph
```
SB-060 ─ SB-075 ─ SB-076 ─ SB-061
                     └────────┴── SB-077 (gate; also requires SB-074 Done — it is)
```
Recommended order: **SB-060 → SB-075 → SB-076 → SB-061 → SB-077.**

## Out of scope

- Phase 5 Surfaces (EPIC-CORE-010) — explicitly not started until this epic's gate is green.
- Any write scope for domain apps (read-only example only this phase; a write-scope grant needs
  its own justified story).
- The broker domain app (EPIC-DOMAIN-001 — stays `Deferred`; the example app is generic, never
  broker — OQ #14).
- Grant revocation UX, per-grant expiry, audit log surfaces (future hardening).
- MCP/HTTP adapters for domain apps (OQ #15 — only after interfaces stabilize).
