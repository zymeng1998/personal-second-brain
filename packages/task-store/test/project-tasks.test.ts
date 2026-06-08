/**
 * Tests for the SB-022 task projection. A note is a task iff its frontmatter has
 * a non-empty `status` AND a `title`. Full-rebuild per run; provenance; status
 * removal drops the task; updated_at carried.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { projectTasks, listTasks } from "../src/index.js";

// Valid ULIDs (Crockford base32, no I/L/O/U).
const T_A = "01KTF7TAAA0000000000000000";
const T_B = "01KTF7TBBB0000000000000000";
const PLAIN = "01KTF7PNNN0000000000000000";
const NOTITLE = "01KTF7NTTT0000000000000000";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-task-store-"));
  tmpDirs.push(dir);
  return dir;
}

async function seedNote(ws: string, folder: string, id: string, frontmatter: string): Promise<void> {
  const dir = join(ws, "vault", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.md`), `---\n${frontmatter}\n---\n\nbody`, "utf8");
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("projects notes with status + title as tasks (id/title/status/source_ref/updated_at)", async () => {
  const ws = await makeWorkspace();
  await seedNote(ws, "10_Projects", T_A, `id: ${T_A}\ntype: project\nlayer: 1\ntitle: "Ship Phase 2"\nstatus: active\nupdated: "2026-06-05T12:00:00Z"\ncreated: "2026-06-01T08:00:00Z"`);
  await seedNote(ws, "10_Projects", T_B, `id: ${T_B}\ntype: project\nlayer: 1\ntitle: "Write docs"\nstatus: done\ncreated: "2026-06-01T08:00:00Z"`);

  const result = await projectTasks(ws);
  assert.equal(result.count, 2);

  const tasks = listTasks(ws);
  assert.equal(tasks.length, 2);
  const a = tasks.find((t) => t.id === T_A)!;
  assert.equal(a.title, "Ship Phase 2");
  assert.equal(a.status, "active");
  assert.equal(a.source_ref, T_A);
  assert.equal(a.updated_at, "2026-06-05T12:00:00Z");
  const b = tasks.find((t) => t.id === T_B)!;
  assert.equal(b.status, "done");
  assert.equal(b.updated_at, undefined);
});

test("notes without a status are not tasks; status notes without a title are skipped", async () => {
  const ws = await makeWorkspace();
  await seedNote(ws, "10_Projects", T_A, `id: ${T_A}\ntype: project\nlayer: 1\ntitle: "A task"\nstatus: active\ncreated: "2026-06-01T08:00:00Z"`);
  await seedNote(ws, "10_Projects", PLAIN, `id: ${PLAIN}\ntype: project\nlayer: 1\ntitle: "No status"\ncreated: "2026-06-01T08:00:00Z"`);
  await seedNote(ws, "10_Projects", NOTITLE, `id: ${NOTITLE}\ntype: working\nlayer: 1\nsource_ref: ${T_A}\nstatus: active\ncreated: "2026-06-01T08:00:00Z"`);

  const result = await projectTasks(ws);
  assert.equal(result.count, 1);
  assert.deepEqual(listTasks(ws).map((t) => t.id), [T_A]);
});

test("re-projection is idempotent", async () => {
  const ws = await makeWorkspace();
  await seedNote(ws, "10_Projects", T_A, `id: ${T_A}\ntype: project\nlayer: 1\ntitle: "A"\nstatus: active\ncreated: "2026-06-01T08:00:00Z"`);
  await projectTasks(ws);
  const first = listTasks(ws);
  await projectTasks(ws);
  assert.deepEqual(listTasks(ws), first);
});

test("removing a note's status drops the task on re-projection (full rebuild)", async () => {
  const ws = await makeWorkspace();
  await seedNote(ws, "10_Projects", T_A, `id: ${T_A}\ntype: project\nlayer: 1\ntitle: "A"\nstatus: active\ncreated: "2026-06-01T08:00:00Z"`);
  await projectTasks(ws);
  assert.equal(listTasks(ws).length, 1);

  // rewrite the same note without a status
  await seedNote(ws, "10_Projects", T_A, `id: ${T_A}\ntype: project\nlayer: 1\ntitle: "A"\ncreated: "2026-06-01T08:00:00Z"`);
  await projectTasks(ws);
  assert.deepEqual(listTasks(ws), []);
});

test("an empty / task-less workspace projects nothing", async () => {
  const ws = await makeWorkspace();
  const result = await projectTasks(ws);
  assert.equal(result.count, 0);
  assert.deepEqual(listTasks(ws), []);
});
