# @sb/entity-graph

Domain-neutral entities (person/org/place/concept) + relations, as a rebuildable projection. Anchors
notes and facts; seeds the graph retrieval index (from `[[wikilinks]]` + relations).

- Status: **Phase 2, SB-021 — entity-node projection.** `projectEntities(workspace)` re-derives L3 entity
  nodes from L2 entity notes (`vault/50_Entities/`, `type: entity`) — read via the `@sb/note-vault` API —
  and upserts them into the SQLite `entity_nodes` projection (`@sb/memory-kernel`). Idempotent; each node
  carries `source_ref` provenance. `listEntityNodes(workspace)` reads them back. Throws `EntityGraphError`
  (`invalid_entity_note`). **Not here:** edges + manual `entity_merged` (SB-037).
- No auto-merge of entities (manual-confirm merges only).
- Domain apps map their concepts (e.g. "client") onto generic entities via `interfaces` — the graph
  itself stays domain-neutral.
