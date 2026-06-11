---
name: extract-facts
description: >-
  Human-confirmed extraction of L3 facts from notes in the Second Brain. Use
  when the user asks to "extract facts", "pull out the facts", "add this to the
  fact store", or "what facts does this note assert". Drafts an extract_facts
  proposal with full provenance, surfaces near-duplicate facts, shows the exact
  proposal for explicit confirmation, and only then writes via `sb fact accept`.
  Never edits or deletes any source note.
---

# Extract facts — human-confirmed note → L3 facts

This skill is the **agent workflow layer** for fact extraction. It is **not** the backend: it never
writes to the vault, the event log, or the projection db directly. All writes go through the
`@sb/cli` `fact accept` command — the only writing step, always human-confirmed.

## Non-negotiable safety rules

1. **Never mutate any source note.** L0 raw and L1/L2 sources are read-only here; you read them to
   extract, you never edit, move, or delete them.
2. **Accept is the only write, and it is human-confirmed.** Do not run `fact accept` until the user
   has seen the exact proposal JSON and explicitly approved it. There is no auto-accept.
3. **Provenance is mandatory.** Every proposed fact carries `source_ref` (the ULID of the note it
   was extracted from), `observed_at`, and a `confidence` in [0, 1]. A fact you cannot source does
   not go in the proposal.
4. **No auto-dedupe (OQ #23).** You must surface near-duplicates to the human; the human decides
   add / supersede / skip per item. Never silently drop or merge.

## Workflow

### 1. Read the source notes (read-only)

```bash
pnpm --filter @sb/cli note -- get <ULID> [--workspace <path>]
```

### 2. Check for near-duplicate facts (read-only)

Before proposing, look for existing facts the new ones might duplicate or correct:

```bash
pnpm --filter @sb/cli fact -- list [--source-ref <ULID>] [--workspace <path>]
pnpm --filter @sb/cli query -- "<key phrase from the candidate fact>" [--workspace <path>]
```

For every near-duplicate found, annotate the affected proposal item when you present it: recommend
**add** (genuinely new), **supersede** (set the item's `supersedes` to the existing fact id), or
**skip** (drop the item). The human picks.

### 3. Draft the proposal

A `proposal.schema.json` `extract_facts` envelope (version 1):

```json
{
  "workflow": "extract_facts",
  "version": 1,
  "proposed_at": "<ISO-8601 now>",
  "items": [
    {
      "statement": "One atomic, domain-neutral assertion.",
      "source_ref": "<ULID of the note it came from>",
      "observed_at": "<ISO-8601 when the fact held>",
      "confidence": 0.9,
      "supersedes": "<existing fact ULID — only if the human picked supersede>"
    }
  ]
}
```

Rules for good items: one assertion per item (no compound statements); `statement` is
self-contained (readable without the source open); `confidence` reflects extraction certainty, not
importance; `observed_at` is when the fact held, not when you extracted it.

### 4. Confirm with the human

Show the **exact** proposal JSON (with your per-item duplicate annotations) and ask for explicit
approval. If they want changes, edit and show it again. **Do not proceed without a clear "yes".**

### 5. Accept (the only write — human-confirmed)

```bash
pnpm --filter @sb/cli fact -- accept --file proposal.json [--workspace <path>]
```

The whole file is validated first — an invalid file writes **nothing**. Each accepted item appends
one `fact_added` (or `fact_superseded`) memory event and one projection row. Output:
`{ ok, written, fact_ids, failed: [{ index, code, message }] }`; a non-empty `failed` exits
non-zero — report it to the user verbatim.

## Out of scope

- Auto-accept, batch/scheduled extraction, auto-dedupe.
- Editing notes (use the distill workflow for synthesis).
- Entity extraction (entities are vault-derived; see `sb rebuild`).

## Safety check

The end-to-end no-write-without-accept guarantee is enforced by an automated test
(`apps/cli/test/extract-safety.test.ts`, run under `pnpm test`): drafting a proposal writes nothing
anywhere; accepting writes exactly the proposal's items with provenance while every source note
stays byte-unchanged.
