/**
 * SB-065 — compose-output workflow safety check: drafting writes nothing; the
 * confirmed create writes one schema-valid L5 note whose sources resolve; a
 * fabricated ULID source fails the whole write leaving the workspace
 * untouched (citations must be real).
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { MEMORY_EVENTS_RELATIVE_PATH } from "@sb/event-log";
import { frontmatterOf } from "@sb/note-vault";
import { runCapture } from "../src/capture-command.js";
import { runFactAdd } from "../src/fact-command.js";
import { OutputCliError, runOutputCreate } from "../src/output-command.js";

const FABRICATED = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-compose-safety-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function outputsDirCount(ws: string): Promise<number> {
  const dir = join(ws, "vault", "60_Outputs");
  return existsSync(dir) ? (await readdir(dir)).length : 0;
}

async function memoryEventCount(ws: string): Promise<number> {
  const path = join(ws, MEMORY_EVENTS_RELATIVE_PATH);
  if (!existsSync(path)) return 0;
  return (await readFile(path, "utf8")).split("\n").filter((l) => l.trim().length > 0).length;
}

function envelope(item: Record<string, unknown>): Record<string, unknown> {
  return { workflow: "compose_output", version: 1, proposed_at: "2026-06-10T12:00:00Z", items: [item] };
}

test("compose-output: drafting writes nothing; create cites resolvable sources; fabricated ids fail whole", async () => {
  const ws = await makeWorkspace();

  // grounded context: one note + one fact, both citable
  const note = await runCapture({ workspace: ws, content: "Descale procedure details.", source: "paste" });
  const fact = await runFactAdd({ statement: "Descale takes 30 min.", sourceRef: note.note_id, workspace: ws });
  const baselineEvents = await memoryEventCount(ws);

  // 1. DRAFTING (pure data, what the skill does) writes nothing
  const draft = envelope({
    title: "Descale runbook",
    sources: [note.note_id, fact.fact_id],
    body: `Run the descale cycle [${fact.fact_id}]; details in the capture [${note.note_id}].`,
  });
  assert.equal(await outputsDirCount(ws), 0, "drafting must not create outputs");
  assert.equal(await memoryEventCount(ws), baselineEvents, "drafting must append no events");

  // 2. a FABRICATED citation fails the whole write — nothing lands
  await assert.rejects(
    runOutputCreate({
      proposal: envelope({ title: "Bad", sources: [note.note_id, FABRICATED], body: "x" }),
      workspace: ws,
    }),
    (e: unknown) => e instanceof OutputCliError && e.code === "source_not_found",
  );
  assert.equal(await outputsDirCount(ws), 0);
  assert.equal(await memoryEventCount(ws), baselineEvents);

  // 3. the CONFIRMED create writes one schema-valid L5 note + one note_created event
  const created = await runOutputCreate({ proposal: draft, workspace: ws });
  assert.equal(await outputsDirCount(ws), 1);
  assert.equal(await memoryEventCount(ws), baselineEvents + 1);

  const text = await readFile(created.note_path, "utf8");
  const fm = frontmatterOf(text);
  assert.equal(fm["type"], "output");
  assert.equal(fm["layer"], 5);
  assert.deepEqual(fm["sources"], [note.note_id, fact.fact_id], "sources cover every cited id");
  // every inline citation in the body is in sources (the skill's cross-check)
  for (const cited of text.match(/\[01[0-9A-HJKMNP-TV-Z]{24}\]/g) ?? []) {
    assert.ok((fm["sources"] as string[]).includes(cited.slice(1, -1)), `cited ${cited} must be in sources`);
  }
});
