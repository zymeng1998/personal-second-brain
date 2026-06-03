-- L3 Projection DDL — DRAFT (Phase 0 skeleton). Finalize in Phase 2.
-- These tables are a REBUILDABLE projection: drop and reconstruct from L0-L2 + event-log replay.
-- Domain-neutral only. No broker/domain columns.

-- Structured facts (ADD-only; corrections supersede, never overwrite).
CREATE TABLE IF NOT EXISTS facts (
  id           TEXT PRIMARY KEY,            -- stable id (e.g. ULID)
  statement    TEXT NOT NULL,               -- the fact, in natural language
  subject_id   TEXT,                        -- entity this fact is about (entities.id)
  source_ref   TEXT NOT NULL,               -- provenance: raw/note/event id
  captured_at  TEXT NOT NULL,               -- when first recorded (ISO-8601)
  observed_at  TEXT,                        -- when the fact was true/observed
  confidence   REAL CHECK (confidence >= 0 AND confidence <= 1),
  supersedes   TEXT REFERENCES facts(id),   -- prior fact this corrects (ADD-only)
  created_at   TEXT NOT NULL
);

-- Domain-neutral entities (person/org/place/concept).
CREATE TABLE IF NOT EXISTS entities (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,                -- person | org | place | concept
  name        TEXT NOT NULL,
  note_ref    TEXT,                         -- 50_Entities/ note id
  created_at  TEXT NOT NULL
);

-- Entity relations (also seeds the graph index).
CREATE TABLE IF NOT EXISTS entity_relations (
  id          TEXT PRIMARY KEY,
  from_id     TEXT NOT NULL REFERENCES entities(id),
  to_id       TEXT NOT NULL REFERENCES entities(id),
  relation    TEXT NOT NULL,
  source_ref  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

-- Domain-neutral tasks / next-actions.
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  status      TEXT NOT NULL,                -- open | doing | done | dropped
  note_ref    TEXT,                         -- related note id
  due_at      TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
