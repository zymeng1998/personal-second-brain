# domain-apps/broker

The **first real domain app** (EPIC-DOMAIN-001) — a rental-broker assistant built **entirely on the
completed core**. It follows the [`example-readonly`](../example-readonly/README.md) binding template
exactly: a fixed `domain-app:broker` identity, grants only from the workspace `config/grants.json`,
and invocation only through the enforced CLI dispatch. **No broker code, schema, type, or vocabulary
lives in the core** (`packages/`, `schemas/`, the vault) — ADR-001/006.

## v1 workflow — client preference tracking

Turn a **pasted client chat export / manual client note** into a normal PSB trail, all through
existing confirmed core paths:

1. **capture** the note verbatim → an immutable **L0** raw note (`source:"import"`).
2. **promote** it → an **L1** working note in `00_Inbox` (reuses `note promote`).
3. **accept** human-reviewed **L3 client-preference facts** (budget band, target areas, bedrooms,
   move-in window, hard constraints) → through the **unchanged** `fact accept` path (confirmation-
   gated; no auto-extraction, no new fact writer, no broker fact schema).
4. **match** (read-only) — read preferences + captured property notes → a ranked summary to stdout.

Broker-specific structure (the preference vocabulary/parser, any local datasets) lives **only** here;
the core stores generic L0/L1 notes and generic L3 facts.

## The binding pattern (same as example-readonly)

1. **Fixed identity.** Every call runs as `domain-app:broker` — declared once in `src/index.ts`,
   validated against `DOMAIN_APP_ID_PATTERN` at load, never configurable, never `cli`/`surface:*`.
2. **Grants come only from the workspace** `config/grants.json` (strict + fail-closed —
   [`grant_config.schema.json`](../../schemas/json/grant_config.schema.json)). The grant is
   **staged per story** (least-privilege), never granted all at once:

   | Story | Adds | Cumulative grant |
   |-------|------|------------------|
   | SB-089 (binding) | `read:notes`, `read:facts` | `[read:notes, read:facts]` |
   | SB-090 (capture) | `write:capture` | `+ write:capture` |
   | SB-091 (promote) | `write:notes` | `+ write:notes` |
   | SB-092 (facts) | `write:facts`, `read:index` | `[read:notes, read:facts, read:index, write:capture, write:notes, write:facts]` |

   The checked-in cumulative sample is [`examples/grants/broker.sample.json`](../../examples/grants/broker.sample.json);
   no config ⇒ no grants ⇒ every operation denied (default-deny). `write:outputs`, `write:secure_refs`,
   `write:distill`, `rebuild:projections`, `write:index`, and `append:events` are **not** in the v1
   grant. `write:raw`, `delete:*`, and `read:secure_refs` (`ALWAYS_DENIED_SCOPES`) can never be
   granted to any caller.
3. **Invocation goes only through the enforced dispatch** — programmatic `main(argv, io, caller)`
   from `@sb/cli`. Broker never imports core packages directly and has no second enforcement path.

## Privacy / synthetic-data policy (OQ #45)

Real workspaces hold real client data; **this repo's tests, fixtures, docs, snapshots, and logs use
synthetic data only** — fictional clients ("Client A"), placeholder areas/budgets, and sentinel
contact handles (e.g. `wechat:REDACTED_SENTINEL`). No real names, phone numbers, emails, apartment
addresses tied to real people, landlord data, signed URLs, secure_ref locators, or private contact
details ever enter the repo. Property media reuses the existing `apps/media-intake` surface — the
broker is a **consumer** that references a `media_id` only; it never stores media binaries and never
writes secure_refs.

## Honesty note: cooperative enforcement

The boundary is **cooperative architectural enforcement** — test-locked discipline (reads work,
every ungranted write is denied with zero filesystem writes, hostile configs fail closed) — not
adversarial sandboxing. The permission model makes integrations safe-by-construction and reviewable.

## Out of scope (OQ #47)

WeChat live sync / auto-send (drafts stay manual paste-export; the broker may draft text for a human
to send, never send), Gmail / Calendar automation, landlord-portal scraping, external-account
integration, auto-send messages, commission / financial calculation, rental-application submission, a
broker note type/schema in the core, and dashboard broker views. Inventory, viewing-schedule prep,
and manager reports are named future work.

## Run

```bash
pnpm --filter @sb-domain/broker test   # the broker smoke/gate tests (also in root pnpm test)
```
