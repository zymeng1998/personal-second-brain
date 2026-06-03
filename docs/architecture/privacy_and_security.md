# Privacy & Security

The Second Brain holds your most personal information. These constraints are non-negotiable and apply
to all phases, all surfaces, all sidecars, and all domain apps.

## Data handling rules

1. **No real personal data in the repo.** Real notes/captures/events/attachments live in the external
   workspace (`SECOND_BRAIN_WORKSPACE`), never committed.
2. **No real client data, emails, WeChat chats, passports, visas, bank statements, paystubs, tax forms,
   IDs, or private documents — ever — in the repo.**
3. **Sensitive documents live outside the vault** in external secure storage. The Second Brain stores
   only **metadata + a secure reference** (`secure_refs/`), not the raw sensitive document.
4. **AI-generated summaries must link back** to the raw source notes/events used.
5. **Human-in-the-loop.** AI suggests; the human approves changes.
6. **AI never overwrites raw capture** (L0) and **never auto-deletes** notes.
7. **AI never silently mutates facts** — every fact change carries provenance (source ref + timestamp +
   confidence) and is ADD-only.
8. **Domain apps get no unrestricted access by default** — least-privilege scopes via `interfaces`.
9. **Permission scopes** are designed now and enforced in a later phase (see interface contracts).

## `secure_refs/` pattern

Instead of storing a sensitive file, store a pointer:

```yaml
# secure_refs/<id>.md  (frontmatter only; no sensitive content)
id: secref_2026_0001
kind: identity_document        # e.g. passport, bank_statement, lease
location: external             # external secure storage, NOT this repo/workspace vault
locator: "vault://external/keychain-or-encrypted-volume/ref"   # opaque pointer
captured_at: 2026-06-03
notes: "metadata only — no document contents here"
```

The vault/notes reference `secref_...` ids; the actual bytes never enter the system.

## Defense-in-depth in `.gitignore`

The repo `.gitignore` blocks workspace paths, `.env`, `secure_refs/`, `*.sqlite`/`*.duckdb`/`*.jsonl`,
common sensitive document patterns, and logs — in case a workspace is ever accidentally nested in the repo.

## Open-source license safety

> **Do not copy source code from AGPL, GPL, unspecified-license, or unclear-license repositories.
> Reference architecture and ideas only unless license compatibility is verified.**

Applies especially to **Khoj** (AGPL-3.0), **flepied** (GPL-3.0), **sspaeti** (unspecified), and
**coleam00** (no stated license). Apache-2.0/MIT references (mem0, ReMe, eugeniughelbur, COG,
jamesmcroft) may be reused with attribution.

## Secrets

Never hardcode secrets. Use `.env` (gitignored) or a secret manager. AI provider keys are optional and
unused in Phase 0/1.

## Event-log integrity

Event logs are append-only and never rewritten. Corrections are new events. This preserves an auditable
history of what the system (and any AI) did.
