# STATUS

**Project:** personal-second-brain (Second Brain Core)

## PHASE 5 — DECISION REVIEW PASSED (2026-06-11); autonomous implementation session STARTED
- **Human approved OQ #32–#35 exactly as leaned, with one amendment:** every mutating dashboard
  HTTP endpoint requires a same-origin write guard — a server-issued nonce the page echoes back
  as **`X-SB-CSRF`**; cross-site or missing-token POSTs fail with ZERO filesystem writes
  (applies to `POST /api/capture` and any later accept endpoint).
- **Session authorization:** SB-078 → 079 → 080 → 081 → 082 → 083 → 084, one atomic commit per
  story; guardrails: never bypass the resolver/enforcer; least-privilege `surface:*` grants;
  `127.0.0.1` only; security headers on every response; no locator/sentinel bytes anywhere;
  templates domain-neutral + never overwrite; capture = exactly one L0 + one event (draft
  byte-untouched); review queue = explicit confirmation over unchanged accept paths; no broker
  leakage; SB-074 + SB-077 re-run inside SB-084.
- **SB-078 `Done`** — registry entries `surface:obsidian-helper` (write:capture+read:notes) +
  `surface:dashboard` (read:notes/facts/index+write:capture; SB-083 will extend), frozen,
  documented rationale; tests: exact tables, ALWAYS_DENIED unobtainable, config-blind vs hostile
  shadowing, unregistered surface fails closed. interfaces 23/23 (+4); root 266 exit 0.
- **SB-079 `Done`** — `apps/obsidian-helper` (`@sb/obsidian-helper`): `check [--workspace]`
  read-only compat report — ALL note content via the enforced dispatch (`note list`/`note get`
  as `surface:obsidian-helper`; guardrail-driven deviation: no `validateWorkspaceNotes` call,
  structural diagnostics instead — fence/required-keys, dangling `[[wikilinks]]` vs id+title,
  missing PARA folders via read-only `existsSync`); JSON report, exit 1 on findings. Tests 4/4:
  dangling-link fixture + clean-after-repair + seeded defects (key-less frontmatter via ULID
  filename fallback; removed folder) + denial probes (fact list/promote/rebuild/secref/query all
  `scope_denied`); byte-identical snapshot across `check`. Root **270 tests** exit 0. Next:
  SB-080 (templates + capture bridge).
- **SB-080 `Done`** — `templates install`: 3 domain-neutral BODY-ONLY scaffolds (working-note /
  daily-note / entity-stub; no frontmatter — core-owned; HTML-comment usage header) →
  `vault/90_System/templates/`, exclusive create (`wx` flag), re-run skips + reports, customized
  files never overwritten. **Enabling changes (tested):** the templates folder is excluded from
  note enumeration (read-notes) and the `validate_notes` vault pass (system assets, not notes).
  `capture --file <draft.md>`: draft → enforced capture op as `surface:obsidian-helper` (source
  `import`; `title:`/inline `tags:` lifted from the draft fence; body captured; empty body fails
  closed `empty_draft`); EXACTLY one capture event per run (counted); draft byte-untouched;
  prior L0 bytes unchanged across runs. helper **9/9** (5 new); root `pnpm test` exit 0 —
  **275 tests**, 0 fail. Next: SB-081 (read-only dashboard server).
- **SB-081 `Done`** — `apps/dashboard` (`@sb/dashboard`): zero-dep `node:http` bound
  **127.0.0.1 only** (asserted from `server.address()`); JSON API as `surface:dashboard`
  (`GET /api/notes[?type]`, `/api/notes/:ULID`, `/api/facts` — fact-list envelope passthrough);
  static UI = exact-name whitelist (no traversal surface), CSP-clean plain ES modules (no inline
  script/style); **strict headers on EVERY response** (CSP self / nosniff / frame-DENY /
  no-referrer / no-store — asserted on 200s, 404s, 405s, static); dispatch errors passed through
  as payload-free envelopes with mapped statuses (scope_denied→403 etc.); non-GET → 405 (v1
  read-only); secure_refs have NO endpoint. Tests 2/2: full round-trip + zero-write snapshot
  across the whole HTTP session + identity denial probes (rebuild/distill accept/fact add/secref
  add ⇒ `scope_denied`). Root `pnpm test` exit 0 — **277 tests**, 0 fail. Next: SB-082 (capture
  form + X-SB-CSRF).
- **SB-082 `Done`** — `POST /api/capture` behind the **amendment write guard**: per-start
  `randomBytes(32)` nonce via `GET /api/session` (same-origin readable only — no CORS anywhere),
  echoed as `X-SB-CSRF`, verified BEFORE body parse/dispatch; present-but-foreign `Origin`
  rejected (loopback self-origins allowed: 127.0.0.1 + localhost); failures ⇒ 403
  `csrf_rejected` with ZERO writes (snapshot-asserted). Valid capture = exactly one L0 note +
  one capture event (counted), readable back over the API; input validated at the boundary
  (empty/non-string content, missing source, unknown source kind, malformed JSON → 4xx zero
  writes; 1MB cap → 413); dispatch validation codes mapped to 4xx. UI capture form (CSP-clean,
  token fetched at load, notes refresh on success). dashboard **5/5 new** (7 total); root
  `pnpm test` exit 0 — **280 tests**, 0 fail. **The roadmap gate condition (capture+read via a
  non-CLI surface) is now true for the dashboard.** Next: SB-083 (review queue).
- **SB-083 `Done`** — review queue over the UNCHANGED accept paths: `GET /api/distill/candidates`
  (read-only `distill propose` passthrough, snapshot-asserted), `POST /api/distill/accept` +
  `POST /api/fact/accept` — human-reviewed proposal JSON passed VERBATIM via a tmp file OUTSIDE
  the workspace into `--file` whole-file validation (invalid/garbled/missing-provenance ⇒ ≥400,
  ZERO writes — snapshot-asserted over HTTP); both behind the same X-SB-CSRF guard
  (missing token / cross-site Origin ⇒ 403, zero writes). Grant extension landed as documented:
  `surface:dashboard` += `write:distill`+`write:facts` (never outputs/notes/secref). UI:
  candidates list + paste box + REQUIRED "I have reviewed this proposal" checkbox + explicit
  accept buttons. Happy paths: L2 + `distillation_accepted` memory event with provenance; facts
  visible via `/api/facts`. Ripple: two pre-extension denial assertions updated to
  still-ungranted scopes. dashboard **10/10** (5 new); root `pnpm test` exit 0 — **285 tests**,
  0 fail. Next: SB-084 (epic gate).

## PHASE 5 (SURFACES, EPIC-CORE-010) REFINED (2026-06-11); ⏸ STOPPED FOR THE OQ #32–#35 REVIEW
- **Human chose Phase 5 Surfaces refinement next** (EPIC-CORE-013 media intake explicitly NOT
  started) with guardrails: surfaces only through the enforced boundary (never bypassing
  resolver/enforcer); read-only/confirmation-gated first; no secret exposure in
  UI/logs/snapshots/fixtures/errors; no broker leakage; Phase 4 confirmation/provenance patterns
  for writes; fixed caller identity + config-grant style over ad hoc privileges; ≤3-pt atomic
  stories; stop after refinement for OQ approval.
- **Refinement only — no implementation.** SB-040 (`5→split`) + SB-041 (`8→split`) decomposed
  into **7 stories ≤3 pts, 17 pts total**: SB-078 (surface caller grants:
  `surface:obsidian-helper` = write:capture+read:notes; `surface:dashboard` =
  read:notes/facts/index+write:capture) → SB-079 (obsidian-helper skeleton + read-only `check`
  compat report) → SB-080 (domain-neutral templates install [never overwrite] + draft→capture
  bridge, draft byte-untouched) → SB-081 (zero-dep `node:http` localhost dashboard, read-only
  JSON API + no-build static UI, strict headers, secure_refs absent by design) → SB-082
  (dashboard capture form — makes the roadmap gate true) → SB-083 (confirmation-gated review
  queue over the UNCHANGED Phase 4 accept paths; grant extension write:distill+write:facts;
  **deferrable** — the gate doesn't depend on it) → SB-084 (epic gate: both surfaces
  capture+read via contracts only; denial sweeps byte-identical; secret-leak scan over HTTP +
  helper output; domain-term grep over both apps; SB-074/077 re-asserted). Map:
  **`phase_5_story_map.md`** (new); cards + tables in `story_backlog.md`; epic → `Refined`.
- **⏸ STOPPED at the decision review: OQ #32–#35 filed** (#32 first-party `surface:*` registry
  identities, programmatic `main(argv, io, caller)`, never `cli`; #33 zero-dep localhost
  `node:http` dashboard, no-build UI, strict headers, no auth v1; #34 no Obsidian plugin —
  companion CLI [check / templates / draft capture]; #35 capture-only writes v1, review queue =
  confirmation-gated front over unchanged accept paths). **Human confirms (or amends) → SB-078
  `Ready`** → implement SB-078 → 079 → 080 → 081 → 082 → 083 → 084, one atomic commit each.
  All 7 stories `Backlog` per the Ready rule.

## ✅ EPIC-CORE-012 (DOMAIN APP BOUNDARY) COMPLETE — GATE MET (2026-06-11, one autonomous session)
- **All 5 stories `Done` + pushed** (SB-060 → 075 → 076 → 061 → 077, one atomic commit each).
  **SB-077 gate green in root `pnpm test`:** (a) privileged-scope configs (`write:raw`,
  `delete:*`/`delete:notes`, `read:secure_refs` — allow AND deny) ⇒ whole file rejected, the
  requesting app denied on ALL 15 command forms with the workspace byte-identical; (b)
  first-party-shadowing configs rejected + registry resolution proven config-blind (identical
  with/without benign AND hostile configs) + `cli` untouched by a hostile file on disk; (c)
  malformed configs (bad JSON, unknown scope, wrong version, extra property, **duplicate app**)
  fail closed for every domain app, zero writes; (d) unknown caller/operation denied with and
  without config; (e) SB-074 invariants re-asserted WITH config present (and the full SB-074
  file runs in the same suite).
- **Final counts:** root `pnpm test` exit 0 — **262 tests** by per-package sum (interfaces 19,
  cli 82, example-readonly 3, scripts 25; others unchanged), 0 fail; **coverage 92.58% lines
  (baseline 92.08% — improved)**; `test:sidecar` untouched this epic.
- **Guardrails honored:** EPIC-CORE-011 not weakened (gate-proven); external grants default-deny;
  `ALWAYS_DENIED_SCOPES` + privileged scopes structurally ungrantable (schema) AND hard-denied
  (resolver); first-party registry non-overridable (parser-unrepresentable + resolution
  config-blind + deep-frozen); duplicate app entries fail closed; example app generic/read-only/
  domain-neutral (ADR-001 grep in the smoke test); all CLI ops through the one resolver/enforcer
  path; one atomic commit per story.
- **Shipped:** `grant_config.schema.json` + `GrantConfig` types (SB-060); dependency-free
  `parseGrantConfig`/`loadGrantConfig` + `GrantConfigError`, Ajv lock-step parity test (SB-075);
  `resolveGrant(caller, config?)` + `enforceScope(…, config?)` + dispatch-level config loading
  for `domain-app:*` callers only (SB-076); `domain-apps/example-readonly/` binding template +
  smoke test (SB-061); the epic gate (SB-077).
- **Next:** Phase 5 (Surfaces, EPIC-CORE-010 — needs refinement/split: SB-040 `5→split`,
  SB-041 `8→split`) or EPIC-CORE-013 (media intake, P2). **Stopped per authorization: the
  approved EPIC-CORE-012 chain is complete; the next decision review is the human's.**

## EPIC-CORE-012 — DECISION REVIEW PASSED (2026-06-11); autonomous implementation session STARTED
- **Human approved OQ #29–#31 exactly as leaned** (schema-as-contract + dependency-free TS
  validator with Ajv test-only parity; domain apps invoke only via the enforced CLI dispatch
  `main(argv, io, caller)` with fixed `domain-app:<name>` identity, no second facade; fail-closed
  whole-file `grant_config_invalid` rejection, missing file = valid empty config) **plus one new
  guardrail: duplicate `domain-app:*` entries fail closed** (never merge / last-write-wins).
- **Session authorization:** SB-060 → SB-075 → SB-076 → SB-061 → SB-077, one atomic commit per
  story; all prior guardrails hold (no weakening EPIC-CORE-011; absolute first-party precedence;
  ALWAYS_DENIED + privileged scopes structurally ungrantable; generic read-only domain-neutral
  example app; same resolver/enforcer path; SB-074 re-run inside SB-077).
- **SB-060 `Done`** — `grant_config.schema.json` (strict draft-2020-12: `version:1` const,
  `app` pattern `^domain-app:[a-z0-9][a-z0-9-]*$` [reserved identities unrepresentable],
  allow/deny restricted to the 12 operational scopes + `read:notes:<sub>` — `write:raw`/
  `delete:*`/`read:secure_refs` structurally absent; duplicate-app rejection documented as the
  SB-075 loader check) + `@sb/interfaces` `grant-config.ts` (types only: `GrantConfig`/
  `GrantConfigEntry`/`GrantableScope`, `GRANTABLE_SCOPES satisfies readonly PermissionScope[]`
  compile-time lock, `DOMAIN_APP_ID_PATTERN`) + `examples/grants/grants.sample.json` (read-only
  example grant) + `scripts/grant_config_schema.test.ts` wired into `test:scripts` (4 tests:
  sample + benign variants accepted; privileged scopes rejected in allow AND deny; reserved
  app ids rejected; 8 structural rejections). Validation: interfaces build exit 0; root
  `pnpm test` exit 0 — 238 tests by per-package sum, 0 fail (scripts 25 = +4). Next: SB-075
  (fail-closed loader).
- **SB-075 `Done`** — `@sb/interfaces` `parseGrantConfig(text)` (pure, dependency-free, mirrors
  the schema exactly + the duplicate-app semantic check JSON Schema can't express) +
  `loadGrantConfig(workspace)` (missing file = valid `EMPTY_GRANT_CONFIG`; ENOENT only — any
  other read failure = `unreadable`, fail closed) + `GrantConfigError("grant_config_invalid",
  {reason, path})` (14 reason codes; messages name reason + KEY PATH only, payload values never
  echoed — leak-asserted). Parsed configs **deep-frozen** (mutation throws). **OQ #29 lock-step
  test:** 30 shared fixtures through Ajv (test-only devDep) + `parseGrantConfig`, identical
  verdicts asserted; the ONE documented divergence (duplicate app, different payloads —
  inexpressible in JSON Schema) asserted as schema-accepts/loader-rejects per the duplicate
  fail-closed guardrail. interfaces **13/13** (6 new); typecheck exit 0; root `pnpm test`
  exit 0 — **244 tests**, 0 fail. Next: SB-076 (config-aware resolution).
- **SB-076 `Done`** — `@sb/interfaces` `resolveGrant(caller, config?)`: first-party registry
  consulted FIRST and `config` ignored entirely for registry callers (proven byte-identical vs
  hostile in-memory shadowing entries that try to strip `cli` / widen `sidecar:retrieval`);
  `domain-app:*` callers resolve from validated config (scope lists COPIED — no aliasing of the
  frozen config); everyone else (incl. `skill:*`) empty grant, config never consulted.
  `grantFor` now delegates to `resolveGrant` (one resolution path); registry grants deep-frozen.
  `enforceScope(caller, op, config?)` threads it; CLI dispatch (`main`) loads the workspace
  config ONLY when the caller matches `DOMAIN_APP_ID_PATTERN` (load/validate failure ⇒ structured
  error, exit 1, nothing runs) and threads it into all 8 handlers / 12 enforce sites. CLI tests:
  config-granted app reads (note list/get, fact list) succeed, writes `scope_denied`; missing
  config ⇒ default-deny; malformed config fails closed for the app AND is invisible to `cli`
  (byte-identical behavior); grants don't leak across apps. interfaces **19/19** (6 new), cli
  **77/77** (4 new, existing tests unmodified); root `pnpm test` exit 0 — **254 tests**, 0 fail.
  Next: SB-061 (example read-only domain app).
- **SB-061 `Done`** — `domain-apps/example-readonly/` (`@sb-domain/example-readonly`): generic,
  domain-neutral, READ-ONLY binding template — fixed `domain-app:example-readonly` identity
  (load-validated vs `DOMAIN_APP_ID_PATTERN`), grants only via workspace `config/grants.json`,
  invocation ONLY through programmatic `main(argv, io, caller)` (`@sb/cli` gained an `exports`
  entry — enabling change); README documents the binding pattern + the cooperative-enforcement
  honesty note. Smoke test (in root `pnpm test`): (a) with the CHECKED-IN sample config copied
  into the workspace, note list/get + fact list succeed under the app identity; (b) all 9 write
  forms + the ungranted `query` ⇒ `scope_denied` naming the caller, workspace BYTE-IDENTICAL
  (base64 snapshot, zero writes) — and `distill propose` (contractually `read:notes`+readOnly)
  correctly succeeds while writing nothing; (c) ADR-001 domain-term grep of production
  `packages/`+`schemas/` sources clean (guard lines = negative mentions recognized). Validation:
  app build exit 0, smoke 3/3; root `pnpm test` exit 0 — **257 tests**, 0 fail. Next: SB-077
  (epic gate).

## EPIC-CORE-012 (Domain App Boundary) REFINED (2026-06-11); ⏸ STOPPED FOR THE OQ #29–#31 REVIEW
- **Human chose EPIC-CORE-012 next** (over Phase 5 Surfaces — explicitly not started) with fixed
  guardrails: `config/grants.json` must not weaken the completed Security epic; external grants
  default-deny; `ALWAYS_DENIED_SCOPES` ungrantable even through config; config never
  overrides/mutates the first-party in-code registry; fail closed on unknown caller / unknown
  scope / malformed config / privileged-scope attempts; read-only example app; same
  resolver/enforcer path for all CLI ops; tests proving config can't bypass security; atomic
  commits; stop after refinement for OQ approval.
- **Refinement only — no implementation.** Coarse SB-060/061 (3+3; SB-060's dep on the split
  SB-051 was stale) decomposed into **5 stories ≤3 pts, 12 pts total**: SB-060 (grant config
  contract: strict `grant_config.schema.json` + `GrantConfig` types, privileged scopes
  structurally absent, `app` pattern `domain-app:*` only) → SB-075 (fail-closed loader: pure
  `parseGrantConfig`, whole-file rejection, missing file = empty config) → SB-076 (config-aware
  `resolveGrant` with ABSOLUTE first-party precedence; `enforceScope(caller, op, config?)`; CLI
  dispatch loads config only for non-first-party callers; first-party behavior byte-identical) →
  SB-061 (generic `domain-apps/example-readonly/` app, `read:notes`+`read:facts` only, every
  write `scope_denied` + zero-write sweep, ADR-001 grep clean) → SB-077 (epic gate:
  privileged/first-party-shadowing/malformed configs all fail closed; SB-074 gate re-asserted).
  Map: **`domain_boundary_story_map.md`** (new); cards + tables in `story_backlog.md`; epic →
  `Refined`.
- **⏸ STOPPED at the decision review: OQ #29–#31 filed** (#29 schema-as-contract +
  dependency-free TS validator in `@sb/interfaces`, Ajv test-only lock-step; #30 domain apps
  invoke ONLY via the existing enforced CLI dispatch `main(argv, io, caller)` — no second
  enforcement path, cooperative-enforcement honesty note; #31 whole-file fail-closed rejection +
  `domain-app:*` namespace, reserved identities unrepresentable). **Human confirms (or amends) →
  SB-060 `Ready`** → implement SB-060 → 075 → 076 → 061 → 077, one atomic commit each. All 5
  stories `Backlog` per the Ready rule.

