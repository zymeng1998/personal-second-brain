# @sb/entity-graph

Domain-neutral entities (person/org/place/concept) + relations, as a rebuildable projection. Anchors
notes and facts; seeds the graph retrieval index (from `[[wikilinks]]` + relations).

- Status: **Phase 0 — no code.** Phase 2.
- No auto-merge of entities (manual-confirm merges only).
- Domain apps map their concepts (e.g. "client") onto generic entities via `interfaces` — the graph
  itself stays domain-neutral.
