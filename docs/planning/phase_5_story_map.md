# Phase 5 Story Map — Surfaces (EPIC-CORE-010)

Refinement of the EPIC-CORE-010 backlog (the coarse SB-040 `5→split` and SB-041 `8→split`
decomposed into ≤3-pt atomic stories, per the split rule). Companion to
[`story_backlog.md`](story_backlog.md) (cards), [`security_story_map.md`](security_story_map.md)
(EPIC-CORE-011 — must not be weakened), and
[`domain_boundary_story_map.md`](domain_boundary_story_map.md) (EPIC-CORE-012 — the integration
model surfaces follow).

**Status (2026-06-11): REFINED — ⏸ STOPPED FOR THE OPEN-DECISION REVIEW (OQ #32–#35).**
No implementation has started; all 7 stories are `Backlog` per the Ready rule.

## Objective

Ship the first non-CLI surfaces over the SAME enforced boundary the CLI and domain apps use:
an **Obsidian helper** companion app (vault compat check, domain-neutral templates, a draft→capture
bridge — per [`obsidian_compatibility.md`](../architecture/obsidian_compatibility.md): optional,
never a plugin dependency, Obsidian never the writer of record) and a **local web dashboard**
(read views + capture + confirmation-gated proposal review).

- **Done when (roadmap gate):** at least one extra surface performs **capture + read via
  contracts only** — automated as SB-084: both new surfaces capture and read end-to-end through
  the enforced dispatch under their own least-privilege identities, are denied everything outside
  their grants (zero writes), leak no secret bytes into responses/logs, and the SB-074 + SB-077
  gates stay green alongside.

## Fixed guardrails (from the epic authorization — not open questions)

- Surfaces call the core ONLY through the existing enforced boundary (`main(argv, io, caller)` →
  `resolveGrant`/`grantAllows`/`enforceScope`) — never by importing core packages directly or
  bypassing the resolver/enforcer.
- Read-only or confirmation-gated behavior first; every write-capable surface action reuses the
  Phase 4 confirmation/provenance patterns (whole-file-validated proposals, explicit accept,
  provenance mandatory) — no new write primitives, no auto-accept, no AI inside surfaces.
- No raw secret exposure in UI, logs, snapshots, fixtures, or errors. **Dashboard v1 does not
  surface `secure_refs` at all** (no grant, nothing to render, nothing to leak); locator values
  are never displayed by any surface.
- No broker/domain leakage into the core or the generic surfaces (the SB-084 gate greps both new
  apps alongside the core).
- Fixed caller identity per surface, resolved through the same registry/resolver as everyone else
  — no ad hoc privileges, never running as `cli`.
- `ALWAYS_DENIED_SCOPES` stay unobtainable; EPIC-CORE-011/012 invariants untouched.
- Stories atomic ≤3 pts; one atomic commit per story; stop after refinement for OQ approval.

## Open decisions — confirm before SB-078 goes `Ready` (leans)

| # | Question | Lean |
|---|---|---|
| 32 | **Surface caller identity** — run as `cli`, config grants, or first-party registry entries? | **First-party in-code registry entries** (OQ #26 says the static registry IS for first-party callers; these apps live in this repo): `surface:obsidian-helper` = `write:capture` + `read:notes`; `surface:dashboard` = `read:notes` + `read:facts` + `read:index` + `write:capture` (SB-083 adds `write:distill` + `write:facts` for the accept paths when it lands). Both go through the SAME resolver; never `cli`; config grants stay reserved for external `domain-app:*` callers. Invocation = programmatic `main(argv, io, "surface:…")` — one boundary, no second path (mirrors OQ #30). |
| 33 | **Dashboard runtime shape** — framework + bundler vs zero-dep local server? | **Local-only zero-dependency `node:http` server** in `apps/dashboard`, bound to `127.0.0.1` (never `0.0.0.0`), serving a small no-build static UI (plain HTML/CSS/ES modules) + a JSON API that fronts the enforced dispatch. Strict security headers (CSP `default-src 'self'`, nosniff, frame DENY). No auth in v1 (local single-user; binding is the boundary — documented). Tests = `node:test` HTTP round-trips; no Playwright/browser dependency in root `pnpm test`. |
| 34 | **Obsidian helper shape** — real Obsidian plugin vs companion CLI? | **No plugin this phase** (no Obsidian-API dependency; headless-testable; ADR-003 keeps plugins optional). `apps/obsidian-helper` = companion CLI: (1) `check` — read-only vault Obsidian-compat report (frontmatter valid, wikilink targets resolvable, expected folders present); (2) `templates install` — domain-neutral note templates into `vault/90_System/` (never overwrites); (3) `capture --file <draft.md>` — routes a draft written in Obsidian (or anywhere) through the enforced capture op (L0 + event), leaving the draft byte-untouched. Obsidian stays never-the-writer-of-record. |
| 35 | **Dashboard v1 write surface** — which writes, gated how? | **Capture only** in SB-082 (the roadmap gate needs capture+read). SB-083 adds the review queue as a confirmation-gated front over the EXISTING accept paths: read-only `distill propose` candidates + a paste/upload box for a REVIEWED proposal JSON, POSTed verbatim into the same whole-file-validated `distill accept` / `fact accept` paths (invalid file writes nothing — unchanged). The explicit button-press on a human-reviewed proposal IS the confirmation; the dashboard never generates or edits proposals (AI stays in skills). SB-083 is the one deferrable story — the epic gate does not depend on it. |

## Architecture (fixed)

```
Obsidian (editor over the vault — read/edit L1+, NEVER 00_Raw, never writer of record)
   │  draft .md file
   ▼
apps/obsidian-helper ──┐                      first-party registry (in-code):
  caller:              │                        cli, sidecar:retrieval,
  surface:obsidian-helper                       surface:obsidian-helper, surface:dashboard
                       │                                   │
browser (127.0.0.1) ─► apps/dashboard ─────────────────────┤
  static UI + JSON API   caller: surface:dashboard         ▼
                       │                    main(argv, io, caller) ─► enforceScope
                       └──────────────────► (the ONE enforced dispatch; programmatic — OQ #30/#32)
```

- Sub-phase 5A = identity foundation (SB-078); 5B = Obsidian helper (SB-079/080, from SB-040);
  5C = dashboard (SB-081/082/083, from SB-041); 5D = epic gate (SB-084).
- Both apps are pnpm workspace packages (like `domain-apps/example-readonly`); their tests run in
  root `pnpm test`, Node-only.

## Stories (all ≤3 pts; 17 pts total — SB-040's 5 → SB-079+080; SB-041's 8 → SB-081+082+083)

- **SB-078** (2, P2) — **surface caller grants** (OQ #32): registry entries
  `surface:obsidian-helper` + `surface:dashboard` with documented least-privilege rationale;
  tests: exact grant tables, everything else denied, ALWAYS_DENIED unobtainable, zero behavior
  change for existing callers.
- **SB-079** (2, P2) — **obsidian-helper skeleton + `check`**: `apps/obsidian-helper` package;
  read-only Obsidian-compat report (frontmatter validity, unresolvable wikilinks, folder layout)
  via the enforced dispatch under its own identity; structured JSON output; zero writes asserted.
- **SB-080** (3, P2) — **templates install + draft capture bridge** (OQ #34): domain-neutral
  templates → `vault/90_System/` (exclusive create, never overwrite, report skipped);
  `capture --file <draft.md>` → enforced capture (L0 + capture event; draft byte-untouched;
  title/tags read from the draft's frontmatter when present); denial sweep (helper holds nothing
  beyond `write:capture` + `read:notes`).
- **SB-081** (3, P2) — **read-only dashboard server** (OQ #33): `apps/dashboard` local
  `node:http` on 127.0.0.1; JSON API (`GET /api/notes`, `/api/notes/:id`, `/api/facts`) fronting
  the enforced dispatch as `surface:dashboard`; minimal no-build static UI; strict security
  headers; secure_refs absent by design; HTTP round-trip tests, zero writes.
- **SB-082** (2, P2) — **dashboard capture** (OQ #35): `POST /api/capture` → enforced capture op;
  UI form; structured errors; one L0 note + one capture event per submit; this story makes the
  roadmap "capture+read via another surface" true for the dashboard.
- **SB-083** (3, P2, deferrable) — **confirmation-gated review queue** (OQ #35): read-only
  `distill propose` candidates view + paste/upload of a HUMAN-REVIEWED proposal JSON into the
  unchanged `distill accept` / `fact accept` whole-file-validated paths; grant gains
  `write:distill` + `write:facts`; invalid proposal writes nothing (re-asserted over HTTP);
  no proposal generation/editing server-side.
- **SB-084** (2, P2) — **surfaces epic gate**: roadmap "Done when" automated — both surfaces
  capture+read end-to-end via contracts only; full denial sweep outside each grant with
  byte-identical workspace; secret-leak scan (a secref-citing workspace's locator/sentinel never
  appears in HTTP responses or helper output); domain-term grep over both new apps; SB-074 +
  SB-077 invariants re-asserted in-suite.

### Dependency graph
```
SB-078 ─┬─ SB-079 ─ SB-080 ─────────┐
        └─ SB-081 ─ SB-082 ─ SB-083 ─┴─ SB-084 (gate; depends on SB-080 + SB-082 —
                       (deferrable)        SB-083 may land before or after the gate)
```
Recommended order: **SB-078 → SB-079 → SB-080 → SB-081 → SB-082 → SB-083 → SB-084.**

## Out of scope

- A real Obsidian plugin (Obsidian-API dependency) — revisit only if the companion CLI proves
  insufficient ergonomically.
- Mobile capture / browser clipper (roadmap "later").
- Remote/network serving, auth/multi-user, TLS — the dashboard is localhost-only v1.
- Surfacing `secure_refs` in any UI; any AI/generation inside surfaces (skills own that).
- New write primitives or scopes beyond the documented per-surface grants.
- EPIC-CORE-013 media intake (explicitly not started, per authorization).
