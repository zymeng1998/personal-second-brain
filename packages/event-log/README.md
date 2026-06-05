# @sb/event-log

Append-only JSONL event store (`events/{capture,memory,projection}_events.jsonl`). The **source-of-truth
audit + replay spine** — never rewritten; corrections are new events. Distinct from disposable `logs/`.

- Status: **Phase 1D + 1H (SB-014, SB-025) — capture + memory append.** `appendCaptureEvent()` and
  `appendMemoryEvent()` each append one schema-valid event as a single JSONL line to the matching stream,
  append-only (never rewrites/truncates), validated against event v1 before writing.
- Responsibilities (full package, incremental): append events, stream/read events, support replay to
  rebuild projections (Phase 2).
- Events validate against `schemas/json/` via dependency-free validators aligned field-for-field with the
  per-stream branches of `event.schema.json` (`validateCaptureEvent`, `validateMemoryEvent`).

## SB-014 / SB-025 surface (current)

- `appendCaptureEvent(input): Promise<AppendCaptureEventResult>` — builds a `{stream:"capture",
  kind:"captured"}` event (auto-stamps `recorded_at` + `schema_version`), validates it, then appends one
  line to `<workspace>/events/capture_events.jsonl`.
- `appendMemoryEvent(input): Promise<AppendMemoryEventResult>` (SB-025) — builds a `{stream:"memory"}`
  event for the Phase 1H kinds (`note_created` / `distillation_accepted`; `subject_id` required),
  auto-stamps `recorded_at` + `schema_version`, validates, then appends one line to
  `<workspace>/events/memory_events.jsonl`. Append-only.
- Both throw `EventLogError` (`unsafe_path` / `invalid_event` / `append_failed`); nothing is written on a
  validation failure.
- **Not here** (later stories): projection events, replay/projection rebuild, fact events (Phase 2).

Scripts: `pnpm --filter @sb/event-log test`, `… build` (`tsc --noEmit`).

See [`docs/architecture/memory_layers.md`](../../docs/architecture/memory_layers.md).
