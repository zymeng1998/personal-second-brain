# cli (app)

The **MVP surface**. Command-line capture into the vault + event log, plus read/list and the
human-confirmed distillation workflow.

- Status: **Phase 1E, SB-013 — `capture` only.** End-to-end capture: CLI input → `writeRawNote()`
  (L0 raw note) → `appendCaptureEvent()` (capture event) → structured JSON result.
- Calls the vault/event-log package APIs (no direct fs in the command).
- Planned commands (MVP, incremental): `capture` ✅, `note get`, `note list`, `distill`.

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

Scripts: `pnpm --filter @sb/cli test`, `… build` (`tsc --noEmit`), `… capture -- <flags>`.
