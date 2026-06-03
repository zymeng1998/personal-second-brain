# @sb/note-vault

Read/write the Markdown + YAML-frontmatter vault. Owns PARA conventions and the **raw-immutability
guard** (`vault/00_Raw/` is never overwritten or deleted).

- Status: **Phase 0 — no code.** MVP package (Phase 1).
- Responsibilities: load/save notes, validate frontmatter against `schemas/markdown/`, enforce
  folder conventions, guard L0 raw immutability.
- Never owns retrieval/indexing (that's the sidecar) and never holds domain concepts.

See [`docs/architecture/memory_layers.md`](../../docs/architecture/memory_layers.md).
