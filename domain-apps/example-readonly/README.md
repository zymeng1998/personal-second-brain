# domain-apps/example-readonly

The **generic read-only example domain app** (SB-061) — and the **binding template** every future
domain app must follow. It is deliberately domain-neutral (never broker; ADR-001): it lists notes,
reads one note, and lists facts. Nothing else.

## The binding pattern (template for all domain apps)

1. **Fixed identity.** Every call runs as `domain-app:example-readonly` — declared once in
   `src/index.ts`, validated against `DOMAIN_APP_ID_PATTERN` at load, never configurable, never
   `cli`. Reserved first-party identities (`cli`, `sidecar:*`, `skill:*`) are unrepresentable in
   the grant config by construction.

2. **Grants come only from the workspace.** The target workspace's `config/grants.json`
   (see [`grant_config.schema.json`](../../schemas/json/grant_config.schema.json), strict +
   fail-closed) must grant this app its scopes. This app needs exactly:

   ```json
   {
     "version": 1,
     "grants": [
       { "app": "domain-app:example-readonly", "allow": ["read:notes", "read:facts"] }
     ]
   }
   ```

   The checked-in copy lives at [`examples/grants/grants.sample.json`](../../examples/grants/grants.sample.json).
   No config file ⇒ no grants ⇒ every operation is denied (default-deny). A malformed config —
   including duplicate app entries — rejects the WHOLE file and fails closed.

3. **Invocation goes only through the enforced CLI dispatch** (OQ #30): programmatic
   `main(argv, io, caller)` from `@sb/cli`. Domain apps never import core packages
   (note-vault, event-log, …) directly and never get a second enforcement path. A scope the
   config does not grant ⇒ structured `scope_denied`, non-zero exit, nothing performed.
   `write:raw`, `delete:*`, and `read:secure_refs` can never be granted to any caller, through
   any config.

## Honesty note: cooperative enforcement

This is a local, single-process system. The boundary is **cooperative architectural
enforcement** — test-locked discipline (the smoke test proves reads work, every write form is
denied with zero filesystem writes, and hostile configs fail closed) — **not adversarial
sandboxing**. A malicious process with filesystem access could bypass any in-process check; the
permission model exists to make integrations safe-by-construction and reviewable, not to contain
malware.

## Run

```bash
pnpm --filter @sb-domain/example-readonly test   # the SB-061 smoke test (also in root pnpm test)
```
