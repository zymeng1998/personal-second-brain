# @sb/surfaces

Surface adapters — the ways the human interacts with the brain. Each surface calls `interfaces`; none
gets special access to internals.

- Status: **Phase 0 — no code.** MVP surface is the **CLI** (`apps/cli`).
- Later: Obsidian helper, web dashboard, mobile capture, browser clipper, e-ink.
- Shared surface concerns (formatting, prompts) live here; app shells live under `apps/`.
