---
name: distill
description: >-
  Human-confirmed distillation of L1 working notes into a curated L2 distilled
  note in the Second Brain. Use when the user asks to "distill", "synthesize",
  "promote to a permanent/evergreen note", or "turn working notes into a
  distilled note". Drafts a proposal, shows it for explicit confirmation, and
  only then writes via the CLI. Never edits or deletes raw (L0) or working (L1)
  source notes.
---

# Distill — human-confirmed L1 → L2

This skill is the **agent workflow layer** for distillation. It is **not** the backend: it never
writes to the vault or the event log directly. All writes go through the `@sb/cli` `distill` command,
which is the only writing step and is always human-confirmed.

## Non-negotiable safety rules

1. **Never mutate L0 raw.** Nothing in this workflow may overwrite, edit, move, or delete any file under
   `vault/00_Raw/`. Raw is immutable source material.
2. **Never mutate L1 sources.** The working notes a distillation derives from are read-only here; you read
   them to synthesize, but you never edit or delete them.
3. **Accept is the only write, and it is human-confirmed.** Do not run `distill accept` until the user has
   seen the exact proposal and explicitly approved it. There is no auto-accept.
4. **Provenance is mandatory.** Every distilled note records the origin id(s) it derived from
   (`source_ids`); the first becomes the L2 note's `source_ref`, and the full list is recorded in the
   `distillation_accepted` memory event.

## Workflow

### 1. Propose (read-only)

List candidate L1 working notes and get a blank proposal scaffold. This writes nothing.

```bash
pnpm --filter @sb/cli distill -- propose [--limit <n>] [--workspace <path>]
```

Output: `{ ok, candidates: [{ id, title? }], proposal: { source_ids, title, body, tags?, rationale } }`.

### 2. Read the sources & draft a proposal

Read the candidate notes you intend to distill (read-only):

```bash
pnpm --filter @sb/cli note -- get <ULID> [--workspace <path>]
```

Then fill the scaffold into a complete `DistillationProposal` JSON:

```json
{
  "source_ids": ["<L1/L0 origin ULID>", "..."],
  "title": "A precise, evergreen title",
  "body": "The synthesized, self-contained distilled note (Markdown).",
  "tags": ["optional", "tags"],
  "rationale": "Why these sources distill into this single L2 note."
}
```

Rules for a good proposal:
- `source_ids` non-empty; each is a real note id from the candidates.
- `title` is required and specific (this is a curated, reusable note).
- `body` is self-contained and traceable back to the sources — interpretation, not raw quotes.

### 3. Confirm with the human

Show the **exact** proposal JSON to the user and ask for explicit approval. If they want changes, edit the
proposal and show it again. **Do not proceed without a clear "yes".**

### 4. Accept (the only write — human-confirmed)

Only after approval, pipe the proposal to `accept` (or pass `--file`):

```bash
cat proposal.json | pnpm --filter @sb/cli distill -- accept [--workspace <path>]
# or
pnpm --filter @sb/cli distill -- accept --file proposal.json [--workspace <path>]
```

This writes exactly one L2 distilled note (`type: distilled`, `layer: 2`, under `vault/80_Wiki/`) and
appends exactly one `distillation_accepted` memory event. Output:
`{ ok, note_id, note_path, event_id, event_path, source_ref, source_ids, created_at }`.

On a bad/missing proposal the command prints `{ ok:false, error:{ code, message } }` to stderr and exits
non-zero (`bad_proposal` / `bad_arguments`); nothing is written. If the note writes but the event append
fails, the L2 note is kept and an `event_append_failed` error (with the note id/path) is returned.

## Out of scope

- L3 facts (Phase 2) — this skill produces distilled L2 notes only.
- Auto-accept or silent writes — always human-confirmed.
- Multi-note synthesis heuristics beyond what the human approves in the proposal.

## Safety check

The end-to-end never-mutate-L0/L1 guarantee is enforced by an automated test
(`apps/cli/test/distill-safety.test.ts`, run under `pnpm test`): it captures an L0 raw note, seeds an L1
working source, runs propose → accept, and asserts the raw bytes and the L1 source bytes are unchanged
while exactly one L2 note and one event are created.
