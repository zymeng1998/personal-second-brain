# Obsidian Compatibility

## Decision: optional surface (Option 2)

Obsidian is an **optional editing/reading surface** over a plain local Markdown vault — **not** a core
dependency and **not** avoided. The vault is standard Markdown + YAML frontmatter + `[[wikilinks]]`,
fully usable with any editor. Obsidian is one surface among CLI/dashboard/mobile.

See [`../decisions/adr_003_obsidian_compatible_not_dependent.md`](../decisions/adr_003_obsidian_compatible_not_dependent.md).

## What we adopt (vault stays tool-agnostic)

- **Folder layout** compatible with Obsidian and PARA (`10_Projects` … `90_System`, plus `00_Raw`,
  `00_Inbox`, `50_Entities`, `60_Outputs`, `70_Daily`, `80_Wiki`).
- **`[[wikilinks]]`** for note linking (also drives the graph index later).
- **YAML frontmatter** as the typed metadata layer (validated against `schemas/markdown/`).
- **Templates** under `vault/90_System/` (inspired by jamesmcroft/obsidian-ai-second-brain, MIT).

## What we deliberately avoid

- **No dependency on Obsidian plugins.** Nothing in the core requires Dataview, Templater, Tasks, etc.
  (a future `obsidian-helper` app may *optionally* enhance the Obsidian experience).
- **No Obsidian-proprietary syntax** in source-of-truth notes (keep callouts/embeds optional, not
  load-bearing).
- **Obsidian is never the writer of record** for facts/events — those flow through the core.

## `obsidian-helper` app (post-MVP)

An optional companion (`apps/obsidian-helper/`) to surface core capabilities inside Obsidian (e.g.
capture command, distillation prompts). It calls `packages/interfaces` like any other surface — it
gets no special access to internals.

## Why not a core dependency / why not avoided

- **Not core:** coupling the source of truth to one app violates local-first/no-lock-in and blocks
  CLI/dashboard/mobile surfaces.
- **Not avoided:** Obsidian offers excellent human ergonomics (graph view, linking, mobile) for free
  over the same Markdown vault — valuable as an optional surface.
