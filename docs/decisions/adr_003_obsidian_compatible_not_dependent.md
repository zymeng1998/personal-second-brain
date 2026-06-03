# ADR-003: Obsidian-compatible, not Obsidian-dependent

- **Status:** Accepted (2026-06-03)
- **Deciders:** Mengziyue

## Context

Obsidian offers great ergonomics over Markdown vaults, but coupling the source of truth to one app
(and its plugins) would violate local-first/no-lock-in and block other surfaces (CLI/dashboard/mobile).

## Decision

Obsidian is an **optional editing/reading surface** (Option 2) over a plain local Markdown vault. The
vault uses standard Markdown + YAML + `[[wikilinks]]`, usable with any editor. No core feature depends
on Obsidian or its plugins. An optional `apps/obsidian-helper` may enhance the Obsidian experience but
gets no special access — it calls `interfaces` like any surface.

## Consequences

- Adopt: Obsidian-compatible folder layout, wikilinks, frontmatter, templates.
- Avoid: plugin dependencies, Obsidian-proprietary load-bearing syntax, Obsidian as writer-of-record.
- Surfaces remain swappable; the vault is portable.
- See [`../architecture/obsidian_compatibility.md`](../architecture/obsidian_compatibility.md).
