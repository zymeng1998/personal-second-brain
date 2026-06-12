# apps/obsidian-helper

The **Obsidian companion CLI** (SB-079/080, OQ #34) — deliberately **not** an Obsidian plugin.
It runs as the fixed first-party identity `surface:obsidian-helper` (grant: `write:capture` +
`read:notes` only) and reaches the core exclusively through the enforced dispatch
(`main(argv, io, caller)`), like every other surface. **Obsidian is never the writer of record**:
it edits markdown; everything that counts (L0 raw notes, events, facts) flows through core ops.

## Commands

```bash
obsidian-helper check [--workspace <path>]
# READ-ONLY Obsidian-compat report (exit 1 on findings):
#  - frontmatter structure (fence + required id/type/layer/created) — full schema
#    depth stays with `pnpm validate:notes`
#  - dangling [[wikilinks]] (resolved against note ids + titles)
#  - missing PARA folders (00_Raw … 90_System)

obsidian-helper templates install [--workspace <path>]
# Domain-neutral body-only scaffolds -> vault/90_System/templates/
# (working-note, daily-note, entity-stub). EXCLUSIVE create: existing files are
# never overwritten, only reported as skipped. Templates carry NO frontmatter —
# frontmatter is core-owned; this folder is excluded from note enumeration and
# validation (system assets, not notes). Point Obsidian's "Templates" folder
# setting at 90_System/templates.

obsidian-helper capture --file <draft.md> [--workspace <path>]
# Route a finished draft through the ENFORCED capture op: exactly one L0 raw
# note + one capture event. `title:`/inline `tags:` are lifted from the draft's
# frontmatter when present; the body is captured. The draft file is never
# modified or deleted — keep it or remove it yourself.
```

Workspace resolution mirrors the core CLI: `--workspace` override, else
`SECOND_BRAIN_WORKSPACE` / `.env`.

## Boundary notes

- All note reads/writes go through the enforced dispatch under `surface:obsidian-helper`; an
  ungranted operation fails with `scope_denied` and performs nothing. The single
  direct-filesystem exception is `templates install`'s exclusive-create writes into the one
  fixed `vault/90_System/templates/` folder (system assets) and `check`'s read-only
  folder-presence probes.
- secure_refs locators never appear in helper output (the helper holds no secref scope at all).