## ✅ PHASE 4 (EPIC-CORE-014) COMPLETE — GATE MET (2026-06-10, one autonomous session)
- **All 9 stories `Done` and pushed** (SB-056 → 057 → 058 → 059 → 062 → 063 → 064 → 065 → 066,
  one atomic commit each). **SB-066 gate green in root `pnpm test`:** propose-without-accept across
  all four workflows leaves vault+events+db byte-identical (projection-cache materialization primed
  before baseline); accepted writes carry provenance (facts: `source_ref`+`observed_at`+
  `confidence`; outputs: non-empty resolvable `sources`; promotes cite L0 origin); L0/L1
  byte-unchanged; all appended events validate against event schema v1.
- **Final counts:** root `pnpm test` exit 0 — **204 tests** (cli 61, note-vault 47, retrieval 19,
  memory-kernel 17, scripts 20, others unchanged); no sidecar/retrieval changes this phase
  (`test:sidecar` untouched).
- **Shipped:** `proposal.schema.json` + `@sb/interfaces` proposals contracts (`write:outputs`,
  `composeOutput`); `sb fact add/accept/list`; `writeOutputNote` (L5) + `sb output create` +
  `note_created` event; skills `extract-facts` / `braindump` / `review` / `compose-output` w/ four
  E2E safety tests. Roadmap "Phase 4 — Done when" marked **met**; CLAUDE.md current-phase updated.
- **Phase 4 self-review (same session): PASS — one MEDIUM found + fixed** (`pnpm --filter @sb/cli
  fact|output|query` script aliases referenced by the skill docs didn't exist — added + smoke-
  tested) and the partial-accept **retry hazard documented** in extract-facts (don't re-run a
  partially-failed file; trim written items via `failed[].index`). LOW notes accepted: CLI
  timestamp validation (`Date.parse`) is looser than the schema's `date-time`; `tags` uniqueness
  unenforced in the CLI (schema enforces); `assertSourcesResolve` treats any `getNote` error as
  not-a-note. **Full system re-verified:** root 204 exit 0; `test:sidecar` 3/3 real; coverage
  90.19% lines (baseline held).
- **EPIC-CORE-011 (Security & Privacy Hardening) REFINED (same session)** — the highest-priority
  remaining epic (P0/P1 vs Surfaces P2), refinement only, no implementation. Old SB-051/052
  (`5→split`) decomposed; 6 stories ≤3 pts, 15 pts total: SB-050 (secure_refs primitive, P0) →
  SB-067 (`sb secref` CLI + validation pass) → SB-068 (pure `grantAllows`) → SB-069 (first-party
  grants registry) → SB-073 (enforcement at the operations boundary) → SB-074 (epic gate:
  over-scope rejected everywhere + secure-ref round-trip with byte-leak assertion). Map:
  **`security_story_map.md`** (new); cards in `story_backlog.md`.
- **⏸ STOPPED at the decision review: OQ #26–#28 filed** (grants registry in-code first-party
  only; enforcement for ALL callers, cli = everything minus `ALWAYS_DENIED_SCOPES`, no env
  bypass; secure_ref schema validated by a separate validate_notes pass). **Human confirms (or
  amends) → SB-050 `Ready`.** Alternative next: Phase 5 Surfaces refinement (P2).

## ✅ EPIC-CORE-011 (SECURITY) COMPLETE — GATE MET (2026-06-10, one autonomous session)
- **All 6 stories `Done` + pushed** (SB-050 → 067 → 068 → 069 → 073 → 074, one atomic commit
  each). **SB-074 gate green in root `pnpm test`:** (a) under-privileged callers (rogue, sidecar,
  skills) `scope_denied` on every write op + direct write scopes, zero filesystem writes; (b)
  `ALWAYS_DENIED_SCOPES` unobtainable by any caller — even a synthetic grant explicitly allowing
  them; (c) secure-ref round-trip (CLI add → list → cited from a note) with a full workspace
  byte-leak scan — the in-memory sensitive sentinel appears in NO file.
- **Final counts:** root `pnpm test` exit 0 — **229 tests** (cli 73, note-vault 52, interfaces 7,
  scripts 21); `test:sidecar` 3/3 real; **coverage 92.08% lines (baseline 90.15 — improved)**.
- **Guardrails honored:** no raw secrets anywhere (placeholders/sentinels only); secure_ref is a
  reference primitive (no body param exists; single-line ≤500-char metadata; `not_a_container`);
  denial messages name caller+scope only, locator values never echoed; **no env bypass exists**
  (negative-tested with 4 flags set); the CLI goes through the same `grantAllows` as every caller.
- **Next:** Phase 5 (Surfaces, EPIC-CORE-010 — needs refinement/split) or EPIC-CORE-012 (domain
  app boundary, SB-060/061 — now unblocked by the scope model). **Stopped per authorization: the
  approved security chain is complete; the next decision review is the human's.**

## EPIC-CORE-011 — DECISION REVIEW PASSED (2026-06-10); autonomous security session STARTED
- **Human approved OQ #26–#28 exactly as leaned**, with guardrails: one atomic commit per story;
  no raw secrets in notes/events/tests/snapshots/fixtures/logs/errors; secure_ref = reference
  primitive, never a secret container; negative tests for denied scopes / unknown grants /
  malformed secure_refs / missing grants / attempted env bypass; audit evidence without secret
  values; root suite + coverage baseline maintained; **stop at the next decision review after
  SB-074**.
- **Session authorization:** SB-050 → 067 → 068 → 069 → 073 → 074.
- **SB-050 `Done`** — `secure_ref.schema.json` (frontmatter-only pointer; `location: external`
  const; opaque locator ≤500) + `@sb/note-vault` `writeSecureRef`/`listSecureRefs`
  (`secure-ref.ts` + `SecureRefError`): no body param exists; single-line length-capped metadata
  (`not_a_container`); messages/details never echo values (leak-sentinel-tested); exclusive
  create; fixed `secure_refs/` target; list reports malformed files (smuggled body, missing
  locator, garbled) without throwing. note-vault **52/52** (5 new); build exit 0. Next: SB-067.
- **SB-067 `Done`** — `sb secref add/list` (`secref-command.ts` + dispatch/USAGE + package
  script alias): add stdout = audit metadata only (locator never echoed — asserted); ids default
  `secref_<ULID>`; list = read-only refs + malformed report. `validate_notes.ts` gains the
  separate secure_refs pass (OQ #28: outside-vault file set, empty-body required, Date→ISO
  coercion before Ajv; README skipped). cli **64/64** (3 new); scripts **21** (1 new);
  root suite exit 0 (**213 tests**); `typecheck:scripts` exit 0. Next: SB-068.
- **SB-068 `Done`** — `grantAllows(grant, scope)` in `@sb/interfaces` `scope.ts`: `*` = one
  segment, shorter pattern = hierarchical prefix, precedence `ALWAYS_DENIED_SCOPES` (hard, even if
  explicitly allowed) → `deny` → `allow`; pure + **environment-blind** (no env inspection exists
  to bypass — negative-tested with SB_SKIP_SCOPES/SB_DEV/NODE_ENV set). interfaces gains a test
  target (4 table tests) wired into root `pnpm -r`. Root **217 tests** exit 0. Next: SB-069.
