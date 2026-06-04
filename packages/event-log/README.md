# @sb/event-log

Append-only JSONL event store (`events/{capture,memory,projection}_events.jsonl`). The **source-of-truth
audit + replay spine** — never rewritten; corrections are new events. Distinct from disposable `logs/`.

- Status: **Phase 1D, SB-014 — capture-event append only.** `appendCaptureEvent()` appends one
  schema-valid capture event as a single JSONL line to `<workspace>/events/capture_events.jsonl`,
  append-only (never rewrites/truncates), validated against event v1 before writing.
- Responsibilities (full package, incremental): append events, stream/read events, support replay to
  rebuild projections (Phase 2).
- Events validate against `schemas/json/` (SB-014 uses a dependency-free `validateCaptureEvent` aligned
  field-for-field with the capture-stream branch of `event.schema.json`).

## SB-014 surface (current)

- `appendCaptureEvent(input): Promise<AppendCaptureEventResult>` — builds a `{stream:"capture",
  kind:"captured"}` event (auto-stamps `recorded_at` + `schema_version`), validates it, then appends one
  line. Throws `EventLogError` (`unsafe_path` / `invalid_event` / `append_failed`); nothing is written on
  a validation failure.
- **Not here** (later stories): memory/projection events, replay/projection rebuild (Phase 2).

Scripts: `pnpm --filter @sb/event-log test`, `… build` (`tsc --noEmit`).

See [`docs/architecture/memory_layers.md`](../../docs/architecture/memory_layers.md).
