---
name: braindump
description: >-
  Loss-free braindump intake for the Second Brain. Use when the user wants to
  "braindump", "dump my thoughts", "get this out of my head", or pastes a long
  unstructured stream of notes. Captures the dump verbatim as immutable L0
  FIRST, then proposes a segmentation into working notes; every promotion is
  human-confirmed and applied via existing CLI commands only. Never alters the
  captured raw.
---

# Braindump — loss-free capture, then human-confirmed organization

This skill is the **agent workflow layer** for unstructured intake. It is **not** the backend: it
never writes to the vault or the event log directly. All writes go through existing, confirmed
`@sb/cli` commands (`capture`, `note promote`).

## Non-negotiable safety rules

1. **Capture first, verbatim, unconditionally.** Before any analysis, the FULL dump is stored as
   one immutable L0 raw note via `sb capture`. Nothing is summarized, reordered, or cleaned before
   capture — loss-free is the point.
2. **The raw is never altered by segmentation.** Organizing happens by creating NEW L1 working
   notes that reference the L0 origin; the captured bytes are immutable.
3. **Every promotion is human-confirmed.** Show the proposed segmentation; only segments the user
   approves become working notes, one confirmed `sb note promote` per segment. No bulk auto-apply.
4. **No new write surface.** This workflow uses only `sb capture` and `sb note promote`. Anything
   else it suggests (facts, distillation, tasks) is a pointer to the dedicated workflow, not a
   write.

## Workflow

### 1. Capture the dump (loss-free, always)

```bash
pnpm --filter @sb/cli capture -- --content "<the full dump, verbatim>" [--title <t>] [--workspace <path>]
```

One L0 raw note + one capture event. Keep the returned `note_id` — every segment cites it.

### 2. Propose a segmentation (writes nothing)

Read the dump back (`sb note get <note_id>`) and draft a `braindump` proposal — a
`proposal.schema.json` envelope (`workflow: "braindump"`, version 1) whose items describe the
segments you recommend promoting:

```json
{
  "workflow": "braindump",
  "version": 1,
  "proposed_at": "<ISO-8601 now>",
  "items": [
    {
      "title": "A specific title for this segment",
      "summary": "One line on what this segment is about",
      "suggested_next": "promote | extract-facts | distill | task"
    }
  ]
}
```

Segmentation rules: segments follow the dump's own topic boundaries (never invent content);
every item names which part of the dump it covers; `suggested_next` is advisory only.

### 3. Confirm with the human

Show the segmentation; the user approves, edits, or drops segments. **Only approved segments
proceed.**

### 4. Promote each approved segment (one confirmed write each)

```bash
pnpm --filter @sb/cli note -- promote <L0 note_id> --title "<approved segment title>" [--workspace <path>]
```

Each promote seeds an editable L1 working note in `vault/00_Inbox/` with `source_ref` = the L0
origin (the promote command never mutates the source). After promoting, the user can edit the
working note down to just its segment — the full dump stays intact in L0.

### 5. Hand off follow-ups

For segments marked `extract-facts` / `distill`, point the user at those skills — do not perform
their writes from here.

## Out of scope

- Auto-promotion or bulk apply without per-segment confirmation.
- Editing the L0 raw or pre-cleaning the dump before capture.
- Fact extraction / distillation / entity creation (dedicated workflows).

## Safety check

Enforced by `apps/cli/test/braindump-safety.test.ts` (run under `pnpm test`): the capture-first
step yields exactly one L0 note + one capture event; proposing a segmentation writes nothing; each
confirmed promote adds exactly one L1 note while the L0 raw stays byte-unchanged.
