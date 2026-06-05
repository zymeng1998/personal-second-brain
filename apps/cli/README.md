# cli (app)

The **MVP surface**. Command-line capture into the vault + event log, plus read/list and the
human-confirmed distillation workflow.

- Status: **Phase 1E + 1H, SB-013 + SB-015 + SB-026.** `capture` (CLI input → raw note + capture event),
  the read-only `note list` / `note get <id>`, and the human-confirmed `distill propose` / `distill accept`.
- Calls the vault/event-log package APIs and the `@sb/interfaces` contract types (no direct fs in commands).
- Planned commands (MVP, incremental): `capture` ✅, `note list` ✅, `note get` ✅, `distill` ✅.

## `note list` / `note get` (SB-015, read-only)

```bash
pnpm --filter @sb/cli note -- list [--type raw] [--workspace <path>]
pnpm --filter @sb/cli note -- get <ULID> [--workspace <path>]
```

`note list` prints one `id\ttype\ttitle` line per note (sorted by id); `note get <id>` prints the note's
verbatim markdown. Both are **read-only** (never write to the vault/events) and reuse the same workspace
safety as `capture`. Errors print `{ ok:false, error:{ code, … } }` to stderr with a non-zero exit
(`bad_arguments` for a missing id, `not_found` / `invalid_ulid` from the read API).

## `capture` (SB-013)

```bash
pnpm --filter @sb/cli capture -- --content "hello world" --source paste
echo "hello world" | pnpm --filter @sb/cli capture -- --source paste
```

Flags: `--content`, `--source` (paste|email|wechat|ocr|voice|clip|import; MVP: paste), `--title`,
`--tag` (repeatable / comma-separated), `--ref`, `--slug`, `--workspace` (else `SECOND_BRAIN_WORKSPACE`),
`--help`. Generates ULID note + event ids, writes `vault/00_Raw/<ULID>[--<slug>].md` and appends one line
to `events/capture_events.jsonl`, then prints `{ ok, note_id, note_path, event_id, event_path,
captured_at }`. On error prints `{ ok:false, error:{ code, message, … } }` to stderr and exits non-zero.
Refuses unsafe workspaces (missing/relative/inside-repo/home/`/`/too-broad). If the note writes but the
event append fails, the raw note is kept and a `event_append_failed` error (with the note id/path) is returned.

**Not in SB-013:** `note get`/`note list`, frontmatter validation, retrieval, AI, distillation, non-paste
adapters, and the `00_Inbox/` L1 stub (deferred with SB-011; tracked for a later orchestration story).

## `distill` (SB-026, human-confirmed L1 → L2)

```bash
pnpm --filter @sb/cli distill -- propose [--limit <n>] [--workspace <path>]
pnpm --filter @sb/cli distill -- accept --file proposal.json [--workspace <path>]
cat proposal.json | pnpm --filter @sb/cli distill -- accept [--workspace <path>]
```

- `distill propose` — **READ-ONLY**. Lists L1 working-note candidates and prints a blank
  `DistillationProposal` scaffold (`{ ok, candidates, proposal }`). Writes nothing.
- `distill accept` — **the only writing step**, always human-invoked. Reads a completed proposal JSON from
  `--file`/stdin, generates L2 + event ULIDs, calls `writeDistilledNote()` (SB-024) then
  `appendMemoryEvent('distillation_accepted')` (SB-025), and prints
  `{ ok, note_id, note_path, event_id, event_path, source_ref, source_ids, created_at }`. The proposal's
  first `source_ids` entry becomes the note's `source_ref`; the full list is recorded in the event payload.
  Partial failure: if the event append fails after the note is written, the L2 note is kept and an
  `event_append_failed` error is returned. Bad/missing proposal → `bad_proposal` / `bad_arguments` to
  stderr with a non-zero exit. The LLM that authors the proposal is the skill (SB-027), not this command.

Scripts: `pnpm --filter @sb/cli test`, `… build` (`tsc --noEmit`), `… capture -- <flags>`,
`… distill -- <propose|accept> <flags>`.
