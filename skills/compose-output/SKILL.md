---
name: compose-output
description: >-
  Human-confirmed composition of L5 output notes (drafts, reports, summaries,
  plans) in the Second Brain. Use when the user asks to "write up", "draft a
  report/summary/email", "compose", or "turn my notes into a document".
  Grounds the draft in retrieval (`sb query`), cites every claim-bearing
  section, shows the exact proposal for explicit confirmation, and only then
  writes via `sb output create`. Outputs without sources are never written.
---

# Compose output — retrieval-grounded, cited, human-confirmed L5

This skill is the **agent workflow layer** for generated outputs. It is **not** the backend: it
never writes to the vault or the event log directly. The only write is `sb output create` over a
proposal the human has approved.

## Non-negotiable safety rules

1. **No uncited claims.** Every claim-bearing section of the body must map to a source you actually
   read (`[<ULID>]` inline citations). If you cannot source a claim, either drop it or mark it
   explicitly as the user's own assertion and ask.
2. **`sources` covers every cited id.** The proposal's `sources` array lists every note/fact id the
   body cites (plus any link-style references). The CLI refuses an output without sources — and it
   resolves ULID sources, so a fabricated id fails the write.
3. **Create is the only write, and it is human-confirmed.** Do not run `output create` until the
   user has seen the exact proposal (title, sources, full body) and explicitly approved it.
4. **Outputs are L5 — derived, editable, never authoritative.** Never present an output as a
   source of truth; facts stay in L3, sources stay in L0–L2.

## Workflow

### 1. Gather grounded context (read-only)

```bash
pnpm --filter @sb/cli query -- "<topic>" [--k <n>] [--mode lexical|vector|hybrid] [--workspace <path>]
pnpm --filter @sb/cli note -- get <ULID> [--workspace <path>]
pnpm --filter @sb/cli fact -- list [--source-ref <ULID>] [--workspace <path>]
```

Hybrid is the default query mode; when the retrieval sidecar env is absent, fall back to
`--mode lexical` after `sb index`, or to direct `note list`/`note get` reads. Read every note you
intend to cite — never cite from a snippet alone.

### 2. Draft the proposal

A `proposal.schema.json` `compose_output` envelope (version 1, exactly one item):

```json
{
  "workflow": "compose_output",
  "version": 1,
  "proposed_at": "<ISO-8601 now>",
  "items": [
    {
      "title": "A precise title for the deliverable",
      "sources": ["<every cited note/fact ULID>", "<optional [[links]]>"],
      "body": "The draft (Markdown). Claim-bearing sections carry [<ULID>] citations.",
      "tags": ["optional"]
    }
  ]
}
```

Cross-check before presenting: every `[<ULID>]` in the body appears in `sources`, and every ULID in
`sources` was actually read in step 1.

### 3. Confirm with the human

Show the **exact** proposal (title, sources, full body). Iterate until they approve. **Do not
proceed without a clear "yes".**

### 4. Create (the only write — human-confirmed)

```bash
pnpm --filter @sb/cli output -- create --file proposal.json [--workspace <path>]
```

Writes exactly one L5 note under `vault/60_Outputs/` (`type: output`, `layer: 5`, schema-required
non-empty `sources`) and appends exactly one `note_created` memory event. ULID sources that resolve
to neither a note nor a current fact fail the whole write (`source_not_found` — nothing written).
The human edits the written note freely afterwards (L5 is editable by design).

## Out of scope

- Answer-generation as a service / batch composition (interactive only).
- Templates library; multi-output campaigns.
- Mutating sources, facts, or anything outside `vault/60_Outputs/`.

## Safety check

Enforced by `apps/cli/test/compose-output-safety.test.ts` (run under `pnpm test`): drafting writes
nothing; the accepted output is schema-valid with non-empty resolvable sources; an uncited
(fabricated) ULID source fails the write leaving the workspace untouched.
