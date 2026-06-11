/**
 * Tests for the SB-059 `sb output create` command: one reviewed compose_output
 * proposal -> one L5 note (vault/60_Outputs/) + one note_created memory event.
 * Source resolution (OQ #24): ULID sources must be a note or a current fact;
 * failures write NOTHING. Event-append failure keeps the note (SB-053 mirror).
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { MEMORY_EVENTS_RELATIVE_PATH } from "@sb/event-log";
import { runCapture } from "../src/capture-command.js";
import { runFactAdd } from "../src/fact-command.js";
import { OutputCliError, runOutputCreate } from "../src/output-command.js";
import { main } from "../src/index.js";

const UNKNOWN_ULID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-output-cli-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function memoryEvents(ws: string): Promise<Array<Record<string, unknown>>> {
  const path = join(ws, MEMORY_EVENTS_RELATIVE_PATH);
  if (!existsSync(path)) return [];
  const raw = await readFile(path, "utf8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function proposal(item: Record<string, unknown>): Record<string, unknown> {
  return { workflow: "compose_output", version: 1, proposed_at: "2026-06-10T12:00:00Z", items: [item] };
}

test("creates one L5 note + one note_created event from a reviewed proposal", async () => {
  const ws = await makeWorkspace();
  const captured = await runCapture({ workspace: ws, content: "Espresso notes.", source: "paste" });
  const fact = await runFactAdd({ statement: "Descale takes 30 min.", sourceRef: captured.note_id, workspace: ws });

  const result = await runOutputCreate({
    proposal: proposal({
      title: "Maintenance summary",
      sources: [captured.note_id, fact.fact_id, "[[Maintenance log]]"],
      body: `Descale takes 30 minutes [${fact.fact_id}].`,
      tags: ["maintenance"],
    }),
    workspace: ws,
    now: "2026-06-10T13:00:00Z",
  });
  assert.equal(result.ok, true);
  assert.ok(result.note_path.includes(join("vault", "60_Outputs")));

  const text = await readFile(result.note_path, "utf8");
  assert.match(text, /^type: output$/m);
  assert.match(text, /^layer: 5$/m);
  assert.match(text, new RegExp(captured.note_id));

  const events = await memoryEvents(ws);
  const created = events.filter((e) => e["kind"] === "note_created");
  assert.equal(created.length, 1);
  assert.equal(created[0]?.["event_id"], result.event_id);
  assert.equal(created[0]?.["subject_id"], result.note_id);
});

test("an unresolvable ULID source writes NOTHING (no note, no event)", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    runOutputCreate({
      proposal: proposal({ title: "t", sources: [UNKNOWN_ULID], body: "b" }),
      workspace: ws,
    }),
    (e: unknown) => e instanceof OutputCliError && e.code === "source_not_found",
  );
  assert.equal(existsSync(join(ws, "vault", "60_Outputs")), false);
  assert.equal((await memoryEvents(ws)).length, 0);
});

test("invalid proposals are rejected writing nothing", async () => {
  const ws = await makeWorkspace();
  const bad: unknown[] = [
    { workflow: "extract_facts", version: 1, proposed_at: "2026-06-10T12:00:00Z", items: [{}] },
    proposal({ title: "", sources: ["x"], body: "b" }),
    proposal({ title: "t", sources: [], body: "b" }),
    proposal({ title: "t", sources: ["x"] }), // no body
    { ...proposal({ title: "t", sources: ["x"], body: "b" }), items: [] },
    {
      workflow: "compose_output",
      version: 1,
      proposed_at: "2026-06-10T12:00:00Z",
      items: [
        { title: "a", sources: ["x"], body: "" },
        { title: "b", sources: ["y"], body: "" },
      ],
    },
  ];
  for (const p of bad) {
    await assert.rejects(
      runOutputCreate({ proposal: p, workspace: ws }),
      (e: unknown) => e instanceof OutputCliError && e.code === "invalid_proposal",
    );
  }
  assert.equal(existsSync(join(ws, "vault")), false);
  assert.equal((await memoryEvents(ws)).length, 0);
});

test("L0 raw stays byte-unchanged across an output create", async () => {
  const ws = await makeWorkspace();
  const captured = await runCapture({ workspace: ws, content: "Source note.", source: "paste" });
  const rawDir = join(ws, "vault", "00_Raw");
  const rawFile = (await readdir(rawDir))[0] as string;
  const before = await readFile(join(rawDir, rawFile), "utf8");

  await runOutputCreate({
    proposal: proposal({ title: "Out", sources: [captured.note_id], body: "Body." }),
    workspace: ws,
  });
  assert.equal(await readFile(join(rawDir, rawFile), "utf8"), before);
});

test("main() round-trip: sb output create --file", async () => {
  const ws = await makeWorkspace();
  const captured = await runCapture({ workspace: ws, content: "Cited.", source: "paste" });
  const file = join(ws, "out.json");
  await writeFile(
    file,
    JSON.stringify(proposal({ title: "Via CLI", sources: [captured.note_id], body: "B." })),
    "utf8",
  );
  let stdout = "";
  const io = { out: (t: string) => void (stdout += t), err: (t: string) => void (stdout += t) };
  assert.equal(await main(["output", "create", "--file", file, "--workspace", ws], io), 0);
  const result = JSON.parse(stdout) as { ok: boolean; note_id: string };
  assert.equal(result.ok, true);

  stdout = "";
  assert.equal(await main(["output", "create", "--workspace", ws], io), 1);
  assert.match(stdout, /bad_arguments/);
});
