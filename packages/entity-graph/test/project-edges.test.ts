/**
 * Tests for SB-037: entity edges (from `entities` refs) + manual-confirm
 * `entity_merged`. Edges are deterministic; a merge repoints edges to the
 * canonical node on re-projection; merges are never inferred automatically.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { openProjectionStore } from "@sb/memory-kernel";
import type { EntityEdge, Ulid } from "@sb/interfaces";
import { projectEntities, projectEdges, listEntityEdges, insertEntityEdge, mergeEntities, EntityGraphError } from "../src/index.js";

// Valid ULIDs (Crockford base32, no I/L/O/U).
const A = "01KTE7AAAA0000000000000000";
const B = "01KTE7BBBB0000000000000000";
const C = "01KTE7CCCC0000000000000000";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-entity-edges-"));
  tmpDirs.push(dir);
  return dir;
}

async function seedEntity(ws: string, id: string, title: string, entities: string[] = []): Promise<void> {
  const dir = join(ws, "vault", "50_Entities");
  await mkdir(dir, { recursive: true });
  const entityLines = entities.length > 0 ? `\nentities:\n${entities.map((e) => `  - ${JSON.stringify(e)}`).join("\n")}` : "";
  const fm = `id: ${id}\ntype: entity\nlayer: 2\ntitle: ${JSON.stringify(title)}${entityLines}\ncreated: "2026-06-05T08:00:00Z"`;
  await writeFile(join(dir, `${id}.md`), `---\n${fm}\n---\n\nbody`, "utf8");
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("derives directed edges from entities refs, with provenance", async () => {
  const ws = await makeWorkspace();
  await seedEntity(ws, A, "Acme", [B]);
  await seedEntity(ws, B, "Beta");

  const result = await projectEdges(ws);
  assert.equal(result.count, 1);
  const edges = listEntityEdges(ws);
  assert.equal(edges.length, 1);
  assert.deepEqual(edges[0], { from: A, to: B, kind: "related", source_ref: A });
});

test("skips self-references", async () => {
  const ws = await makeWorkspace();
  await seedEntity(ws, A, "Acme", [A]);
  const result = await projectEdges(ws);
  assert.equal(result.count, 0);
  assert.deepEqual(listEntityEdges(ws), []);
});

test("re-projection is idempotent (deterministic, no duplicates)", async () => {
  const ws = await makeWorkspace();
  await seedEntity(ws, A, "Acme", [B]);
  await seedEntity(ws, B, "Beta");
  await projectEdges(ws);
  const first = listEntityEdges(ws);
  await projectEdges(ws);
  assert.deepEqual(listEntityEdges(ws), first);
});

test("a manual entity_merged repoints edges to the canonical node on re-projection", async () => {
  const ws = await makeWorkspace();
  await seedEntity(ws, A, "Acme", [C]); // A -> C
  await seedEntity(ws, B, "Beta");
  await seedEntity(ws, C, "Cee (dup)");
  await projectEntities(ws); // nodes must exist for the merge existence check

  // before merge: edge A -> C
  await projectEdges(ws);
  assert.deepEqual(listEntityEdges(ws), [{ from: A, to: C, kind: "related", source_ref: A }]);

  // merge C into B (canonical), then re-project: edge repoints A -> B
  await mergeEntities({ workspace: ws, canonical: B, duplicate: C, now: "2026-06-05T12:00:00Z" });
  await projectEdges(ws);
  assert.deepEqual(listEntityEdges(ws), [{ from: A, to: B, kind: "related", source_ref: A }]);
});

test("rejects merging a non-existent entity (never auto-creates)", async () => {
  const ws = await makeWorkspace();
  await seedEntity(ws, A, "Acme");
  await projectEntities(ws);
  await assert.rejects(
    () => mergeEntities({ workspace: ws, canonical: A, duplicate: B }),
    (err: unknown) => err instanceof EntityGraphError && err.code === "merge_target_not_found",
  );
});

test("rejects an invalid merge (self / non-ULID)", async () => {
  const ws = await makeWorkspace();
  await seedEntity(ws, A, "Acme");
  await projectEntities(ws);
  await assert.rejects(
    () => mergeEntities({ workspace: ws, canonical: A, duplicate: A }),
    (err: unknown) => err instanceof EntityGraphError && err.code === "invalid_merge",
  );
  await assert.rejects(
    () => mergeEntities({ workspace: ws, canonical: A, duplicate: "nope" }),
    (err: unknown) => err instanceof EntityGraphError && err.code === "invalid_merge",
  );
});

test("the entity_edges UNIQUE constraint rejects a duplicate edge insert (SB-045)", async () => {
  const ws = await makeWorkspace();
  await seedEntity(ws, A, "Acme", [B]);
  await seedEntity(ws, B, "Beta");
  await projectEdges(ws);

  const store = openProjectionStore(ws);
  try {
    const edge: EntityEdge = { from: A as Ulid, to: B as Ulid, kind: "related", source_ref: A as Ulid };
    assert.throws(() => insertEntityEdge(store, edge), /UNIQUE/i);
    // the deterministic outcome: still exactly one (A -> B) edge
    const count = store.db
      .prepare("SELECT COUNT(*) AS n FROM entity_edges WHERE from_id = ? AND to_id = ?")
      .get(A, B) as { n: number };
    assert.equal(Number(count.n), 1);
  } finally {
    store.close();
  }
});
