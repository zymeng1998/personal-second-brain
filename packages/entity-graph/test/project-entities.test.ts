/**
 * Tests for the SB-021 entity-node projection. Projects L2 entity notes into the
 * entity_nodes table; idempotent; provenance to the source note; non-entity notes
 * ignored; missing-title rejected.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { projectEntities, listEntityNodes, EntityGraphError } from "../src/index.js";

// Valid ULIDs (Crockford base32, no I/L/O/U).
const ACME = "01KTE7ACME0000000000000000";
const GLOBEX = "01KTE7GBEX0000000000000000";
const WORKING = "01KTE7WRKN0000000000000000";
const NOTITLE = "01KTE7NTTX0000000000000000";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-entity-graph-"));
  tmpDirs.push(dir);
  return dir;
}

async function seedNote(ws: string, folder: string, id: string, frontmatter: string, body = "body"): Promise<void> {
  const dir = join(ws, "vault", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.md`), `---\n${frontmatter}\n---\n\n${body}`, "utf8");
}

async function seedEntity(ws: string, id: string, title: string, aliases?: string[]): Promise<void> {
  const aliasLines = aliases ? `\naliases:\n${aliases.map((a) => `  - ${JSON.stringify(a)}`).join("\n")}` : "";
  await seedNote(ws, "50_Entities", id, `id: ${id}\ntype: entity\nlayer: 2\ntitle: ${JSON.stringify(title)}${aliasLines}\ncreated: "2026-06-05T08:00:00Z"`);
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("projects each entity note to one node with id/title/aliases + provenance", async () => {
  const ws = await makeWorkspace();
  await seedEntity(ws, ACME, "Acme Corp", ["Acme", "ACME"]);
  await seedEntity(ws, GLOBEX, "Globex");

  const result = await projectEntities(ws);
  assert.equal(result.count, 2);

  const nodes = listEntityNodes(ws);
  assert.equal(nodes.length, 2);
  const acme = nodes.find((n) => n.id === ACME)!;
  assert.equal(acme.title, "Acme Corp");
  assert.deepEqual(acme.aliases, ["Acme", "ACME"]);
  assert.equal(acme.source_ref, ACME); // provenance to its source note
  const globex = nodes.find((n) => n.id === GLOBEX)!;
  assert.equal(globex.title, "Globex");
  assert.equal(globex.aliases, undefined);
});

test("re-projection is idempotent (same rows, no duplicates)", async () => {
  const ws = await makeWorkspace();
  await seedEntity(ws, ACME, "Acme Corp", ["Acme"]);
  await projectEntities(ws);
  const first = listEntityNodes(ws);
  await projectEntities(ws);
  const second = listEntityNodes(ws);
  assert.equal(second.length, 1);
  assert.deepEqual(second, first);
});

test("non-entity notes are ignored", async () => {
  const ws = await makeWorkspace();
  await seedEntity(ws, ACME, "Acme Corp");
  await seedNote(ws, "10_Projects", WORKING, `id: ${WORKING}\ntype: working\nlayer: 1\nsource_ref: ${ACME}\ncreated: "2026-06-05T08:00:00Z"`);

  const result = await projectEntities(ws);
  assert.equal(result.count, 1);
  assert.deepEqual(listEntityNodes(ws).map((n) => n.id), [ACME]);
});

test("an entity note without a title is rejected", async () => {
  const ws = await makeWorkspace();
  await seedNote(ws, "50_Entities", NOTITLE, `id: ${NOTITLE}\ntype: entity\nlayer: 2\ncreated: "2026-06-05T08:00:00Z"`);
  await assert.rejects(
    () => projectEntities(ws),
    (err: unknown) => err instanceof EntityGraphError && err.code === "invalid_entity_note",
  );
});

test("a deleted entity note drops its stale node on standalone re-projection (SB-045)", async () => {
  const ws = await makeWorkspace();
  await seedEntity(ws, ACME, "Acme Corp");
  await seedEntity(ws, GLOBEX, "Globex");
  await projectEntities(ws);
  assert.equal(listEntityNodes(ws).length, 2);

  await rm(join(ws, "vault", "50_Entities", `${GLOBEX}.md`));
  const result = await projectEntities(ws);

  assert.equal(result.count, 1);
  assert.deepEqual(listEntityNodes(ws).map((n) => n.id), [ACME]);
});

test("an empty / entity-less workspace projects nothing", async () => {
  const ws = await makeWorkspace();
  const result = await projectEntities(ws);
  assert.equal(result.count, 0);
  assert.deepEqual(listEntityNodes(ws), []);
});