- **SB-069 `Done`** — `grants.ts` `grantFor(caller)` static first-party registry (OQ #26): `cli`
  = all 11 operational scopes (incl. new `write:notes` for the promote path) minus ALWAYS_DENIED;
  `sidecar:retrieval` = read:notes + write/read:index only; `skill:*`/unknown = EMPTY grant
  (denied everything). Least-privilege rationale documented per caller. interfaces **7/7**;
  root **220 tests** exit 0. Next: SB-073 (boundary enforcement).
- **SB-073 `Done`** — `enforce.ts` `enforceScope(caller, opOrScope)` + `ScopeDeniedError`
  (audit-friendly: names caller+scope, never payloads; unknown op names DENIED). The boundary =
  the CLI dispatch: `main(argv, io, caller="cli")` threads identity into all 8 handlers; every
  subcommand enforced (contracts where they exist; `write:notes` promote, `write:secure_refs`
  secref add [new scope — external-doc `read:secure_refs` stays hard-denied], `read:notes` secref
  list). No env bypass exists (negative-tested with 4 flags set). cli **70/70** (6 new: rogue
  caller denied on all 15 command forms with zero writes; skills hold nothing; cli passes through
  the same resolver; env-bypass attempt; unknown-op denial; leak-free denial messages). Root
  **226 tests** exit 0. Next: SB-074 (epic gate).

## Phase 4 — DECISION REVIEW PASSED (2026-06-10); autonomous implementation session STARTED
- **Human approved all five open decisions exactly as leaned** (OQ #21 skills-first +
  `sidecars/ai` deferred [roadmap deviation approved]; #22 shared proposal envelope schema;
  #23 no auto-dedupe, skill surfaces duplicates; #24 note-id source resolution; #25 deterministic
  review candidates). Recorded RESOLVED in `open_questions.md` + story map.
- **Session authorization:** autonomous Phase 4 advance in dependency order
  SB-056 → 057 → 058 → 059 → 062 → 063 → 064 → 065 → 066; one atomic commit + push per story;
  blockers recorded instead of stopping.
- **SB-056 `Done`** — `proposal.schema.json` (shared envelope; fact/output item shapes; ULID
  provenance enforced) + `@sb/interfaces` `proposals.ts` (envelope/item/`composeOutput` IO types),
  `write:outputs` scope, `composeOutput` contract entry; 2 example proposals; schema test
  (examples valid + 7 rejection cases) wired into `test:scripts`. Root **187/187**. Next: SB-057.
- **SB-057 `Done`** — `sb fact add/accept/list` (`fact-command.ts` + dispatch/USAGE): add = one
  `fact_added` event + one row; accept = whole-file structural validation FIRST (invalid file
  writes nothing; mirrors the schema like `distill accept`), then sequential writes w/ per-item
  failure report; supersede supported on both paths; list = read-only `listCurrentFacts`. cli
  **51/51** (7 new incl. invalid-file-writes-nothing, supersede repoint, runtime per-item failure,
  `main()` round-trip); root **194/194**. Next: SB-058 (L5 writer).
- **SB-058 `Done`** — `@sb/note-vault` `writeOutputNote()` (`output-note-writer.ts` +
  `OutputNoteWriteError`): `vault/60_Outputs/`, `type:output`/`layer:5`, required non-empty title
  + **non-empty `sources`** enforced pre-IO, exclusive create, raw-path/escape refusal.
  note-vault **47/47** (5 new incl. Ajv schema-validity of the output branch + never-overwrite);
  build exit 0. Next: SB-059 (`sb output create` + `note_created` event).
- **SB-059 `Done`** — `sb output create --file` (`output-command.ts` + dispatch/USAGE): validate
  the `compose_output` proposal (exactly one item, v1) → resolve ULID sources (note OR current
  fact; non-ULID accepted; failure ⇒ nothing written) → `writeOutputNote` → TS-emitted
  `note_created` event (`actor:"cli"`, subject = note id; append failure structured, note kept —
  SB-053 mirror). cli **56/56** (5 new incl. unresolvable-source-writes-nothing + L0
  byte-unchanged); root suite exit 0 (**199 tests**). 4A COMPLETE. Next: SB-062 (extract-facts
  skill).
- **SB-062 `Done`** — `skills/extract-facts/SKILL.md` (mirrors distill: 4 safety rules incl.
  provenance-mandatory + OQ #23 duplicate surfacing with add/supersede/skip; read-only steps =
  `note get`/`fact list`/`query`; `fact accept --file` is the only write) +
  `extract-safety.test.ts` (capture→promote→draft writes NOTHING [vault snapshot + events +
  no db]→accept writes exactly 2 provenance-carrying facts, vault byte-unchanged). cli **57/57**.
  Next: SB-063 (braindump skill).
- **SB-063 `Done`** — `skills/braindump/SKILL.md` (capture-first verbatim → segmentation proposal
  [`workflow:braindump` envelope] → per-segment human-confirmed `note promote`; existing CLI only;
  follow-ups handed to dedicated skills) + `braindump-safety.test.ts` (verbatim L0 + exactly one
  capture event; proposing writes nothing; 2 promotes → 2 L1 notes citing the origin, L0
  byte-unchanged). cli **58/58**. Next: SB-064 (review skill).
- **SB-064 `Done`** — `skills/review/SKILL.md` (OQ #25 v1: exactly three documented deterministic
  candidate queries — aged inbox / never-promoted raws / stale tasks; every action maps to an
  existing confirmed command; `leave` always offered; zero confirmations = zero writes) +
  `review-safety.test.ts` (queries reproducible incl. the set-difference orphan raw; second pass
  identical; full pass leaves vault+events+db byte-identical). cli **59/59**. Next: SB-065
  (compose-output skill).
- **SB-065 `Done`** — `skills/compose-output/SKILL.md` (no-uncited-claims rule; `sources` must
  cover every `[<ULID>]` citation; retrieval-grounded via `sb query` w/ lexical fallback; `output
  create` is the only write) + `compose-output-safety.test.ts` (drafting writes nothing;
  fabricated citation ⇒ `source_not_found`, nothing lands; confirmed create ⇒ one schema-valid
  L5 + one `note_created` event; body citations ⊆ sources). cli **60/60**. 4B COMPLETE. Next:
  SB-066 (Phase 4 gate).

## Phase 4 — REFINED (2026-06-10); ⏸ STOPPED FOR THE OPEN-DECISION REVIEW (OQ #21–#25)
- **What:** Phase 4 (AI workflows) decomposed into **EPIC-CORE-014** with 9 atomic stories ≤3 pts
  (**SB-056..059 + SB-062..066**, 22 pts; ids skip SB-060/061 = EPIC-CORE-012 and SB-070–072 =
  EPIC-CORE-013 media intake — and note EPIC-CORE-013 was missing from the epics table, row added).
  Full cards (Scope/AC/DoD/Validation/Files/Deps) in `story_backlog.md`; objective, architecture,
  decisions, and the dependency graph in **`phase_4_story_map.md`** (new).
- **Shape:** 4A confirmed write paths — proposal contracts + `proposal.schema.json` (SB-056),
  **`sb fact` CLI** (SB-057), **L5 `writeOutputNote`** (SB-058), **`sb output create` +
  `note_created` event** (SB-059); 4B skills (AI drafts → human confirms → CLI writes) —
  extract-facts (SB-062), braindump (SB-063), review (SB-064), compose-output (SB-065), each with
  an E2E safety check mirroring `distill-safety`; 4C gate — SB-066 automates the roadmap "Done
  when" (propose-without-accept writes nothing; accepted writes carry provenance; L0/L1 immutable).
- **Open decisions filed (OQ #21–#25, leans recorded):** #21 **skills-first engine,
  `sidecars/ai` deferred** (⚠ deviates from the roadmap's `sidecars/ai` wording — needs explicit
  approval); #22 shared versioned proposal envelope schema; #23 no auto-dedupe, skill surfaces
  duplicates; #24 `sb output create` resolves note-id sources; #25 review v1 = deterministic
  candidate queries only.
- **No implementation started; all 9 stories `Backlog`** per the Ready rule.
- **Next recommended action:** human reviews OQ #21–#25 (approve as leaned or amend) → SB-056 →
  `Ready` → implement down the chain 056 → 057 → 058 → 059 → 062 → 063 → 064 → 065 → 066, one
  atomic commit per story.

## ✅ LOW NITS CLEARED + RE-REVIEW CLEAN (2026-06-10) — NO OPEN REVIEW FINDINGS
- **`e8c722a` — all LOW review nits fixed** in one commit: stale mode-default/"stubs" comments;
  `sb query` USAGE + `query_memory.ts` now list `lexical|vector|hybrid`; promote-command uses one
  shared `parseFrontmatter` pass (dup `bodyOf` deleted; `bad_arguments` → `PromoteCliError`);
  `SidecarClient` clears its stdout buffer on respawn (+ `partial` stub op regression test; dead
  `close_stdin` stub op removed); bge query prefix gated to the bge v1/v1.5 family via
  `query_prefix(name)` (unit-tested; default model byte-identical).
- **Full re-review (MEDIUM+LOW bar) of everything since `51fd338`** (5 MEDIUM fixes + LOW cleanup):
  three findings, all resolved in **`c101ea3`**: (1) indexer unlinked the old index before
  `replace()` — atomic overwrite needs no unlink, the WAL-only delete removes the last index-less
  crash window; (2) corrupt (non-integer) `schema_version` now trips the forward guard (NaN passed
  neither comparison); (3) bge-*-zh wrong-prefix limitation documented (OQ #9 English-only scope).
- **Validation (green):** builds + `typecheck:scripts` exit 0; root `pnpm test` exit 0
  (**185 tests**); sidecar pytest **45/45**; `pnpm run test:sidecar` **3/3** vs the real sidecar.
- **Verdict: no remaining MEDIUM or LOW findings.** Remaining notes are accepted/documented
  design points only (lenient frontmatter fence parsing — consistent TS/Python; `list_contains`
  vs hash-join at huge filter scale; `--title` silently ignored on `note list/get`).
- **Next:** Phase 4 (AI workflows) refinement.

## ✅ ALL 5 REVIEW MEDIUMs FIXED + PUSHED (2026-06-10, same session as the review)
- One atomic commit per finding (rate-limit-safe; each validated before commit):
  - `59f0121` **MEDIUM #1** — `SidecarClient` stdin `error` listener (EPIPE crash, probe-verified)
    **+ bonus bug found while testing:** `close()` hung forever on a SIGNAL-killed sidecar
    (`exitCode` stays null; only `signalCode` set) — both fixed via `hasExited()`; new `pid`
    accessor + kill-based regression test.
  - `6527455` **MEDIUM #3** — projection store forward guard: schema_version NEWER than the code →
    `migration_failed` (named found/supported), no silent downgrade; refused open leaves the db
    untouched.
  - `e7957de` **MEDIUM #5** — query filters bind ONE DuckDB LIST param (`list_contains`) instead of
    one `?` per allowed note id; semantics + determinism unchanged (all 9 SB-055 filter tests).
  - `bfeaa0d` **MEDIUM #2** — atomic index swap: build into `retrieval.duckdb.tmp`, `replace()` on
    success only; failed build keeps the previous index byte-identical (failure-injection test).
  - `0e686d6` **MEDIUM #4** — `queryMemory` accepts an injected reusable `SidecarClient` (left
    open, caller-owned — spawn + model load once for Phase 4 batch callers); default per-call
    behavior unchanged.
- **Final validation (green):** root `pnpm test` exit 0, 0 failures (**183 tests**: retrieval 18,
  memory-kernel 17); sidecar `uv run pytest` **44/44**; `pnpm run test:sidecar` **3/3** vs the
  real sidecar (SB-054 gate re-asserted with the tmp-swap build path).
- **LOW review nits remain unfixed by choice** (docs/DRY: stale comments, USAGE `vector` omission,
  `bodyOf` duplication, respawn buffer, bge prefix) — file as a small cleanup story if wanted.
- **Next:** Phase 4 (AI workflows) refinement.

## Phase 3 + P2 follow-ups CODE REVIEW: PASS (ship-quality) — 2026-06-10
- **Range reviewed:** `22b02b2..a5b5f51` (17 code commits: quality band SB-042..046, Phase 3
  SB-047→055, P2 follow-ups SB-028/029/033; ~6,950 lines, 90 files).
- **Verdict: no CRITICAL or HIGH.** Invariants hold: sidecar writes only `indexes/`; events
  TS-owned; raw immutability + provenance test-locked; SB-054 disposability gate re-verified live.
- **Validation re-run (all green):** root `pnpm test` 180/180; sidecar `uv run pytest` 42/42;
  `pnpm run test:sidecar` 3/3 vs the real sidecar (0 skipped).
- **MEDIUM findings (5):** (1) `SidecarClient` has no `child.stdin` `error` listener — EPIPE race
  on sidecar death could crash uncaught; (2) sidecar `_rebuild` deletes the old index before
  building (build-to-temp + rename would keep the old index on failure); (3) `openProjectionStore`
  silently accepts a FUTURE schema_version (no forward guard); (4) `queryMemory` spawns a sidecar +
  loads the model per call (~1–2 s/query — fine for CLI, revisit before Phase 4 loops); (5)
  unbounded SQL `IN` list when temporal/near filters allow many notes.
- **LOW (docs/DRY nits):** stale "default lexical"/"stubs until Phase 3" comments; `sb query`
  USAGE omits `vector` mode; `promote-command.ts bodyOf` re-duplicates the frontmatter split that
  SB-044 consolidated (and parses content twice); stale stdout buffer not cleared on client
  respawn; bge QUERY_PREFIX applied to any `SB_EMBED_MODEL`.
- **Next:** human decides whether to file MEDIUMs as backlog stories (suggest a quality band like
  SB-042..046) before Phase 4 refinement. No code changed by the review.

## Phase 3 — DECISION REVIEW PASSED (2026-06-10); implementation started (autonomous session)
- **Human approved all eight open decisions exactly as leaned** (OQ #9 BGE-M3 + CPU benchmark first in
  SB-049 + bge-small fallback; #10 DuckDB FTS+VSS; #11 stdio JSONL; #12 mem0/ReMe reference-only;
  #17 uv + pinned Python ≥3.11; #18 env-gated `test:sidecar`, root `pnpm test` Node-only; #19 single
  `indexes/retrieval.duckdb`, model cache outside the workspace; #20 ~512-token heading-aware chunks
  `<ULID>#<seq>` with `source_ref`). Recorded as RESOLVED in `open_questions.md` + story map.
- **Session authorization:** autonomous Phase 3 advance in dependency order
  SB-047 → 030 → 048 → 031 → 053 → 032 → 049 → 054 (SB-055 stretch only); one atomic commit + push per
  story; blockers recorded instead of stopping.
- **Environment note:** `uv` was not present → installed via Homebrew (`uv 0.11.19`); Python 3.11.15
  available to uv. Node 22.20 / pnpm 9 unchanged.
- **SB-047 → `In Progress`** (deps `Done`; decision gate cleared).

## SB-033 `Done` (P2 follow-up) — coverage measurement + init_workspace test — ✅ ALL P2 FOLLOW-UPS CLEARED
- **Scope delivered:** (a) root **`test:coverage`** target — `c8` wraps `pnpm test`, merging
  subprocess V8 coverage across every workspace package + scripts; excludes test files, Node stub
  sidecars (`*.mjs`), `node_modules` (config in the root `package.json` `c8` key; `coverage/`
  gitignored). **Non-blocking by design** (card note: measure first). Threshold documented in the
  README: target ≥80% lines; **baseline 90.15% lines / 78.27% branches** (2026-06-10, 180 tests).
  (b) **`scripts/init_workspace.test.ts`** — 6 subprocess tests against the real CLI surface:
  dry-run writes nothing; real init creates tree + event files then `--verify` passes; `--verify`
  fails uninitialized; re-init byte-identical (idempotent); **append-only invariant** (an existing
  event file with content is not truncated by re-init); unknown flag hard-errors. Wired into
  `test:scripts` (runs under root `pnpm test`).
- **Validation (green):** `test:scripts` **18/18**; root `pnpm test` **180/180**; `test:coverage`
  exit 0 with the summary above. No production-code change.
- **This clears the last open review follow-up (SB-028/029/033 all `Done`).** Next: Phase 4
  (AI workflows) refinement.

## SB-029 `Done` (P2 follow-up, EPIC-CORE-007) — L1 working-note creation (`note promote`)
- **Surface decisions:** command = **`sb note promote <rawId> [--title]`**; target folder =
  **`vault/00_Inbox/`** (documented L1 queue, `memory_layers.md`); body seeded from the raw
  content; title defaults from the raw note; no event emitted (working notes are vault-derived).
- **Scope delivered:** `@sb/note-vault` `writeWorkingNote()` (`working-note-writer.ts` +
  `WorkingNoteWriteError`; `type:working`/`layer:1`, schema-required `source_ref`, exclusive
  create, raw-path + workspace-escape refusal, title optional) and `apps/cli`
  `promote-command.ts` (`runNotePromote`: read raw via `getNote` read-only → reject non-raw
  (`not_raw`) → write the L1 note) wired as the `note promote` subcommand (`--title` flag added
  to the note parser). **`distill propose` now surfaces real candidates** — the capture →
  promote → propose → accept chain is end-to-end.
- **Validation (green):** note-vault **42/42** (5 new writer cases incl. Ajv schema validity +
  never-overwrite); cli **44/44** (4 new: E2E capture→promote→propose-lists-candidate with raw
  bytes unchanged; non-raw rejected; missing/unknown id; `main()` round-trip with `--title`);
  builds exit 0; root `pnpm test` **174/174**.
- **Next:** SB-033 (coverage measurement + `init_workspace` test) — the last open P2 follow-up.

## SB-028 `Done` (P2 follow-up, EPIC-CORE-007) — multi-source provenance on the L2 note
- **Human asked to check + implement the old P2 follow-ups** (SB-028/029/033 — all were still
  `Backlog`). This is the first of the three.
- **Carrier decision:** the non-primary `source_ids` are written to frontmatter **`links`**
  (schema-existing additive field, "note ids or titles"; deduped, order kept) — `source_ref` stays
  the single primary origin, no schema change. `writeDistilledNote` gains an optional validated
  `links` input (`invalid_links` error code added); the CLI accept path threads
  `source_ids.slice(1)` into it. The `distillation_accepted` event payload is unchanged.
- **Validation (green):** note-vault **37/37** (3 new: links written + deduped + schema-valid via
  Ajv; empty links → no key; invalid links rejected with nothing written); cli **40/40** (2 new:
  3-source accept → `source_ref` primary + both secondaries in `links` + full list still in the
  event; single-source → no links key); builds exit 0; root `pnpm test` **165/165**.
- **Next:** SB-029 (L1 working-note creation).

## SB-055 `Done` (Phase 3 stretch) — graph + temporal indexes — ✅ ALL 9 PHASE 3 STORIES COMPLETE
- **Human approved starting the stretch** after the SB-054 gate ("approved, start 055").
- **Scope delivered:** `notes.py` now extracts frontmatter `entities:` ULID refs (block form),
  body `[[wikilinks]]` (alias/heading forms normalized), and `created`/`updated` dates.
  `index_vault` additionally builds (a) **`graph_edges`** — `entity_ref` edges from frontmatter +
  `wikilink` edges resolved by exact note title (path-sorted first-wins on duplicate titles;
  unresolved/self links skipped; `source_ref` = linking note), and (b) **`temporal`** —
  frontmatter dates + capture/memory event `occurred_at` per `subject_id` (junk lines skipped;
  projection stream excluded), day-bucketed via `TRY_CAST`; `built` is now
  `["fts","vector","graph","temporal"]`. `query` gains `filters:{near?,from?,to?}` (validated;
  unknown keys rejected; unparseable timestamps rejected): `near` → 1-hop neighborhood + self,
  `from`/`to` → inclusive temporal range; filters **intersect** and compose with
  lexical/vector/hybrid; empty allowed-set short-circuits to `[]`. `@sb/retrieval` `queryMemory`
  passes `filters` through (typed via the SB-047 `QueryFilters`). CLI flags intentionally NOT
  added (not in the card's file list).
- **Validation (green):** sidecar pytest **42/42** (9 new: edge fixtures w/ provenance,
  unresolved/self-link skip, event-timestamp temporal rows, time-range exclusion both directions,
  near-neighborhood restriction, hybrid composition + filter intersection, empty-result
  short-circuit, invalid filters, filtered-rebuild lossless); retrieval **16/16** (+filters
  passthrough); root `pnpm test` **160/160** Python-free; `pnpm run test:sidecar` **3/3** — the
  SB-054 gate re-asserted green with the graph/temporal tables in the rebuild.
- **EPIC-CORE-009 is now fully complete (9/9 stories).** Next: Phase 4 (AI workflows) planning, or
  the older P2 follow-ups (SB-028/029/033).

## SB-054 `Done` — ✅ EPIC-CORE-009 GATE MET; PHASE 3 REQUIRED SCOPE COMPLETE (2026-06-10)
- **Scope delivered:** `apps/cli/test/disposability-gate.test.ts` (env-gated, wired into the cli
  `test:sidecar` target; mirrors SB-039): populate a throwaway workspace (2 captures + entity +
  task notes) → `runIndex` → snapshot a **fixed 5-query set across lexical/vector/hybrid** →
  **delete `indexes/` entirely** → `runIndex` again → assert **deep-equal ranked results** (ids,
  scores, snippets, provenance), identical build counts, L0 raw + capture/memory streams
  byte-unchanged throughout, and the projection stream = exactly the two `indexed` events.
- **Validation (green):** `pnpm run test:sidecar` → retrieval 1/1 + cli **2/2** (E2E + the gate),
  0 skipped, all against the real Python sidecar + real embeddings; root `pnpm test` **159/159**
  Python-free. Roadmap "Phase 3 — Done when" marked **met**; EPIC-CORE-009 → `Done`.
- **Remaining in the epic:** SB-055 (graph + temporal indexes) — P2 stretch, optional, `Backlog`.

## SB-049 `Done` (Phase 3, EPIC-CORE-009) — embeddings + DuckDB VSS + hybrid ranking
- **OQ #9 RESOLUTION — fallback adopted:** default embedding model is **`bge-small-en-v1.5`
  (384-d)**, not BGE-M3. BGE-M3 is **unloadable** on this Mac (not merely slow): its HF repo ships
  only `pytorch_model.bin` (verified — no safetensors), transformers ≥4.53 requires torch ≥2.6 to
  load `.bin` weights (CVE-2025-32434), and torch wheels for macOS x86_64 (Intel) stop at **2.2.2**.
  **Benchmark (card's first task; i9-9880H CPU, `benchmarks/bench_embed.py`):** bge-small —
  load 0.93 s, **5.93 chunks/s** indexing (32 × ~512-token chunks), **14 ms** median query embed.
  Documented in OQ #9 + sidecar README; override via `SB_EMBED_MODEL`; English-only limitation noted
  (revisit on torch ≥2.6 hardware or ONNX).
- **Scope delivered:** sidecar deps `torch 2.2.2` (pinned `<2.3` for x86_64 mac) +
  `sentence-transformers <5` + `transformers <5` + `numpy <2` (torch-2.2 ABI). `embeddings.py`
  (lazy singleton; passage embed batch=8 normalized; bge query prefix; HF cache outside workspace;
  `model_available()` for offline skips). `index_vault` now also embeds every chunk →
  `embeddings (chunk_id, vec FLOAT[384])` + **HNSW (cosine)** in the same `retrieval.duckdb`
  (threads=1 build for determinism; experimental persistence acceptable — the file is disposable);
  `meta` table records model+dim; `built:["fts","vector"]`. `query` gains `vector` + `hybrid`
  (**hybrid now the default** everywhere: sidecar, facade, CLI): candidate pools from both rankers,
  min-max normalized, `vector_weight`·vec + (1−w)·lex (default 0.7, tunable arg), id tie-break;
  model mismatch vs index → `index_model_mismatch`.
- **Validation (green):** `uv run pytest` **33/33** (5 new semantic: vector finds the
  "automobile servicing"→car-note paraphrase that lexical misses; hybrid default ≥ lexical on both
  exact + paraphrase queries; weight extremes track each ranker; deterministic re-index; model
  mismatch). TS: retrieval 15/15, cli 38/38, root **159/159** Python-free; `test:sidecar` **2/2**
  vs the real sidecar with hybrid default. Model-dependent pytest cases skip visibly offline.
- **Next:** SB-054 (`Ready`) — the epic disposability gate.

## SB-032 `Done` (Phase 3, EPIC-CORE-009) — `sb query` CLI + facade query
- **Scope delivered:** `@sb/retrieval` `queryMemory(opts)` facade (validates `workspace`/`q`/`k` →
  `RetrievalError("invalid_args")`; defaults mode `lexical`; maps + shape-checks hits →
  `protocol_error` on malformed; read-only). `apps/cli` `query` command
  (`sb query "<q>" [--k N] [--mode lexical|hybrid] [--workspace]`) printing
  `{ok,hits:[{id,score,snippet,source_ref}]}`; `QueryCliError("bad_arguments")` for empty q / bad k /
  unknown mode. `scripts/query_memory.ts` stub replaced by thin delegation. **The lexical pipeline is
  now end-to-end** (capture → index → query). New env-gated E2E (`apps/cli test:sidecar`, root
  `test:sidecar` runs retrieval + cli): capture → `runIndex` → `runQuery("xylophone")` → top hit is the
  captured note (`source_ref` = note id, chunk id prefix matches), exactly one `indexed` event, query
  appends nothing.
- **Validation (green):** retrieval **15/15** (6 new facade: mapping + mode default, k/mode passthrough,
  arg validation, sidecar_error passthrough, malformed hits → protocol_error, no writes); cli **38/38**
  (4 new query-command); builds + `typecheck:scripts` exit 0; root `pnpm test` exit 0 — **159/159**
  (Python-free); `pnpm run test:sidecar` — **2/2 pass** against the real sidecar (ping/health + full
  capture→index→query E2E).
- **Next:** SB-049 (`Ready`) — BGE-M3 embeddings + DuckDB VSS + hybrid (CPU benchmark first).

## SB-053 `Done` (Phase 3, EPIC-CORE-009) — `sb index` CLI + `indexed` projection event
- **Scope delivered:** `apps/cli` `index` command (`runIndex` in `index-command.ts`): safe workspace →
  `SidecarClient.request("index_vault")` → validate counts → **only on success** append one TS-emitted
  `indexed` projection event (`actor:"cli"`, payload `{notes,chunks,built}`) → print
  `{ok,counts,built,event_id}`. Sidecar failure → structured `RetrievalError`, **no event**; invalid
  sidecar counts → `IndexCliError("bad_sidecar_result")`, no event; event-append failure after a build →
  `event_append_failed`. `scripts/index_vault.ts` Phase-0 stub replaced by thin delegation to `runIndex`.
  cli gains the `@sb/retrieval` dep. Unit tests run a Node stub sidecar (`STUB_SIDECAR_MODE`) —
  Python-free.
- **Validation (green):** `@sb/cli` **34/34** (5 new: one-run-one-event w/ counts; failure→no event;
  bad counts→no event; raw + capture/memory streams byte-unchanged; repeated runs append-only);
  cli build + `typecheck:scripts` exit 0; root `pnpm test` exit 0 — **149/149** (Python-free); real E2E
  on a throwaway workspace (capture-style note → `sb index` → `retrieval.duckdb` built + exactly one
  schema-valid `indexed` event).
- **Next:** SB-032 (`Ready`) — `sb query` CLI + facade query.

## SB-031 `Done` (Phase 3, EPIC-CORE-009) — FTS index build + lexical query (sidecar, DuckDB)
- **Scope delivered:** sidecar gains `duckdb>=1.1` (uv dep; resolved 1.5.3) + two ops.
  `index_vault {workspace}` — read-only scan of `vault/**/*.md` (path-sorted, deterministic;
  frontmatter `id:` with `<ULID>--slug.md` filename fallback; unreadable/id-less notes skipped to
  stderr), heading-aware ~512-token chunking (`chunking.py`, pure; chunk id `<ULID>#<seq>`; title
  prepended to chunk 0; oversize sections → paragraph packing → hard split), **full rebuild** of
  `indexes/retrieval.duckdb` (file deleted + recreated each run — disposable by contract) with a
  DuckDB FTS (BM25) index → `{notes,chunks,built:["fts"]}`. `query {workspace,q,k?,mode}` — lexical
  BM25, score desc + deterministic id tie-break, 200-char snippet, `source_ref` provenance; read-only
  connection. New `errors.py` `OpError` → structured envelope errors (`invalid_args`/
  `unsupported_mode`/`index_missing`/`index_build_failed`/`query_failed`); `vector`/`hybrid` modes
  rejected as `unsupported_mode` until SB-049. Writes ONLY under `indexes/`; never touches `vault/`,
  `events/`, `db/` (snapshot-asserted).
- **Validation (green):** `uv run pytest` **28/28** (6 chunking + 11 index/query incl. idempotent
  re-index, provenance, ranking order, k-limit, empty vault, vault-bytes-unchanged + only-`indexes/`
  -written, query-before-index, invalid args, filename-id fallback + 11 prior); manual JSONL smoke on
  a throwaway workspace (index → 1 note/1 chunk; query "espresso" → correct hit with snippet +
  provenance). DuckDB `fts` extension caches in `~/.duckdb` (outside the workspace).
- **Next:** SB-053 (`Ready`) — `sb index` CLI + TS-emitted `indexed` projection event.

## SB-048 `Done` (Phase 3, EPIC-CORE-009) — TS sidecar transport client (`@sb/retrieval`)
- **Scope delivered:** `packages/retrieval` is now a real package. `SidecarClient` —
  spawn (`uv run --quiet python -m retrieval_sidecar`, cwd `sidecars/retrieval`; command/args/cwd
  overridable for tests), newline-framed JSONL with per-request `req_id` (`r1,r2,…`) correlation
  (out-of-order safe), configurable per-request timeout (default 30s), structured `RetrievalError`
  (`spawn_failed`/`timeout`/`protocol_error`/`sidecar_error` — sidecar code passthrough in
  `details.sidecarCode`), graceful `close()` (stdin EOF → wait → SIGKILL after 2s grace). Non-envelope
  stdout line or unexpected exit fails all pending with `protocol_error`; late lines after a timeout
  are dropped. Unit tests run against a **Node stub sidecar** (`test/stub-sidecar.mjs`) so root
  `pnpm test` stays Python-free; the real `ping`/`health` round-trip is the env-gated
  `test:sidecar` (root target added; **visible SKIP** verified by isolating `node` from `uv` on PATH).
- **Validation (green):** `@sb/retrieval` build exit 0; unit **9/9** (round-trip, args passthrough,
  out-of-order correlation, timeout, protocol_error on garbage + on exit-with-pending, sidecar_error
  passthrough, spawn_failed, clean shutdown); root `pnpm test` exit 0 — **144/144** (Python-free);
  `pnpm run test:sidecar` **1/1 pass** against the real sidecar (and SKIPs visibly without uv).
- **Next:** SB-031 (`Ready`) — FTS index build + lexical query (sidecar, DuckDB).

## SB-030 `Done` (Phase 3, EPIC-CORE-009) — Python sidecar skeleton (stdio JSONL)
- **Scope delivered:** `sidecars/retrieval` is now a real uv project — `pyproject.toml`
  (`requires-python >=3.11`, hatchling, pytest dev group), `.python-version` 3.11 (uv resolved 3.11.15),
  `uv.lock`. `src/retrieval_sidecar/`: `protocol.py` (pure `handle_line`/`handle_request`; ops registry
  `ping` → `{pong:true}`, `health` → `{version,python}`; structured errors `malformed_request`/
  `unknown_op`/`internal_error`; unrecoverable `req_id` → `""`; blank lines skipped), `server.py`
  (JSONL loop, stdout = envelopes only + flush per line, logs → stderr, clean EOF exit), `__main__.py`
  (`python -m retrieval_sidecar`). README rewritten (one-command `uv sync` setup + protocol reference).
  No vault/index/event access of any kind (card requirement).
- **Validation (green):** `uv run pytest` **11/11** (8 protocol unit + 3 subprocess: ping/health
  round-trip + EOF exit 0, stdout purity under garbage, stderr-only logs); manual echo-pipe smoke
  (`ping` + `health` → correct envelopes; Python 3.11.15).
- **Next:** SB-048 (`Ready`) — TS transport client `@sb/retrieval`.

## SB-047 `Done` (Phase 3, EPIC-CORE-009) — retrieval + index contracts
- **Scope delivered (contracts only, mirrors SB-010/019/020):** new
  `packages/interfaces/src/retrieval.ts` — `IndexType`/`QueryMode`/`ChunkId`,
  `IndexVaultInput`/`IndexVaultResult` (notes/chunks counts + built index families), `QueryFilters`
  (SB-055 stretch shape), `QueryMemoryInput` (`{q,k?,mode?,filters?}`), `RetrievalHit`
  (`{id: ChunkId, score, snippet?, source_ref: Ulid}`) + `QueryMemoryResult`, and the stdio JSONL
  envelope (`SidecarRequest {op,req_id,args?}`, `SidecarResponse {req_id,ok,data?|error?}`,
  `SidecarError {code,message}`). `scope.ts`: +`write:index`/`read:index`. `operations.ts`:
  `indexVault` (write:index) + `queryMemory` (read:index, readOnly) in `CoreOperations` +
  `OPERATION_CONTRACTS`. `index.ts` re-exports. No impl, no new dependency.
- **Validation (green):** `@sb/interfaces` typecheck exit 0; throwaway alignment smoke (typed value per
  new type + both scopes + both contract entries) compiled `--strict --module nodenext` exit 0 (temp
  file removed); root `pnpm test` exit 0 — **135/135**; leakage grep clean.
- **Next:** SB-030 (`Ready`) — Python sidecar skeleton.

## Phase 3 — REFINEMENT (2026-06-10): done; decision review passed (see above)
- **What:** decomposed EPIC-CORE-009 (`5→split` SB-030/031/032) into ≤3-pt atomic stories with full cards
  (Scope/AC/DoD/Validation/Files/Deps) and a new [`phase_3_story_map.md`](docs/planning/phase_3_story_map.md)
  (objective, "Done when" gate, architecture, open decisions, sub-phases 3A–3D + 3X stretch, dependency
  graph). Epic → `Refined`. Quality-band work (SB-042..046) approved + the stale root `package.json`
  comment fixed (`61f52e3`).
- **Stories (order):** SB-047 (contracts) → SB-030 (Python sidecar skeleton, stdio JSONL ping/health) →
  SB-048 (TS transport client) → SB-031 (DuckDB FTS build + lexical query) → SB-053 (`sb index` +
  `indexed` event) → SB-032 (`sb query` + facade) → SB-049 (BGE-M3 + VSS + hybrid; CPU check inside) →
  SB-054 (delete-`indexes/`-rebuild lossless gate) → SB-055 (graph/temporal, P2 stretch). 23 pts total.
- **Architecture (fixed):** sidecar reads vault read-only, writes only `indexes/`; events stay TS-emitted
  (`indexed` projection kind exists since SB-009); stdio JSONL envelope `{op,req_id,args}` /
  `{req_id,ok,data|error}`; single `indexes/retrieval.duckdb`; root `pnpm test` stays Node-only —
  Python-dependent tests env-gated behind `test:sidecar` (visible SKIP).
- **Open decisions to confirm before SB-047 → `Ready` (leans in the story map):** OQ #9 BGE-M3 (CPU check
  in SB-049, fallback bge-small); #10 DuckDB for FTS+VSS; #11 stdio (no HTTP); #12 mem0/ReMe reference-only;
  **#17 uv + pinned Python ≥3.11** (machine has only system 3.9.6, no uv); **#18 env-gated sidecar tests**;
  **#19 single `retrieval.duckdb`, model cache outside the workspace**; **#20 ~512-token heading-aware
  chunks (`<ULID>#<seq>`)**.
- **Next recommended action:** human confirms the 8 open decisions → mark SB-047 `Ready` → implement it
  atomically (interfaces types + descriptors only), then proceed down the chain. **No implementation has
  started.**

## SB-046 `Done` (quality band) — single-pass note reads in projections — **QUALITY BAND COMPLETE**
- **Scope delivered:** `listNotes(workspace, { includeContent: true })` attaches the verbatim content the
  lister already read (absent by default; `NoteSummary.content?`); all three projections
  (`projectEntities`/`projectEdges`/`projectTasks`) consume it and **no longer call `getNote` per note** —
  each note file is read exactly once per projection run.
- **Validation (green):** all builds exit 0; full suite **135/135** (note-vault 34: +includeContent test);
  grep: zero `getNote` call sites left in entity-graph/task-store src; SB-039 gate green.
- **This closes the 2026-06-09 Phase 2 review quality band: SB-042..046 all `Done`.** Remaining review
  follow-up: SB-033 (coverage measurement, P2) from the Phase 1 review.

## SB-045 `Done` (quality band) — projection consistency hardening
- **Scope delivered:** (a) standalone `projectEntities` is now a **full rebuild** (DELETE + insert) like
  edges/tasks — a deleted entity note drops its stale node without needing the `rebuild` command;
  (b) **schema v2** in `@sb/memory-kernel`: `UNIQUE INDEX entity_edges_unique(from_id,to_id,kind)`
  (idempotent migration; a v1 store upgrades in place on open; `SCHEMA_VERSION` 1→2); duplicate
  `insertEntityEdge` now throws (constraint), which the SB-043 transaction would roll back mid-rebuild.
- **Validation (green):** builds exit 0; full suite **134/134** (memory-kernel 16: +v1→v2 upgrade test;
  entity-graph 13: +stale-node-drop + duplicate-edge-rejected); SB-039 reproducibility gate green.
- **Next:** SB-046 (single-pass note reads in projections) — last quality-band story.

## SB-044 `Done` (quality band) — shared frontmatter helper (DRY)
- **Scope delivered:** new `@sb/note-vault` `parseFrontmatter(content)` (diagnostic: `{frontmatter, body}`
  or `{reason}` for missing/unterminated/non-mapping/invalid-YAML) + lenient `frontmatterOf` (`{}` on any
  failure). Migrated the 4 duplicated parsers: entity-graph `project-entities` + `project-edges`,
  task-store `project-tasks`, `scripts/validate_notes.ts` (same reason strings — output unchanged).
  Dep moves: `yaml` → note-vault dependency; dropped from entity-graph/task-store; root devDeps gains
  `@sb/note-vault` (script import). `read-notes.ts`'s line-based field extractor deliberately retained
  (SB-015 design choice, not a frontmatter parser).
- **Validation (green):** install + all 8 builds + scripts typecheck exit 0; full suite **131/131**;
  grep: no `yaml` import left outside `frontmatter.ts`.
- **Next:** SB-045 (projection consistency hardening).

## SB-043 `Done` (quality band) — atomic single-connection rebuild
- **Scope delivered:** `@sb/memory-kernel` `withTransaction(store, fn)` (BEGIN IMMEDIATE / COMMIT /
  ROLLBACK; rollback-failure swallowed so the original error wins); `projectEntities`/`projectEdges`/
  `projectTasks` accept an optional injected open `ProjectionStore` (caller owns lifecycle; standalone
  open-per-call behavior unchanged); `runRebuild` now does ALL table work (reset + facts + entities/edges/
  tasks) on **one store in one transaction**, and appends `projection_reset` + `projection_rebuilt` only
  **after commit** — a failed rebuild rolls back to the pre-rebuild projections and appends **no** events.
- **Validation (green):** 4 package builds exit 0; full suite **131/131** (cli 28→29: new fault-injection
  test — title-less entity note thrown mid-rebuild → projections + projection stream byte-identical to
  baseline); SB-039 reproducibility gate still green; leakage clean.
- **Next:** SB-044 (shared frontmatter helper).

## SB-042 `Done` (quality band) — engines pin + node:sqlite docs
- **Scope delivered:** root + `@sb/memory-kernel` `engines.node: ">=22.5.0"` (node:sqlite/`DatabaseSync`
  floor; was a wrong `>=20` at root); README getting-started + memory-kernel README document the
  requirement, the experimental caveat, and the driver-fallback plan (`openProjectionStore` is the swap
  point). Docs/manifests only — no production code change.
- **Validation (green):** `pnpm install` exit 0 (engines satisfied on 22.20); full suite **130/130**
  (memory-kernel 15, event-log 11, note-vault 33, fact-store 15, task-store 5, entity-graph 11, cli 28,
  scripts 12), 0 fail.
- **Next:** SB-043 (atomic single-connection rebuild).
**Phase:** **Phase 1 core COMPLETE** (SB-001..018) + **Phase 1H COMPLETE** (SB-019/024/025/026/027 — EPIC-CORE-007 `Done`).
Distillation chain shipped: contract → L2 writer → memory event → CLI `distill` → skill + safety check.
**Phase 1 final review: PASS (ship-ready)**. **✅ PHASE 2 (EPIC-CORE-008) COMPLETE** — all 10 stories
`Done` and pushed (SB-020/034/023/035/036/021/037/022/038/039; SB-039 @ `2fcb46f`). L3 projections
(facts/entities/edges/tasks) build in SQLite and are fully rebuildable: **drop `db/` + replay → identical
projections** (SB-039 gate). **Phase 2 review: PASS (ship-quality, no CRITICAL/HIGH)** — and the
**quality band SB-042..046 is now `Done`** (engines pin, atomic rebuild, shared frontmatter, schema-v2
consistency, single-pass reads). **✅ PHASE 3 (EPIC-CORE-009) REQUIRED SCOPE COMPLETE 2026-06-10** —
all 8 open decisions approved + all 8 required stories implemented, tested, and pushed in one
autonomous session (SB-047→030→048→031→053→032→049→054): Python sidecar (uv, stdio JSONL), DuckDB
FTS+VSS in one disposable `indexes/retrieval.duckdb`, bge-small embeddings (OQ #9 fallback — BGE-M3
unloadable on this hardware), hybrid-default `sb index`/`sb query` with TS-emitted `indexed` events,
and the **SB-054 delete-`indexes/`-rebuild lossless gate (green)**. Root suite **159/159** Node-only;
sidecar pytest **33/33**; `test:sidecar` 3/3 vs the real sidecar. **The SB-055 stretch and the
P2 follow-ups (SB-028/029/033) are now also `Done`** — root suite **180 tests** + coverage
reporting (90.15% lines baseline), sidecar pytest **42**. No open review follow-ups.
**Last updated:** 2026-06-10

## Phase 2 review follow-ups FILED (2026-06-09) — SB-042..046 (quality band)
- **Context:** Phase 2 code review of `origin/main` @ `22b02b2` (memory-kernel, fact-store, entity-graph,
  task-store, event-log projection additions, CLI `rebuild`; ~1,030 new production lines). **Verdict:
  ship-quality — no CRITICAL or HIGH.** All SQL parameterized; live==replay by construction; ADD-only
  facts; manual-confirm merges; zero domain leakage.
- **Filed as backlog stories** (cards in `story_backlog.md`, "Phase 2 review follow-up cards"):
  - **SB-042** (P2, 1) — pin + document the **`node:sqlite` experimental** runtime requirement
    (`engines.node` floor + README caveat + driver fallback note). [MEDIUM #1]
  - **SB-043** (P2, 3) — **atomic single-connection `rebuild`**: thread one open `ProjectionStore` through
    the rebuild + wrap reset+rebuild in one transaction (failed rebuild rolls back). [MEDIUM #2+#3]
  - **SB-044** (P3, 2) — shared frontmatter helper in `@sb/note-vault`; migrate entity-graph/task-store/
    validate_notes call sites (parser now duplicated ~4×). [LOW #4]
  - **SB-045** (P3, 2) — projection consistency hardening: standalone `projectEntities` full-rebuild
    (stale-node gap) + `UNIQUE` on `entity_edges` (schema v2). [LOW #6+#7]
  - **SB-046** (P3, 2) — single-pass note reads in projections (currently O(n) double reads). [LOW #5]
  - **LOW #8** (no coverage measurement) folded into existing **SB-033** (card updated — now spans Phase 2).
- **Also fixed (docs consistency):** the 9 stale `In Review` statuses for the committed Phase 2 stories in
  `story_backlog.md` (table rows + cards) flipped to `Done`, matching the epic row + git history.
- **No code change** — docs/backlog only.
- **Next recommended action:** Phase 3 refinement (split SB-030..032), or schedule SB-042/043 (P2 quality)
  first.

## SB-039 `Done` (Phase 2, EPIC-CORE-008) — committed + pushed (`2fcb46f`; closes Phase 2)
- **SB-039 — replay reproducibility gate. Status:** `Done` (atomic commit `2fcb46f`). **Dep:** SB-038
  `Done`. **Closes EPIC-CORE-008 / Phase 2.**
- **Scope delivered:** `apps/cli/test/reproducibility.test.ts` — populates a rich workspace (capture +
  facts incl. a supersede + 3 entities incl. a merge + a task), snapshots all four projection tables,
  **deletes `db/`**, re-runs `rebuild`, and asserts the rebuilt projections are **row-identical**. Wired
  into `pnpm test`. This is the epic "Done when" guarantee.
- **Files changed (SB-039):** `apps/cli/test/reproducibility.test.ts(new)`, `apps/cli/package.json` (test
  wiring), `docs/planning/{story_backlog.md,phase_2_story_map.md}`, `STATUS.md`.
- **Validation run (green):** `@sb/cli` **28/28** (incl. drop-db+replay row-identical gate); root `pnpm
  test` exit 0 (event-log 11, memory-kernel 15, note-vault 33, fact-store 15, task-store 5, entity-graph 11,
  cli 28, scripts 12 = **130**); leakage clean.

## SB-038 `Done` (Phase 2, EPIC-CORE-008) — committed + pushed (`a60d36f`)
- **SB-038 — replay rebuild command. Status:** `In Review` (atomic; awaiting human review → commit).
  **Deps:** SB-035 `Done`, SB-021 `Done`. **Next story:** SB-039 (reproducibility gate).
- **Scope delivered:**
  - `@sb/event-log` — new `appendProjectionEvent` (projection stream) + `validateProjectionEvent`
    (projection branch; `subject_id` optional). `PROJECTION_EVENTS_RELATIVE_PATH` constant.
  - `@sb/cli` `rebuild` command (`runRebuild`) — resets the L3 tables + emits `projection_reset`, rebuilds
    **facts from the memory event log** (ADD-only, via the SB-023 projector + `insertFact`), re-derives
    **entities/edges/tasks from the vault** (`projectEntities`/`projectEdges`/`projectTasks`), then emits
    `projection_rebuilt` with counts. Read-only over inputs: never writes `00_Raw/`, never modifies the
    capture/memory event streams (only appends to the projection stream). cli now deps the projection
    packages (`@sb/fact-store`/`@sb/entity-graph`/`@sb/task-store`/`@sb/memory-kernel`).
- **No new external dependency.** `pnpm-lock.yaml` updated for the new cli importers.
- **Out of scope (SB-038):** the reproducibility assertion (SB-039).
- **Files changed (SB-038):** `packages/event-log/src/{projection-event.ts(new),validate-event.ts,index.ts}`;
  `apps/cli/src/{rebuild-command.ts(new),index.ts}` + `test/rebuild-command.test.ts(new)` +
  `{package.json,README?}`; `pnpm-lock.yaml`, `docs/planning/story_backlog.md`, `STATUS.md`.
- **Validation run (green):** `@sb/cli` **27/27** for SB-038 scope (rebuild reconstructs
  facts/entities/edges/tasks + emits reset/rebuilt; never modifies raw/capture/memory; idempotent); event-log
  + cli builds exit 0; full suite green. (SB-039 adds the reproducibility test → 28.)
- **Next recommended action:** commit SB-038, then SB-039.

## SB-022 `Done` (Phase 2, EPIC-CORE-008) — committed + pushed (`914606c`)
- **SB-022 — task-store projection. Status:** `In Review` (atomic; awaiting human review → commit).
  **Dep:** SB-023 `Done`. **Next story:** SB-038 (replay rebuild command).
- **Decision (OQ #4 resolved):** tasks are derived from **note frontmatter `status`** (a note with
  non-empty `status` + `title` → a task); vault-derived/rebuildable; **no new task event kind**.
- **Scope delivered:**
  - New `@sb/task-store` package — `projectTasks(workspace)` scans the vault via the `@sb/note-vault` API,
    projects every note with a non-empty `status` + `title` into the SQLite `tasks` projection
    (`@sb/memory-kernel`). **Full-rebuild** per run (DELETE + insert) so a note losing its `status` drops
    its task; idempotent + deterministic; each task carries `source_ref` provenance + optional `updated_at`.
    `listTasks(workspace)` reads them; `insertTask` shared for the rebuild (SB-038).
- **No new external dependency** (`yaml` for frontmatter, already in the lockfile). `pnpm-lock.yaml` updated
  for the new `@sb/task-store` importer.
- **Out of scope (SB-022):** task scheduling/reminders; UI; a dedicated task event kind.
- **Files changed (SB-022):** `packages/task-store/{package.json,tsconfig.json,README.md,src/{index,project-tasks}.ts,test/project-tasks.test.ts}` (new),
  `pnpm-lock.yaml`, `docs/planning/{story_backlog.md,phase_2_story_map.md}`, `STATUS.md`.
- **Validation run (green):** `@sb/task-store` test **5/5** (status+title → task w/ provenance + updated_at;
  no-status / status-without-title excluded; idempotent; status removal drops the task; empty → 0) + build
  exit 0; root `pnpm test` exit 0 (event-log 11, memory-kernel 15, note-vault 33, fact-store 15, cli 24,
  task-store 5, entity-graph 11, scripts 12 = **126**); domain-leakage grep clean.
- **Next recommended action:** human reviews task projection; on approval, commit SB-022 atomically
  (`feat: task-store projection (SB-022)`) + push. Then SB-038 (replay rebuild) → SB-039 (reproducibility gate).

## SB-037 `Done` (Phase 2, EPIC-CORE-008) — committed + pushed (`0be2dd7`)
- **SB-037 — entity-graph edges + manual-confirm `entity_merged`. Status:** `In Review` (atomic; awaiting
  human review → commit). **Dep:** SB-021 `Done`. **Next story:** SB-022 (task-store) or SB-038 (rebuild).
- **Scope delivered:**
  - `@sb/entity-graph` `projectEdges(workspace)` — derives directed entity→entity edges from the `entities`
    frontmatter refs of L2 entity notes, resolves each endpoint through the merge map, and full-rebuilds the
    SQLite `entity_edges` table (idempotent; dedup; skips self-edges). `listEntityEdges` reads them;
    `insertEntityEdge` shared for rebuild (SB-038).
  - `mergeEntities(workspace,{canonical,duplicate})` — **manual-confirm** merge: validates both are ULIDs,
    distinct, and exist as nodes (`invalid_merge`/`merge_target_not_found`), then appends an `entity_merged`
    event (`actor:"human"`, payload `{merged:[duplicate]}`). Never auto-inferred. Edges repoint to the
    canonical on the next `projectEdges`.
  - **Enabling changes:** extended the SB-023 projector to fold `entity_merged` → `entityMerges` map +
    `resolveEntity(state,id)` (chain-following, cycle-guarded); added `readMemoryEvents()` + `read_failed`
    code + the `entity_merged` appendable kind to `@sb/event-log`; added `@sb/event-log` as an
    `@sb/entity-graph` dep.
- **Design:** edges from `entities` ULID refs (deterministic graph seed); title-based `[[wikilink]]`
  resolution intentionally deferred. `entity_merged` is the only merge trigger (OQ #7).
- **No new external dependency.** `pnpm-lock.yaml` updated for the new entity-graph→event-log importer.
- **Out of scope (SB-037):** auto-merge heuristics; retrieval/graph indexes (Phase 3); removing duplicate
  nodes (only edges repoint for now).
- **Files changed (SB-037):** `packages/memory-kernel/src/{projector.ts,index.ts}` + `test/projector.test.ts`;
  `packages/event-log/src/{memory-event.ts,read-events.ts(new),errors.ts,index.ts}`;
  `packages/entity-graph/src/{project-edges.ts(new),merge-entities.ts(new),errors.ts,index.ts}` +
  `test/project-edges.test.ts(new)` + `{package.json,README.md}`; `pnpm-lock.yaml`,
  `docs/planning/story_backlog.md`, `STATUS.md`.
- **Validation run (green):** `@sb/entity-graph` **11/11** (5 nodes + 6 edges/merge: edges from refs +
  provenance; self-ref skipped; idempotent; merge repoints A→C to A→B on re-project; merge non-existent
  rejected; invalid merge rejected); `@sb/memory-kernel` **15/15** (incl. `entity_merged` map +
  `resolveEntity` chain + malformed-payload throw); `@sb/event-log` 11/11; all builds exit 0; root `pnpm
  test` exit 0 (event-log 11, memory-kernel 15, note-vault 33, cli 24, fact-store 15, entity-graph 11,
  scripts 12 = **121**); domain-leakage grep clean (graph stays domain-neutral).
- **Next recommended action:** human reviews edges + merge; on approval, commit SB-037 atomically
  (`feat: entity-graph edges + manual entity_merged (SB-037)`) + push. Then resolve the task-store source
  decision for SB-022, or proceed to SB-038 (replay rebuild command).

## SB-021 `Done` (Phase 2, EPIC-CORE-008) — committed + pushed (`329e0e6`)
- **SB-021 — entity-graph nodes projection. Status:** `In Review` (atomic; awaiting human review → commit).
  **Dep:** SB-023 `Done`. **Next story:** SB-037 (entity edges + manual-confirm `entity_merged`).
- **Scope delivered:**
  - New `@sb/entity-graph` package — `projectEntities(workspace)` re-derives L3 entity nodes from L2 entity
    notes (`vault/50_Entities/`, `type: entity`) read via the `@sb/note-vault` API (no direct fs), and
    **upserts** them into the SQLite `entity_nodes` projection (`@sb/memory-kernel`). Idempotent (INSERT OR
    REPLACE by id); each node carries `source_ref` provenance to its note. `listEntityNodes(workspace)`
    reads nodes back; `insertEntityNode(store,node)` shared for the future rebuild (SB-038).
    `EntityGraphError("invalid_entity_note")` if an entity note lacks a title.
  - Frontmatter parsed with the `yaml` lib (added as an `@sb/entity-graph` dependency) — avoids a 4th
    hand-rolled frontmatter parser (review DRY finding).
- **Dependency note:** `@sb/entity-graph` deps `@sb/interfaces`/`@sb/note-vault`/`@sb/memory-kernel` +
  `yaml`. `pnpm-lock.yaml` updated for the new importer (`yaml` already in the lockfile). `node:sqlite`
  built-in (no new external native dep).
- **Out of scope (SB-021):** edges + merges (SB-037); task-store (SB-022); replay rebuild (SB-038).
- **Files changed (SB-021):** `packages/entity-graph/{package.json,tsconfig.json,README.md,src/{index,project-entities,errors}.ts,test/project-entities.test.ts}` (new),
  `pnpm-lock.yaml`, `docs/planning/story_backlog.md`, `STATUS.md`.
- **Validation run (green):** `@sb/entity-graph` test **5/5** (projects nodes w/ id/title/aliases +
  provenance; idempotent re-projection; non-entity notes ignored; missing-title rejected; empty workspace →
  0) + build exit 0; root `pnpm test` exit 0 (event-log 11, memory-kernel 13, note-vault 33, cli 24,
  fact-store 15, entity-graph 5, scripts 12 = **113**); domain-leakage grep clean (entity graph is
  domain-neutral).
- **Next recommended action:** human reviews the entity-node projection; on approval, commit SB-021
  atomically (`feat: entity-graph nodes projection (SB-021)`) + push. Then SB-037.

## SB-036 `Done` (Phase 2, EPIC-CORE-008) — committed + pushed (`11b3506`)
- **SB-036 — fact-store `supersedeFact` + current-facts query. Status:** `In Review` (atomic; awaiting human
  review → commit). **Dep:** SB-035 `Done`. **Next story:** SB-021 (entity-graph nodes projection).
- **Scope delivered:**
  - Refactored a shared `recordFact(opts, supersedes?)` core out of `addFact` (store opened once;
    `validateFactInput` extracted). `addFact` = `recordFact(opts)` (unchanged behavior).
  - New `supersedeFact(opts)` — appends a `fact_superseded` event + inserts a NEW fact row referencing the
    old via `supersedes`; **never mutates/deletes** the old row; validates the target exists first
    (`supersede_target_not_found`) and that `supersedes` is a ULID (`invalid_supersedes`). ADD-only.
  - New `listCurrentFacts(opts)` — current (non-superseded) facts from SQLite via
    `WHERE id NOT IN (SELECT supersedes …)`, ordered by id, with `source_ref`/`minConfidence`/`limit`
    filters. Read-only. Resolves supersede chains (A←B←C → C).
  - **Enabling change (`@sb/event-log`):** widened `AppendableMemoryKind` to include `fact_superseded`.
- **No new dependency, no schema change.**
- **Out of scope (SB-036):** entity/task projections; replay rebuild.
- **Files changed (SB-036):** `packages/fact-store/src/{add-fact.ts(refactor),supersede-fact.ts(new),query.ts(new),errors.ts,index.ts}`,
  `packages/fact-store/test/{supersede-fact.test.ts(new),query.test.ts(new)}`,
  `packages/fact-store/{package.json,README.md}`, `packages/event-log/src/memory-event.ts`,
  `docs/planning/story_backlog.md`, `STATUS.md`.
- **Validation run (green):** `@sb/fact-store` test **15/15** (6 add + 4 supersede + 5 query: supersede
  retains old row byte-identical + new references it + events `fact_added`,`fact_superseded`; chain → latest
  current; supersede non-existent rejected writing nothing; non-ULID supersedes rejected; query filters
  source_ref/minConfidence/limit; superseded excluded) + build exit 0; event-log build exit 0; root `pnpm
  test` exit 0 (event-log 11, memory-kernel 13, note-vault 33, cli 24, fact-store 15, scripts 12 = **108**);
  domain-leakage grep clean.
- **Next recommended action:** human reviews supersede + query; on approval, commit SB-036 atomically
  (`feat: fact-store supersedeFact + current-facts query (SB-036)`) + push. Then SB-021.

## SB-035 `Done` (Phase 2, EPIC-CORE-008) — committed + pushed (`95be41e`)
- **SB-035 — fact-store table + `addFact` (ADD-only). Status:** `In Review` (atomic; awaiting human review →
  commit). **Dep:** SB-023 `Done`. **Next story:** SB-036 (`supersedeFact` + current-facts query).
- **Scope delivered:**
  - New `@sb/fact-store` package — `addFact(opts)`: validates statement (non-empty), `source_ref` (ULID,
    provenance required), `observed_at`, `confidence` (0–1); appends one `fact_added` memory event (source
    of truth) via `appendMemoryEvent`; then inserts **exactly one** row into the SQLite `facts` projection
    (`@sb/memory-kernel`). **ADD-only** — never UPDATEs/DELETEs. `insertFact(store, fact)` is the shared
    INSERT path (live write + future replay rebuild → live == replay). `FactStoreError`
    (`invalid_statement`/`invalid_source_ref`/`invalid_observed_at`/`invalid_confidence`/`projection_write_failed`).
  - **Enabling change (`@sb/event-log`):** widened `AppendableMemoryKind` to include `fact_added` (one
    token; `validateMemoryEvent` already accepted the full memory enum). Beyond the card's listed files but
    necessary; noted in the card.
- **Dependency note:** `@sb/fact-store` deps `@sb/interfaces` + `@sb/event-log` + `@sb/memory-kernel`
  (workspace). `pnpm-lock.yaml` updated for the new importer. `node:sqlite` built-in (no new external dep).
- **Out of scope (SB-035):** supersede/query (SB-036); AI extraction.
- **Files changed (SB-035):** `packages/fact-store/{package.json,tsconfig.json,README.md,src/{index,add-fact,errors}.ts,test/add-fact.test.ts}` (new),
  `packages/event-log/src/memory-event.ts` (AppendableMemoryKind +`fact_added`), `pnpm-lock.yaml`,
  `docs/planning/story_backlog.md`, `STATUS.md`.
- **Validation run (green):** `@sb/fact-store` test **6/6** (one event + one row; row matches projector view
  i.e. live==replay; invalid source_ref/confidence(×2)/statement rejected writing nothing; ADD-only two
  rows + first unchanged) + build exit 0; event-log build exit 0; root `pnpm test` exit 0 (event-log 11,
  memory-kernel 13, note-vault 33, fact-store 6, cli 24, scripts 12 = **99**); domain-leakage grep clean.
- **Next recommended action:** human reviews `addFact`; on approval, commit SB-035 atomically
  (`feat: fact-store addFact (SB-035)`) + push. Then SB-036.

## SB-023 `Done` (Phase 2, EPIC-CORE-008) — committed + pushed (`b160f71`)
- **SB-023 — replay projector core. Status:** `In Review` (atomic; awaiting human review → commit).
  **Dep:** SB-034 `Done`. **Next story:** SB-035 (fact-store `addFact`, which folds via this projector).
- **Scope delivered:**
  - New `packages/memory-kernel/src/projector.ts` — a **pure, deterministic** fold of memory events into
    in-memory `ProjectionState` (`facts`/`entities`/`edges`/`tasks`). `applyEvent(state,event)→state'`
    (copy-on-write; input never mutated) + `projectEvents(events)→state` reducer. **No I/O** (SQLite
    persistence is SB-038). Implements the **fact** fold (`fact_added`/`fact_superseded`, ADD-only) — what
    SB-035 builds on; `currentFacts(state)` derives the non-superseded view (resolves chains A←B←C → C).
    Non-memory streams + unhandled memory kinds (note_created/updated, entity_merged) are no-ops
    (forward-compatible) — entity/task folding is added by SB-021/SB-037/SB-022. Malformed fact payloads
    throw `MemoryKernelError("invalid_projection_event")`.
  - `errors.ts` — added `invalid_projection_event` code. `index.ts` — exports `applyEvent`,
    `projectEvents`, `emptyState`, `currentFacts`, `ProjectionState`.
- **No new dependency, no schema change.** (Fact payload convention: a fact event's `payload` carries the
  Fact fields minus id; `subject_id` = fact id — the contract SB-035 will satisfy.)
- **Out of scope (SB-023):** SQLite persistence (SB-038); entity/task projection (SB-021/037/022); reading
  the event log from disk.
- **Files changed (SB-023):** `packages/memory-kernel/src/{projector.ts(new),errors.ts,index.ts}`,
  `packages/memory-kernel/test/projector.test.ts(new)`, `packages/memory-kernel/package.json` (test wiring),
  `docs/planning/story_backlog.md`, `STATUS.md`.
- **Validation run (green):** `@sb/memory-kernel` test **13/13** (4 store + 9 projector: empty stream,
  fact_added, ADD-only supersede keeps old + supersedes, supersede chain → latest, deterministic re-run,
  applyEvent purity, non-memory ignored, unhandled kind no-op, malformed payload throws); build `tsc
  --noEmit` exit 0; root `pnpm test` exit 0 (event-log 11, memory-kernel 13, note-vault 33, cli 24,
  scripts 12 = 93); domain-leakage grep clean.
- **Next recommended action:** human reviews the projector; on approval, commit SB-023 atomically
  (`feat: replay projector core (SB-023)`) + push. Then SB-035 (fact-store `addFact`).

## SB-034 `Done` (Phase 2, EPIC-CORE-008) — committed + pushed (`a8ff719`)
- **SB-034 — projection store bootstrap (SQLite). Status:** `In Review` (atomic; awaiting human review →
  commit). **Dep:** SB-020 `Done`. **Next story:** SB-023 (pure event→state projector core).
- **Scope delivered:**
  - New `@sb/memory-kernel` package — `openProjectionStore(workspace)` opens/creates
    `<workspace>/db/memory.sqlite` via the built-in **`node:sqlite`** `DatabaseSync` and applies an
    idempotent schema migration (`facts`, `entity_nodes`, `entity_edges`, `tasks`, `schema_version`).
    Returns `{ db, path, schemaVersion, close() }` (raw `db` handle for SB-035+). `db/` is disposable —
    deleting it and re-opening recreates the schema. `MemoryKernelError`
    (`unsafe_path`/`open_failed`/`migration_failed`); absolute-path guard.
  - **ULID centralized (tech-debt retired):** new `@sb/interfaces` `ulid()` (`src/ulid.ts`, exported from
    index); `apps/cli/src/ulid.ts` **deleted**; `capture-command.ts` + `distill-command.ts` now import
    `ulid` from `@sb/interfaces`. Byte-identical output (same standard encoding). Added `"types":["node"]`
    to the interfaces tsconfig (for `node:crypto`).
- **Dependency note:** `node:sqlite` is **built-in** (no new dep; works without a flag on Node 22.20, emits
  an experimental warning). `pnpm-lock.yaml` updated only for the new `@sb/memory-kernel` workspace importer.
- **Out of scope (SB-034):** projecting events (SB-023); fact/entity/task writes (SB-035+); replay (SB-038).
- **Files changed (SB-034):** `packages/memory-kernel/{package.json,tsconfig.json,README.md,src/{index,store,errors}.ts,test/store.test.ts}` (new),
  `packages/interfaces/src/{ulid.ts(new),index.ts}`, `packages/interfaces/tsconfig.json`,
  `apps/cli/src/{capture-command.ts,distill-command.ts}`, `apps/cli/src/ulid.ts` (deleted), `pnpm-lock.yaml`,
  `docs/planning/{story_backlog.md,phase_2_story_map.md,open_questions.md}`, `STATUS.md`.
- **Validation run (green):** `@sb/memory-kernel` test **4/4** (fresh open creates db + 5 tables at schema
  v1; re-open idempotent single schema_version row; drop-db-and-reopen recreates; relative path rejected)
  + build exit 0; `@sb/interfaces` + `@sb/cli` builds exit 0; **cli 24/24** unchanged (ULID swap); root
  `pnpm test` exit 0 (memory-kernel 4, event-log 11, note-vault 33, cli 24, scripts 12 = 84); CLI capture
  smoke → note_id is a valid ULID; domain-leakage grep clean.
- **Next recommended action:** human reviews the store + ULID centralization; on approval, commit SB-034
  atomically (`feat: SQLite projection store bootstrap + ULID centralization (SB-034)`) + push. Then SB-023.

## SB-020 `Done` (Phase 2, EPIC-CORE-008) — committed + pushed (`f772ad1`)
- **SB-020 — fact + projection contracts (interfaces). Status:** `In Review` (atomic; awaiting human review →
  commit). **Deps:** SB-009 `Done`, SB-010 `Done`. **Next story:** SB-034 (projection store bootstrap,
  SQLite). Contracts-only (types + operation descriptors, no behavior) — mirrors SB-010/SB-019.
- **Scope delivered (contracts only):**
  - New `packages/interfaces/src/fact.ts` — `Fact`
    (`{id, statement, source_ref, captured_at, observed_at, confidence, supersedes?}`), `Confidence` (0–1),
    `AddFactInput`, `SupersedeFactInput`, `FactFilter`. ADD-only documented (corrections are new facts via
    `supersedes`); provenance + timestamps + confidence required (ADR-004 / OQ #6).
  - New `packages/interfaces/src/projection.ts` — `EntityNode`, `EntityEdge`, `Task`, `ProjectionName`,
    `RebuildProjectionsInput`/`Result`. Projections documented as disposable/rebuildable from the event log.
  - `scope.ts` — added `write:facts`, `read:facts`, `rebuild:projections` (least-privilege; distinct from
    capture/distill/raw).
  - `operations.ts` — added `addFact`/`supersedeFact` (write:facts), `listFacts` (read:facts, read-only),
    `rebuildProjections` (rebuild:projections) to `CoreOperations` + `OPERATION_CONTRACTS`. Reused the
    existing `InterfaceErrorCode` union (no new codes).
  - `index.ts` — re-exports the new fact + projection types.
- **No implementation, no new dependency, no schema change.** Decisions deferred to later stories: SQLite
  driver (SB-034), ULID centralization (SB-034), task source (SB-022).
- **Out of scope (SB-020):** any impl; SQLite; AI extraction; L4 indexes.
- **Files changed (SB-020):** `packages/interfaces/src/{fact.ts(new),projection.ts(new),operations.ts,scope.ts,index.ts}`,
  `docs/planning/story_backlog.md`, `STATUS.md`.
- **Validation run (green):** `@sb/interfaces` `tsc --noEmit` → **exit 0**; throwaway alignment smoke (one
  typed value per new type + `write:facts`/`read:facts` scopes + `OPERATION_CONTRACTS.{addFact,listFacts}`
  reads) compiled under `--strict --module nodenext` → **exit 0** (temp file removed); leakage grep on the
  new files → clean.
- **Next recommended action:** human reviews the contracts; on approval, commit SB-020 atomically
  (`feat: fact + projection contracts (SB-020)`). Then SB-034 — but **first confirm the SQLite driver**
  (`node:sqlite` vs `better-sqlite3` vs `sql.js`) + ULID-centralization decision.

## Phase 2 — REFINEMENT (2026-06-05): done; awaiting decision review
- **What:** decomposed EPIC-CORE-008 (`5→split` SB-020/021/023) into ≤3-pt atomic stories with cards
  (Scope/AC/DoD/Validation/Files/Deps) and a new [`phase_2_story_map.md`](docs/planning/phase_2_story_map.md)
  (objective, "Done when" gate, architecture, dependency graph, sub-phases 2A–2E). Epic → `Refined`.
- **Stories (order):** SB-020 (contracts) → SB-034 (SQLite store bootstrap) → SB-023 (pure projector core)
  → SB-035 (`addFact` ADD-only) → SB-036 (`supersedeFact`+query) → SB-021 (entity nodes) → SB-037 (edges +
  `entity_merged`) → SB-022 (task-store) → SB-038 (rebuild command) → SB-039 (drop+replay reproducibility gate).
- **Architecture (fixed):** event-sourced; SQLite `db/memory.sqlite` (rebuildable); ADD-only facts
  (`{id,statement,source_ref,captured_at,observed_at,confidence 0–1,supersedes?}`); manual-confirm entity
  merges; pure deterministic projector (live + replay share it). Done-when: drop `db/` + replay → identical.
- **Open decisions to confirm before any story → `Ready`:** (1) SQLite driver (`node:sqlite` vs
  `better-sqlite3` vs `sql.js`); (2) centralize ULID generation now (retire `apps/cli/src/ulid.ts`) vs
  defer; (3) Phase 2 = projection/replay machinery + programmatic `addFact` only, AI extraction OUT;
  (4) task-store source (note `status` vs a task event). Leans documented in the story map.
- **Next recommended action:** human resolves the 4 open decisions → mark SB-020 `Ready` → implement it
  atomically (interfaces types + descriptors only), then proceed down the chain. **No implementation has
  started.**

## Phase 1 — FINAL REVIEW (2026-06-05): PASS / ship-ready
- **Scope:** complete code review + full end-to-end test of Phase 1 (SB-001..027) — interfaces,
  note-vault, event-log, cli, scripts (init/validate), and the `skills/distill` skill.
- **Verdict:** ✅ ship-ready. **No CRITICAL or HIGH issues.**
- **Dynamic testing (all green):** 4 package builds `tsc --noEmit` exit 0; full suite **80/80**
  (event-log 11, note-vault 33, cli 24, scripts 12); E2E on a throwaway workspace — init→verify→idempotent
  re-init (byte-identical), capture (flag+stdin)→list→get→`validate:notes` 2/2, distill propose (read-only)
  →accept → 1 L2 note + 1 `distillation_accepted` event, **L0 raw + capture_events byte-unchanged**,
  immutability API (`updateRawNote`/`deleteRawNote` → `overwrite_rejected`/`delete_rejected`, bytes
  unchanged), append-only ordered ULIDs, domain-leakage grep clean. No `console.log`/`any`/`TODO` in src.
- **MEDIUM findings → backlog (this commit):**
  - **SB-028** — multi-source provenance loss: an L2 note records only `source_ids[0]` as `source_ref`;
    secondary sources live only in the event payload.
  - **SB-029** — `distill propose` has no practical candidate source yet (nothing creates L1 working notes;
    `propose` returns `candidates: []`).
  - **SB-033** — no coverage measurement (global ≥80% rule) + `init_workspace.ts` has no automated test.
- **LOW findings → one small maintenance commit (next):** dedupe `EVENT_SCHEMA_VERSION`; add a low-risk
  `scripts/tsconfig.json` + `typecheck:scripts` if it passes cleanly; document `actor` semantics. (Frontmatter
  parser consolidation and `CoreOperations` binding are deliberately NOT done now — deferred, low priority.)
- **Other LOW (noted, not scheduled):** 3+ frontmatter parse/build impls (DRY); `resolveSafeWorkspace`
  transiently mutates `process.env`; `validate_notes` assumes LF; `CoreOperations`/`OPERATION_CONTRACTS`
  are documentary only; `actor` is `"cli"` for capture vs `"human"` for distill-accept.

## SB-027 `Done` (Phase 1H, EPIC-CORE-007) — implemented + validated; committing now (closes Phase 1H)
- **SB-027 — distillation skill + L0/L1 safety check. Status:** `In Review` (atomic; awaiting human review →
  commit). **Dep:** SB-026 `Done` (`7feff6b`). **The last Phase 1H story** — closes EPIC-CORE-007 and the
  original MVP distillation criterion (mvp_scope AC 5).
- **Scope delivered:**
  - New `skills/distill/SKILL.md` — the agent-workflow skill (frontmatter `name`/`description` + body).
    Documents the **propose → confirm → accept** workflow via the `@sb/cli distill` commands and the
    non-negotiable safety rules: never mutate L0 raw, never mutate L1 sources, `accept` is the only write
    and is always human-confirmed (no auto-accept), provenance mandatory. Skill = agent layer, never the
    backend (per ADR-007 / CLAUDE.md).
  - New `apps/cli/test/distill-safety.test.ts` — the automated end-to-end guarantee: captures an L0 raw
    note, seeds an L1 working source, runs `propose` (asserts read-only: raw snapshot + L1 bytes unchanged)
    then `accept`, and asserts **raw L0 bytes + file set unchanged**, **L1 source bytes unchanged**, and
    **exactly one L2 note + exactly one `distillation_accepted` event** created. Byte-checked via dir
    snapshots. Wired into `@sb/cli`'s `test` script (so it runs under root `pnpm test`).
- **Docs updated:** `mvp_scope.md` AC 5 ⏳→✅ (distillation delivered in Phase 1H; status header now
  "Phase 1A–1H"); EPIC-CORE-007 epic row → `In Review`.
- **No new dependency, no schema change, no production-code change** (skill doc + test only).
- **Out of scope (SB-027):** multi-note synthesis heuristics; L3 facts; auto-accept.
- **Files changed (SB-027):** `skills/distill/SKILL.md(new)`, `apps/cli/test/distill-safety.test.ts(new)`,
  `apps/cli/package.json` (test wiring), `docs/planning/{story_backlog.md,phase_1_story_map.md,mvp_scope.md}`,
  `STATUS.md`.
- **Validation run (green):** `pnpm --filter @sb/cli test` → **24/24** (23 + the safety check); build `tsc
  --noEmit` → exit 0; root `pnpm test` → exit 0 (event-log 11, note-vault 33, cli 24, scripts 12; safety
  check confirmed running in root); domain-leakage grep on the new files (incl. SKILL.md) → clean.
- **Next recommended action:** human reviews the skill + safety check; on approval, commit SB-027 atomically
  (`feat: distillation skill + L0/L1 safety check (SB-027)`) + push. **That completes Phase 1H** — then mark
  EPIC-CORE-007 `Done` and begin **Phase 2** (EPIC-CORE-008: refine + split SB-020..023 before implementing).

## SB-026 `Done` (Phase 1H, EPIC-CORE-007) — committed + pushed (`7feff6b`)
- **SB-026 — CLI `distill` command (propose + accept). Status:** `In Review` (atomic; awaiting human review →
  commit). **Deps:** SB-024 `Done` (`ba40614`), SB-025 `Done` (`2cc26cc`). **Next story:** SB-027 (the
  `skills/distill/` skill + an L0/L1-never-mutated safety check) — the last Phase 1H story.
- **Scope delivered:**
  - New `apps/cli/src/distill-command.ts` — `runDistillPropose()` (READ-ONLY: lists L1 `working` candidates
    via `listNotes` + returns a blank `DistillationProposal` scaffold; writes nothing) and
    `runDistillAccept()` (HUMAN-CONFIRMED WRITE: validates a parsed proposal, generates L2 + event ULIDs,
    calls `writeDistilledNote()` then `appendMemoryEvent('distillation_accepted')`, returns
    `{ok,note_id,note_path,event_id,event_path,source_ref,source_ids,created_at}`). `DistillCliError`
    (`bad_arguments`/`bad_proposal`/`event_append_failed`); workspace safety reuses `resolveSafeWorkspace`
    (SB-013).
  - `apps/cli/src/index.ts` — `distill` dispatch + `handleDistill` (`propose`/`accept` subcommands;
    `--workspace`/`--file`/`--limit`; `accept` reads proposal JSON from `--file` or stdin); USAGE updated.
  - **Design:** proposal `source_ids[0]` → the note's single `source_ref` (schema has one `source_ref` for
    non-output notes); the full `source_ids` list is preserved in the event payload. `accept`'s memory
    event uses `actor:"human"`. Partial failure: L2 note kept if the event append fails.
- **Dependency added:** `@sb/interfaces` → `@sb/cli` (the `DistillationProposal` contract type flows through
  the CLI per the contracts-first boundary). `pnpm-lock.yaml` updated (new cli importer dep). No other deps.
- **Out of scope (SB-026):** the LLM proposal logic (the skill, SB-027); L3 facts.
- **Files changed (SB-026):** `apps/cli/src/{distill-command.ts(new),index.ts}`,
  `apps/cli/test/distill-command.test.ts(new)`, `apps/cli/{package.json,README.md}`, `pnpm-lock.yaml`,
  `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`.
- **Validation run (green):** `pnpm --filter @sb/cli test` → **23/23** (14 existing + 9 new: propose lists
  candidates + scaffold & writes nothing, `--limit`, accept writes 1 L2 + 1 `distillation_accepted` event,
  accept via stdin, bad/empty proposal + invalid JSON + unknown subcommand error paths); build `tsc
  --noEmit` → exit 0; **real propose→accept smoke** on a throwaway workspace (capture L0 → propose
  read-only → accept → 1 L2 note in `80_Wiki` + 1 memory event; **raw byte-unchanged**; clean stderr); root
  `pnpm test` → exit 0 (event-log 11, note-vault 33, cli 23, scripts 12); domain-leakage grep → clean.
- **Next recommended action:** human reviews the `distill` command + tests; on approval, commit SB-026
  atomically (`feat: CLI distill command (SB-026)`) + push. Then SB-027 finishes Phase 1H.

## SB-025 `Done` (Phase 1H, EPIC-CORE-007) — committed + pushed (`2cc26cc`)
- **SB-025 — memory-stream event append (event-log). Status:** `In Review` (atomic; awaiting human review →
  commit). **Deps:** SB-009 `Done`, SB-014 `Done`. **Next story:** SB-026 (CLI `distill` — `propose`
  read-only + `accept` human-confirmed write). Mirrors `appendCaptureEvent` (SB-014) for the memory stream.
- **Scope delivered:**
  - New `packages/event-log/src/memory-event.ts` — `appendMemoryEvent(input)` appends one validated
    memory-stream event as a single JSONL line to `<workspace>/events/memory_events.jsonl`, **append-only**
    (fs append mode; never truncates). Builds `{stream:"memory", kind}` for the Phase 1H kinds
    (`note_created` / `distillation_accepted`; `subject_id` required), auto-stamps `recorded_at` +
    `schema_version:"1.0.0"`, validates **before** writing (nothing written on failure). `AppendableMemoryKind`
    restricts the public API to the two Phase 1H kinds.
  - `validate-event.ts` — new dependency-free `validateMemoryEvent` aligned with the memory-stream branch
    of event v1 (accepts the full memory enum for forward-compat; `subject_id` ULID required). Factored a
    shared `validateOptionalEnvelope` helper (recorded_at/source_ref/schema_version/payload) reused by both
    validators.
  - `index.ts` — exports `appendMemoryEvent`, `MEMORY_EVENTS_RELATIVE_PATH`, the input/result/kind types,
    and `validateMemoryEvent`.
  - Reuses the existing `EventLogError` codes (`unsafe_path` / `invalid_event` / `append_failed`); no new
    error code.
- **No new dependency, no schema change, no `pnpm-lock.yaml` change.**
- **Out of scope (SB-025):** projection events; replay/projection rebuild; fact events (Phase 2).
- **Files changed (SB-025):** `packages/event-log/src/{memory-event.ts(new),validate-event.ts,index.ts}`,
  `packages/event-log/test/memory-event.test.ts(new)`, `packages/event-log/{package.json,README.md}`,
  `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`.
- **Validation run (green):** `pnpm --filter @sb/event-log test` → **11/11** (5 capture + 6 new memory:
  valid line w/ auto-stamps, N ordered appends + earlier-unchanged, missing subject_id writes nothing,
  unknown kind writes nothing, non-ULID subject_id rejected, relative workspace rejected);
  `pnpm --filter @sb/event-log build` (`tsc --noEmit`) → **exit 0**; root `pnpm test` → exit 0 (event-log
  11, note-vault 33, cli 14, scripts 12; via temp `pnpm`→`corepack pnpm` PATH shim); domain-leakage grep
  on the new files → clean.
- **Next recommended action:** human reviews `appendMemoryEvent()` + tests; on approval, commit SB-025
  atomically (`feat: memory-stream event append (SB-025)`) + push. Then SB-026 (CLI `distill`).

## SB-024 `Done` (Phase 1H, EPIC-CORE-007) — committed + pushed (`ba40614`)
- **SB-024 — L2 distilled-note writer (note-vault). Status:** `In Review` (atomic; awaiting human review →
  commit). **Deps:** SB-019 `Done` (`fd57289`), SB-011 `Done`. **Next story:** SB-025 (`appendMemoryEvent`
  in `@sb/event-log`). Create-only (no edit/supersede — later story).
- **Scope delivered:**
  - New `packages/note-vault/src/distilled-note-writer.ts` — `writeDistilledNote(input)` creates a
    **mutable L2** curated note (`type:distilled`, `layer:2`) under a non-raw folder. Requires `title`
    **and** `source_ref` (distillation provenance rule, stricter than the schema, which only requires
    `title`). Exclusive-create by id (`flag:"wx"`); frontmatter schema-exact for the `distilled` branch;
    `createdAt` defaults to now if omitted.
  - **Folder decision:** the card's `vault/20_Distilled/` is not in the canonical tree; per
    `memory_layers.md` (L2 → PARA + `50_Entities/`/`80_Wiki/`) distilled notes default to
    **`vault/80_Wiki/`** (`DISTILLED_RELATIVE_DIR`), overridable via `dirRelative`. `init_workspace`
    untouched (no new workspace folder).
  - **Safety:** refuses any target resolving under `00_Raw/` (reuses `isRawPath`); refuses a `dirRelative`
    that escapes the workspace; never reads or mutates the referenced L1 source (only records its id).
  - `errors.ts` — new `DistilledNoteWriteError` + `DistilledNoteWriteErrorCode`
    (`invalid_ulid`/`unsafe_path`/`missing_title`/`missing_source_ref`/`already_exists`/`write_failed`).
  - `index.ts` — exports `writeDistilledNote`, `DISTILLED_RELATIVE_DIR`, the input/result types, and the
    new error class + code.
- **No new dependency** (ajv/ajv-formats/yaml used by the test are existing root devDeps, hoisted; the test
  loads them via `createRequire` to avoid ESM/CJS default-import interop errors under the package's
  `verbatimModuleSyntax` + NodeNext `tsc`). No schema change, no `pnpm-lock.yaml` change.
- **Out of scope (SB-024):** CLI, distillation events (SB-025), the skill (SB-027), L3 facts,
  editing/superseding existing L2 notes.
- **Files changed (SB-024):** `packages/note-vault/src/{distilled-note-writer.ts(new),errors.ts,index.ts}`,
  `packages/note-vault/test/distilled-note-writer.test.ts(new)`,
  `packages/note-vault/{package.json,README.md}`, `docs/planning/{story_backlog.md,phase_1_story_map.md}`,
  `STATUS.md`.
- **Validation run (green):** `pnpm --filter @sb/note-vault test` → **33/33** (8 new SB-024 cases: valid L2
  note + schema-validated frontmatter, slug+tags, refuses `00_Raw` target, refuses workspace escape,
  missing/empty title, missing source_ref, non-ULID id + non-ULID source_ref, never-overwrite,
  L1-source-byte-identical); `pnpm --filter @sb/note-vault build` (`tsc --noEmit`) → **exit 0**; root
  `pnpm test` → exit 0 (event-log 5, note-vault 33, cli 14, scripts 12; via a temp `pnpm`→`corepack pnpm`
  PATH shim, as in SB-017); domain-leakage grep on the new files → clean.
- **Next recommended action:** human reviews `writeDistilledNote()` + tests; on approval, commit SB-024
  atomically (`feat: L2 distilled-note writer (SB-024)`) + push. Then SB-025 (memory-stream event append).

## SB-019 `Done` (Phase 1H, EPIC-CORE-007) — committed + pushed (`fd57289`)
- **SB-019 — distillation proposal contract (interfaces). Status:** `In Review` (atomic; awaiting human
  review → commit). **Dep:** SB-010 `Done`. **Next story:** SB-024 (L2 `writeDistilledNote` in
  `@sb/note-vault`). Mirrors the SB-010 capture-contract pattern: **types + operation descriptors only,
  no behavior.**
- **Scope delivered (contracts only):**
  - New `packages/interfaces/src/distillation.ts` — `ProposeDistillationInput` (`source_ids: Ulid[]`),
    `DistillationProposal` (`source_ids`, `title`, `body`, `tags?`, `rationale`), `DistillationResult`
    (`note_id`, `event_id`). Module doc records the invariants the later writer/CLI must enforce: never
    touch `00_Raw/`, never mutate L1 sources, L2 note needs `title` + `source_ref`, accept emits exactly
    one `distillation_accepted` memory event.
  - `scope.ts` — added `write:distill` to `PermissionScope` (distinct from `write:capture`; `write:raw`
    stays in `ALWAYS_DENIED_SCOPES`, so least-privilege holds: distill cannot write capture/raw).
  - `operations.ts` — added `proposeDistillation(input)→DistillationProposal` (read-only) and
    `acceptDistillation(proposal)→DistillationResult` (write) to `CoreOperations`, plus
    `OPERATION_CONTRACTS` entries: `proposeDistillation` `{scope:"read:notes", readOnly:true,
    errors:[not_found,scope_denied,io_error]}`; `acceptDistillation` `{scope:"write:distill",
    readOnly:false, errors:[validation_failed,not_found,raw_immutable,scope_denied,duplicate_id,io_error]}`.
    Reused the existing `InterfaceErrorCode` union (no new codes needed).
  - `index.ts` — re-exports the three new types.
- **No implementation, no new dependency, no schema change.** (`distillation_accepted` MemoryKind already
  existed in `event.ts` from SB-009.)
- **Out of scope (SB-019):** any writer/event/CLI/skill behavior (SB-024..027); L3 facts (Phase 2).
- **Files changed (SB-019):** `packages/interfaces/src/{distillation.ts(new),operations.ts,scope.ts,
  index.ts}`, `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`.
- **Validation run (green):** `@sb/interfaces` `tsc --noEmit` → **exit 0**; throwaway alignment smoke
  (one typed `ProposeDistillationInput` + `DistillationProposal` + `DistillationResult`, `write:distill`
  scope, and `OPERATION_CONTRACTS.{propose,accept}Distillation.readOnly`/`.scope` reads) compiled under
  `--strict --module nodenext` → **exit 0** (temp file removed); domain-leakage grep on the changed files →
  clean (only the pre-existing generic `example-readonly` placeholder in `scope.ts`, never broker).
- **Next recommended action:** human reviews the contract; on approval, commit SB-019 atomically
  (`feat: distillation proposal contract (SB-019)`). Then proceed SB-024 → SB-025 → SB-026 → SB-027.

## Docs (2026-06-05) — media transcription intake convention documented
- **Context:** the standalone `psb-media-transcriber` (live, v0.1.0) writes to its own artifact store
  `~/PersonalSecondBrainMediaArtifacts/` (`<YYYY>/<MM>/<media_id>/` + a `by-name/` symlink view named by
  original video filename). It does **not** write into the vault; integration is a future optional adapter.
- **Documented:** new [`docs/workflows/media_transcription_intake.md`](docs/workflows/media_transcription_intake.md)
  (how transcripts arrive, the by-name convention, binding rules: read-only, provenance via `media_id`,
  idempotent re-ingest, preserve organize-by-name). Added coarse **EPIC-CORE-013 (SB-070–072)** to
  `story_backlog.md` so the adapter is tracked. Transcriber repo README updated with the canonical artifact
  output layout + `by-name/` rule (source of truth).
- **No code/scope change** in the core; docs-only here. No vault writes from transcription until EPIC-CORE-013
  is refined + implemented. **Next story is still SB-019** (Phase 1H distillation contract).

## Phase 1H scheduled — SB-019 split (refinement committed-pending)
- **Decision:** build the minimal human-confirmed distillation workflow now (chosen over folding into
  Phase 2). EPIC-CORE-007 → `In Progress`. **L2-only** (L3 facts moved to Phase 2 / EPIC-CORE-008).
- **Split** of the old `5→split` SB-019 into ≤3-pt atomic stories (cards in `story_backlog.md`,
  sub-phase in `phase_1_story_map.md`):
  - **SB-019** `Ready` (2) — distillation proposal **contract** in `@sb/interfaces` (types + descriptors
    + `write:distill` scope; no impl). Dep SB-010 `Done`.
  - **SB-024** (3) — `writeDistilledNote()` L2 writer in `@sb/note-vault` (never under `00_Raw/`).
  - **SB-025** (2) — `appendMemoryEvent()` memory-stream append in `@sb/event-log` (append-only).
  - **SB-026** (3) — CLI `distill` (`propose` read-only + `accept` human-confirmed write).
  - **SB-027** (2) — `skills/distill/` skill + end-to-end L0/L1 never-mutated safety check.
- **Key design decisions (documented in the map):** skill = agent layer / core = contracts+CLI; proposal
  transport = JSON via stdin/file; L2 distilled note requires `title` + `source_ref`; the distillation path
  is forbidden from touching L0 raw and from mutating L1 sources.
- **Next recommended action:** on approval of this refinement, implement **SB-019** atomically (interfaces
  types + operation descriptors only; `tsc --noEmit` + alignment smoke), set `In Review`, commit
  (`feat: distillation proposal contract (SB-019)`), then proceed SB-024 → SB-025 → SB-026 → SB-027.

## SB-018 `Done` (Phase 1G, EPIC-CORE-001..006) — docs-only, committed + pushed
- **SB-018 — update documentation & STATUS after Phase 1. Status:** `Done` (atomic, docs-only commit).
  **Prev (pushed):** SB-017 `bb650b1`. **Final Phase 1 gate cleared.**
- **Scope delivered (docs only):**
  - `README.md` — status → "**Phase 1 (MVP core) complete**"; **getting-started rewritten** with the real,
    end-to-end-verified flow (`pnpm init:workspace` / `verify:workspace` → `capture` flag+stdin →
    `note list`/`note get` → `validate:notes` → `pnpm test`); scripts map marks `init_workspace` +
    `validate_notes` implemented; distillation deferral noted.
  - `docs/planning/implementation_roadmap.md` — Phase 0 ✅, Phase 1 ✅ (with the SB-019 distillation
    carve-out and "decided: schema v1 / event v1 / ULID").
  - `docs/planning/mvp_scope.md` — acceptance criteria annotated: **AC 1–4, 6 ✅**; **AC 5 (distillation) ⏳
    deferred** (SB-019); distillation in-scope item flagged deferred.
  - `docs/planning/open_questions.md` — **#4 (workspace creation) RESOLVED** (init_workspace; no template
    seeding in Phase 1). (#1–#3 already resolved.)
  - `docs/planning/story_backlog.md` — epic table 1A/1B/1E/1F → `Done`; SB-018 row+card → `In Review`.
  - `docs/planning/phase_1_story_map.md` — Phase 1G status note.
- **Honest carve-out:** the MVP's **human-confirmed distillation skill (SB-019) was never built**, so the
  docs mark it **deferred** to Phase 1H / Phase 2 (pending the scope decision) instead of claiming Phase 1
  is 100% of the original MVP. The capture + validate + read + immutability core is complete.
- **Validation run (green):** getting-started smoke on a throwaway `SECOND_BRAIN_WORKSPACE=/tmp/psb-sb018-demo`
  → init (27 dirs+5 files) → verify OK → capture (flag + stdin) both `ok:true` → `note list` shows both →
  `note get <id>` prints frontmatter+body → `validate:notes` 2/2 valid; `pnpm test` exit 0 (note-vault 24,
  event-log 5, cli 14, scripts 12); domain-leakage grep clean (only generic channels + negative broker test).
  `git diff` is **docs-only** (README + docs/planning/* + STATUS).
- **Next recommended action:** begin **Phase 2 (projections)** — but **first decide the SB-019 distillation
  conflict** (add Phase 1H to build it now vs. fold distillation into Phase 2). Phase 2 epic: EPIC-CORE-008
  (fact-store / entity-graph / task-store + event-log replay); refine + split the `5→split` stories
  (SB-020..023) before implementation.

## SB-017 `In Review` (Phase 1F, EPIC-CORE-006) — implemented + validated, NOT yet committed
- **SB-017 — checks/tests for raw immutability. Status:** `In Review` (atomic; awaiting human review →
  commit). **Prev (pushed):** SB-016 `cdd37b8`. **Next story:** SB-018 (docs/STATUS wrap, Phase 1G).
- **Scope delivered:** new `packages/note-vault/test/raw-immutability-invariant.test.ts` (6 tests) that
  harden the L0 invariant *beyond* SB-012's vault-API cases: (1) `guardRawImmutable` returns the
  operation-specific code (`overwrite_rejected`/`delete_rejected`) for a raw path; (2) it is a **no-op**
  (must NOT throw) for non-raw paths (`00_Inbox`, `10_Working`, `events/*.jsonl`) so L1+ stays editable;
  (3) path traversal that *resolves into* `00_Raw` (`00_Raw/../00_Raw/x.md`) is still guarded; (4) traversal
  that *escapes* to `10_Working` is allowed; (5) slugged raw filenames (`<ULID>--<slug>.md`) are immutable
  too (update+delete refused, bytes unchanged); (6) consolidated invariant — after a real `writeRawNote`,
  re-write / `updateRawNote` / `deleteRawNote` are all refused and bytes are byte-identical (with a control
  guarding the byte-comparison itself).
- **Test wiring:** added the new file to `@sb/note-vault`'s `test` script, and added a **documented root
  `pnpm test`** = `pnpm -r run test && pnpm run test:scripts` (the AC's "documented command"; recursive run
  skips `@sb/interfaces`, which has no test script). The user's Terminal has `pnpm` on PATH, so the nested
  `pnpm -r` resolves; validated in-sandbox via a temporary `pnpm`→`corepack pnpm` PATH shim.
- **No new dependency, no production-code change** — tests + `package.json` test scripts only.
- **Out of scope (SB-017):** OS-level filesystem permissions (the guard is API-level).
- **Files changed (SB-017):** `packages/note-vault/test/raw-immutability-invariant.test.ts` (new),
  `packages/note-vault/package.json` (test script + new file), `package.json` (root `test` script),
  `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`. (No `pnpm-lock.yaml` change.)
- **Validation run (green):** `pnpm test` → **exit 0** — note-vault **24/24** (18 + 6 new), event-log 5/5,
  cli 14/14, scripts 12/12; `pnpm --filter @sb/note-vault build` (`tsc --noEmit`) → exit 0; domain-leakage
  grep on the new test → clean.
- **Next recommended action:** human reviews the immutability tests + the new root `pnpm test`; on approval,
  commit SB-017 atomically (`test: raw immutability checks (SB-017)`) + push. That completes **Phase 1F**;
  next is **Phase 1G / SB-018** (docs/STATUS wrap-up).

## Workflow rule in effect
- **Atomic Story Rule (MANDATORY):** each story is implemented, reviewed, validated, and committed as one
  atomic unit; one atomic commit per reviewed story (only directly-related files); do not start the next
  story until the current one is reviewed and committed; no story > 5 points enters implementation. At every
  stop point STATUS.md records: current story ID, status, files changed, validation run, next action — so an
  interrupted session resumes from `git log` + `STATUS.md` + `story_backlog.md`. Full text:
  `docs/planning/backlog_workflow.md`.

## SB-016 `Done` (Phase 1F, EPIC-CORE-006) — committed + pushed
- **SB-016 — frontmatter validation script. Status:** `Done` (atomic commit + pushed).
  **Prev (pushed):** SB-015 `2736ba3` (Phase 1E complete). **Next story:** SB-017 — raw immutability
  checks/tests (finishes Phase 1F; dep SB-012 `Done`). Invalid fixtures kept inline in the test.
- **Scope delivered:** `scripts/validate_notes.ts` — read-only validator. Scans
  `<workspace>/vault/**/*.md`, parses YAML frontmatter (`yaml`), validates against
  `schemas/markdown/frontmatter.schema.json` v1 with **Ajv 2020 + ajv-formats**. Per-file PASS/FAIL +
  errors and a `checked/valid/invalid` summary. Exit **0** all-valid / **1** invalid / **2** operational
  (unsafe workspace, missing schema, absent/unreadable vault, bad args). `--workspace` override + `--help`;
  workspace safety reuses `resolveWorkspaceConfig` (SB-002). Strictly read-only.
- **Dependencies added (devDependencies):** `ajv` ^8.17.1 (→8.20.0), `ajv-formats` ^3.0.1, `yaml` ^2.5.0
  (→2.9.0) — needed to validate against the real schema (the libraries you sanctioned). `pnpm-lock.yaml`
  updated.
- **Out of scope (SB-016):** auto-fix, mutation, capture, event-log writing, retrieval, AI, sidecars,
  dashboard, Obsidian, broker, DB, schema changes (none were needed).
- **Files changed (SB-016):** `scripts/validate_notes.ts` (implemented), `scripts/validate_notes.test.ts`
  (new — fixtures inline, run via `pnpm test:scripts`), `package.json` (deps + `test:scripts`),
  `pnpm-lock.yaml`, `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`. (Test fixtures
  kept inline rather than under `examples/` so bad-on-purpose notes don't pollute the committed examples.)
- **Validation run (green):** `pnpm install` ok; `pnpm validate:notes -- --help` prints usage;
  `pnpm validate:notes` on a CLI-captured workspace → exit 0; on a seeded-bad workspace → exit 1 with
  per-error detail; `pnpm test:scripts` → **12/12**; note-vault 18/18, event-log 5/5, cli 14/14; cli
  build exit 0; domain-leakage grep → `validate_notes.ts` clean (only pre-existing anti-leakage rules /
  negative tests / deferred-broker docs elsewhere).
- **Next recommended action:** human reviews the validator; on approval, commit SB-016 atomically
  (`feat: frontmatter validation script (SB-016)`) + push. Then SB-017 (immutability checks) finishes Phase 1F.
- **Scope delivered:** `@sb/note-vault` read-only API — `listNotes(workspace,{type?})` → `NoteSummary[]`
  (`id/type/title/layer/path`, ULID-sorted) and `getNote(workspace,id)` → verbatim content;
  `NoteReadError` (`unsafe_path`/`invalid_ulid`/`not_found`/`read_failed`). Frontmatter read via targeted
  field-extraction (no YAML dep); `getNote` returns raw content (correct regardless of frontmatter).
  `@sb/cli` added `note list` / `note get <id>` (reuses capture path-safety via exported
  `resolveSafeWorkspace`). Both commands are READ-ONLY (verified: raw count + event lines unchanged).
- **Note:** the card's "type/folder" filter is implemented as `--type` (schema-backed discriminator);
  folder filtering deferred. **Out of scope (SB-015):** search/retrieval (Phase 3), facts query, mutation.
- **No new dependency.** Fixed a `pnpm run … --` separator bug in the `note` subcommand parser (smoke-caught).
- **Files changed (SB-015):** `packages/note-vault/src/{read-notes.ts(new),errors.ts,index.ts}`,
  `packages/note-vault/{package.json,README.md}`, `packages/note-vault/test/read-notes.test.ts(new)`;
  `apps/cli/src/{note-command.ts(new),index.ts,capture-command.ts}`, `apps/cli/{package.json,README.md}`,
  `apps/cli/test/note-command.test.ts(new)`; `docs/planning/{story_backlog.md,phase_1_story_map.md}`,
  `STATUS.md`. (No `pnpm-lock.yaml` change — no new deps.)
- **Validation run (green):** tests — note-vault **18/18**, event-log 5/5, cli **14/14**; builds —
  note-vault/event-log/cli `tsc --noEmit` exit 0; real CLI smoke (capture → `note list` shows it →
  `note get <id>` prints it; absent id → exit 1); leakage grep → only negative `source:"broker"` tests.
- **Next recommended action:** human reviews the read API + commands; on approval, commit SB-015
  atomically (`feat: read-only note list/get (SB-015)`) + push. That completes Phase 1E → Phase 1F
  (SB-016 frontmatter validation, SB-017 immutability checks).
- **Scope delivered:** `@sb/cli` `capture` — the first end-to-end path. `runCapture()` generates ULID
  note + event ids (dependency-free `src/ulid.ts`), one shared `captured_at`, calls `writeRawNote()`
  (SB-011) then `appendCaptureEvent()` (SB-014), prints `{ok,note_id,note_path,event_id,event_path,
  captured_at}` to stdout. Reads `--content` or stdin. Event payload links back to the raw note
  (`note_id`, relative `note_path`, `source`, `title?`, `tags?`, `ref?`). Structured `CaptureCliError`
  to stderr + non-zero exit. Partial-failure: raw note kept if event append fails.
- **No new dependency:** ULID generated by a local ~30-line spec-compliant generator (validated by
  `@sb/interfaces.isUlid`) to avoid network/offline risk. Workspace path-safety REUSES
  `resolveWorkspaceConfig` (SB-002) + a CLI broad-path guard (rejects `/`, single-segment roots, home
  dir, repo-containing paths) — no duplication.
- **Deviation:** `00_Inbox/` L1 stub NOT created (deferred with SB-011); tracked for a later
  capture-orchestration story. **Out of scope (SB-013):** list/get, validation, retrieval, AI, sidecars,
  dashboard, Obsidian, broker, DB, non-paste adapters.
- **Files changed (SB-013):** `apps/cli/{package.json,tsconfig.json,README.md}`,
  `apps/cli/src/{index.ts,capture-command.ts,ulid.ts}`, `apps/cli/test/capture-command.test.ts`,
  `pnpm-lock.yaml` (new `@sb/cli` importer), `docs/planning/{story_backlog.md,phase_1_story_map.md}`,
  `STATUS.md`. (No `scripts/lib/*` changes — the CLI imports the existing helper as-is.)
- **Validation run (green):** `pnpm install` → ok; tests — note-vault 13/13, event-log 5/5, **cli 9/9**;
  builds — note-vault/event-log/cli `tsc --noEmit` exit 0; real end-to-end smoke (flag + stdin) wrote
  raw notes + event lines, bad source exits 1; domain-leakage grep → only negative `source:"broker"`
  test + anti-leakage assertion + pre-existing rules (CLI source files clean).
- **Next recommended action:** human reviews the capture path; on approval, commit SB-013 atomically
  (`feat: CLI capture command (SB-013)`) + push. Then SB-015 (list/get) to finish Phase 1E.
- **Scope delivered:** `@sb/event-log` with `appendCaptureEvent()` — appends one schema-valid capture
  event as a single JSONL line to `<workspace>/events/capture_events.jsonl`, append-only (fs append mode,
  never truncates). Builds `{stream:"capture",kind:"captured"}`, auto-stamps `recorded_at` +
  `schema_version:"1.0.0"`, validates via dependency-free `validateCaptureEvent` (capture-stream branch
  of event v1) before writing. `EventLogError` codes `unsafe_path`/`invalid_event`/`append_failed`;
  nothing written on validation failure. Caller supplies the `event_id` ULID (runtime ULID generation
  arrives with the CLI, SB-013).
- **Out of scope (SB-014):** memory/projection events; replay/projection rebuild.
- **Files changed (SB-014):** `packages/event-log/{package.json,tsconfig.json,README.md}`,
  `packages/event-log/src/{index.ts,capture-event.ts,validate-event.ts,errors.ts}`,
  `packages/event-log/test/capture-event.test.ts`, `pnpm-lock.yaml` (new `@sb/event-log` importer),
  `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`.
- **Validation run (green):** `pnpm install` → ok; `pnpm --filter @sb/event-log test` → **5/5 pass**
  (one valid line w/ id+ts+actor+source_ref; N events = N lines, ordered, earlier lines unchanged;
  invalid event writes nothing; bad subject_id rejected; relative path rejected);
  `pnpm --filter @sb/event-log build` (`tsc --noEmit`) → exit 0; domain-leakage grep → event-log clean.
- **Next recommended action:** human reviews append semantics + ordering; on approval, commit SB-014
  atomically (`feat: event-log capture append (SB-014)`). That completes Phase 1D → next is Phase 1E
  (SB-013 CLI capture, SB-015 list/get).
- **Scope delivered:** the single guarded path that makes L0 raw immutable via the vault API.
  `guardRawImmutable(workspace, path, op)` throws `RawImmutabilityError` for any path under
  `vault/00_Raw/`; `updateRawNote`/`deleteRawNote` always reject (`overwrite_rejected`/`delete_rejected`)
  and never touch the file. Create-time overwrite is already blocked by the writer's exclusive-create
  (`already_exists`). Extracted `raw-paths.ts` to single-source the raw filename convention (the SB-011
  writer now uses it; behavior unchanged, re-verified by its tests).
- **Out of scope (SB-012):** OS-level filesystem permissions; guarding non-raw (L1+) folders.
- **Files changed (SB-012):** `packages/note-vault/src/{raw-immutability.ts,raw-paths.ts}` (new),
  `packages/note-vault/src/{errors.ts,index.ts,raw-note-writer.ts}` (edited),
  `packages/note-vault/test/raw-immutability.test.ts` (new), `packages/note-vault/package.json` (test
  script runs both files), `packages/note-vault/README.md`, `docs/planning/{story_backlog.md,
  phase_1_story_map.md}`, `STATUS.md`. (No new deps → no `pnpm-lock.yaml` change.)
- **Validation run (green):** `pnpm --filter @sb/note-vault test` → **13/13 pass** (8 SB-011 + 5 SB-012:
  overwrite-rejected+unchanged, updateRawNote rejected+unchanged, delete rejected+file-remains+unchanged,
  new note still creates, `isRawPath` true for 00_Raw / false for 00_Inbox + events);
  `pnpm --filter @sb/note-vault build` (`tsc --noEmit`) → exit 0; domain-leakage grep → only generic
  "client" + anti-leakage rules + the negative `source:"broker"` test (no real leakage).
- **Next recommended action:** human reviews the guard + tests; on approval, commit SB-012 atomically
  (`feat: raw immutability guard (SB-012)`). That completes Phase 1C → next is Phase 1D (SB-014 event append).
- **Scope delivered (narrowed by human instruction):** the **low-level raw write primitive only** —
  `writeRawNote()` in `@sb/note-vault`. Creates an immutable L0 raw note at
  `<workspace>/vault/00_Raw/<ULID>.md` (or `<ULID>--<slug>.md`); frontmatter `id/type:raw/layer:0/created`
  (+ additive `source:{kind,ref}`/`title`/`tags`), schema-exact (no `updated`); body byte-faithful;
  exclusive-create (`flag: wx`) so L0 is never overwritten; structured `RawNoteWriteError` codes.
- **Deferred (NOT done in SB-011):** the `00_Inbox/` L1 stub from the original card AC → moved to capture
  orchestration (recommend SB-013). No event emission (SB-014), no broader immutability guard (SB-012),
  no CLI (SB-013). A raw note has no `source_ref` (it is the origin).
- **Files changed (SB-011):** `packages/note-vault/{package.json,tsconfig.json,README.md}`,
  `packages/note-vault/src/{index.ts,raw-note-writer.ts,errors.ts}`,
  `packages/note-vault/test/raw-note-writer.test.ts`, `pnpm-lock.yaml` (new `@sb/note-vault` importer),
  `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`.
- **Validation run (green):** `pnpm install` → ok; `pnpm --filter @sb/note-vault test` → 8/8 pass
  (creates note under `00_Raw`, ULID/slug filename, `type:raw`+`layer:0`, verbatim body, no-overwrite,
  invalid-ULID rejected, relative-path rejected, unsafe-slug + unknown-source rejected);
  `pnpm --filter @sb/note-vault build` (`tsc --noEmit`) → exit 0; `@sb/interfaces` typecheck → exit 0;
  domain-leakage grep → only generic "client" + anti-leakage rules + the negative test asserting
  `source:"broker"` is rejected (no real leakage).
- **Next recommended action:** human reviews `writeRawNote()` + tests; on approval, commit SB-011
  atomically (`feat: raw note write contract (SB-011)`), then proceed to **SB-012 — raw immutability guard**.
  (`@sb/interfaces` build script substitution: it exposes `typecheck`, not `build` — ran `tsc --noEmit`.)
- **SB-010 (capture interface v0):** scaffolded `@sb/interfaces` (package.json + tsconfig + `src/*`):
  `ids.ts` (branded `Ulid`/`SecureRef`), `note.ts` (per-type `NoteFrontmatter` discriminated union +
  `Note`), `event.ts` (per-stream `Event` union + `Actor`), `capture.ts` (`CaptureRequest`/`CaptureResult`),
  `scope.ts` (`PermissionScope` + least-privilege deny list), `operations.ts` (`CoreOperations` +
  `OPERATION_CONTRACTS` documenting scope/errors per op), `index.ts`. Finalized
  `schemas/json/capture.schema.json` → v1. Types only, no operation implementation.
  Validation: `pnpm -C packages/interfaces tsc --noEmit` → exit 0; throwaway alignment smoke (one typed
  value per note/event/capture type) → exit 0; domain-leakage grep clean (only the generic
  `example-readonly` placeholder, never broker).
- **SB-009 (event v1):** `event.schema.json` v1. Envelope required `event_id(ULID),stream,kind,
  occurred_at,actor`; per-stream kinds via allOf (capture→`captured`; memory→note/fact/entity/
  distillation kinds, subject_id required; projection→`indexed/projection_rebuilt/projection_reset`).
  `actor` = `human|cli|skill:<name>|sidecar:<name>`. APPEND-ONLY documented. Files:
  `schemas/json/event.schema.json`, `examples/captures/events.sample.jsonl`, `.gitignore`
  (scoped `!examples/**/*.jsonl` exception so synthetic fixtures commit while the `*.jsonl` privacy guard
  holds for real data), `open_questions.md` (#2), backlog/STATUS. Validation: ajv over 9 event lines →
  9/9 valid; 5/5 negative cases rejected. OQ #2 resolved.
- **Decision locked (OQ #1, #3):** **ULID** is the canonical immutable `id` for all notes/events/etc.
  (pattern `^[0-7][0-9A-HJKMNP-TV-Z]{25}$`); filename `<ULID>--<slug>.md`; slug may change, id never does.
  ULID is not the retrieval mechanism (metadata/tags/links/entities + indexes are). Per-type layer pins:
  raw=L0 (no `updated`), working=L1 (needs `source_ref`), distilled/entity/concept/case=L2 (need `title`),
  project=L1/L2, daily=L1, output=L5 (needs `title` + non-empty `sources`).
- **Files changed (SB-008):** `schemas/markdown/frontmatter.schema.json` (v1, DRAFT removed),
  `examples/notes/*` (9 example notes, one per type), `docs/planning/open_questions.md` (#1, #3 resolved),
  `docs/planning/story_backlog.md` + `STATUS.md` (bookkeeping).
- **Validation run (green):** ajv (2020-12) over all 9 `examples/notes/*.md` frontmatter → 9/9 valid;
  5/5 negative cases rejected (raw+`updated`, working w/o `source_ref`, output w/o `sources`,
  wrong layer, bad ULID). Validator was a throwaway `/tmp` project (ajv+yaml) — nothing committed.

## Stop point — Phase 1A COMPLETE (SB-007 done)
- **Current story:** SB-007 — `--verify` workspace validation, Phase 1A, EPIC-CORE-001.
- **Status:** `Done` (committed + pushed). **Phase 1A complete — mandatory human review point.**
- **Files changed (SB-007):** `scripts/init_workspace.ts` (`--verify` flag + `verifyWorkspace()`),
  `package.json` (`verify:workspace` alias), `docs/planning/story_backlog.md`,
  `docs/planning/phase_1_story_map.md`, `STATUS.md`.
- **Atomicity:** SB-007 is 2 pts — atomic; behavior in `scripts/init_workspace.ts` + script alias.
- **Behavior:** `--verify` is read-only; asserts all 27 dirs + 5 files present and no unexpected top-level
  entries (dotfiles like `.DS_Store` ignored). Exit 0 if OK, 1 with a per-problem list otherwise.
- **Validation run (all green):**
  - verify before init → FAILED (root missing), exit 1.
  - init then verify → "Workspace OK: 27 directories and 5 files present", exit 0 (also via
    `pnpm run verify:workspace`).
  - verify is read-only (snapshot unchanged).
  - `.DS_Store` at top level → ignored, still OK.
  - missing dir + stray top-level file → 2 problems reported, exit 1; re-init heals → OK again.
  - `tsc --noEmit --strict` (nodenext) on all 3 script files → exit 0.

## Phase 1A summary (all `Done`, atomic commits, pushed)
- **SB-001** (`2d99fe7`): initializer entry + skeleton; Atomic Story Rule formalized.
- **SB-002** (`1c38186`): env loading + path safety.
- **SB-006** (`ccce72a`): canonical `WORKSPACE_PLAN` + `--dry-run`.
- **SB-003** (`eef5fd6`): idempotent directory-tree creation.
- **SB-004** (`46beab1`): empty append-only event files.
- **SB-005** (`74541fb`): workspace READMEs.
- **SB-007** (this commit): `--verify` read-only check.

## Next concrete action
- **STOP for human review of Phase 1A** (init against a throwaway `SECOND_BRAIN_WORKSPACE`, then
  `--verify` green). On approval, begin **Phase 1B — Schema Finalization**, first story **SB-008**
  (frontmatter schema v1). Do not start Phase 1B until approved.

## Open conflict to resolve
- Minimal distillation is in `mvp_scope.md` but not in Phase 1A–1G. See Phase 1H note in
  `phase_1_story_map.md` (add Phase 1H vs. defer to Phase 2).

## Key constraints
- Domain-independent core; broker only under `domain-apps/`, via `interfaces` only.
- Raw (L0) immutable; event log append-only source of truth; indexes disposable.
- No real data in repo (workspace lives outside; created by `scripts/init_workspace.ts`).

## Open questions
See `docs/planning/open_questions.md`.

## Blockers
None. Awaiting human review of Phase 0.
