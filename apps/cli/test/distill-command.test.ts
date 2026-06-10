/**
 * Tests for the SB-026 `distill` command. `propose` is read-only (lists L1
 * candidates + a scaffold, writes nothing); `accept` is the only writing step
 * (one L2 distilled note + one distillation_accepted memory event). All writes
 * go to TEMP workspaces.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { DistillCliError, runDistillAccept, runDistillPropose } from "../src/distill-command.js";
import { main } from "../src/index.js";

const SOURCE_A = "01KT6C7GH0PM1K6XQH3K6ZG8BT";
const SOURCE_B = "01KT6D5N163GSHGECNCA88NYPE";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-cli-distill-"));
  tmpDirs.push(dir);
  return dir;
}

/** Seed an L1 working note so `propose` has a candidate to list. */
async function seedWorkingNote(ws: string, id: string, title: string): Promise<string> {
  const dir = join(ws, "vault", "10_Projects");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${id}.md`);
  const text = `---\nid: ${id}\ntype: working\nlayer: 1\ntitle: ${JSON.stringify(title)}\nsource_ref: ${SOURCE_A}\ncreated: "2026-06-04T08:00:00Z"\n---\n\n${title} body.`;
  await writeFile(path, text, "utf8");
  return path;
}

async function wikiFiles(ws: string): Promise<string[]> {
  try {
    return await readdir(join(ws, "vault", "80_Wiki"));
  } catch {
    return [];
  }
}

async function memoryLines(ws: string): Promise<string[]> {
  try {
    const text = await readFile(join(ws, "events", "memory_events.jsonl"), "utf8");
    return text.split("\n").filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("propose lists L1 candidates + a scaffold and writes nothing", async () => {
  const ws = await makeWorkspace();
  const workingId = "01KT6S3G408VV6NHJDH0ZND8DK";
  const workingPath = await seedWorkingNote(ws, workingId, "Working note A");
  const before = await readFile(workingPath);

  const result = await runDistillPropose({ workspace: ws });
  assert.equal(result.ok, true);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]!.id, workingId);
  assert.equal(result.candidates[0]!.title, "Working note A");
  // scaffold shape
  assert.deepEqual(result.proposal.source_ids, []);
  assert.equal(result.proposal.title, "");
  assert.equal(typeof result.proposal.rationale, "string");

  // read-only: no L2 note, no memory events, source note byte-identical
  assert.deepEqual(await wikiFiles(ws), []);
  assert.equal(existsSync(join(ws, "events", "memory_events.jsonl")), false);
  assert.ok(before.equals(await readFile(workingPath)));
});

test("propose --limit bounds the candidate list", async () => {
  const ws = await makeWorkspace();
  await seedWorkingNote(ws, "01KT6S3G408VV6NHJDH0ZND8DK", "A");
  await seedWorkingNote(ws, "01KT6S78P0X3JCQ5ZPFTMS7FK5", "B");
  const result = await runDistillPropose({ workspace: ws, limit: 1 });
  assert.equal(result.candidates.length, 1);
});

test("accept writes exactly one L2 note + one distillation_accepted event", async () => {
  const ws = await makeWorkspace();
  const result = await runDistillAccept({
    workspace: ws,
    now: "2026-06-05T10:00:00Z",
    proposal: {
      source_ids: [SOURCE_A, SOURCE_B],
      title: "Distilled insight",
      body: "Synthesized from two working notes.",
      tags: ["insight"],
      rationale: "These two notes cover one coherent idea worth promoting to L2.",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.source_ref, SOURCE_A);
  assert.deepEqual(result.source_ids, [SOURCE_A, SOURCE_B]);

  // exactly one L2 note under 80_Wiki
  const files = await wikiFiles(ws);
  assert.equal(files.length, 1);
  const noteText = await readFile(result.note_path, "utf8");
  assert.match(noteText, /^type: distilled$/m);
  assert.match(noteText, /^layer: 2$/m);
  assert.match(noteText, new RegExp(`^source_ref: ${SOURCE_A}$`, "m"));

  // exactly one memory event, well-formed
  const lines = await memoryLines(ws);
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]!);
  assert.equal(event.stream, "memory");
  assert.equal(event.kind, "distillation_accepted");
  assert.equal(event.event_id, result.event_id);
  assert.equal(event.subject_id, result.note_id);
  assert.equal(event.actor, "human");
  assert.deepEqual(event.payload.source_ids, [SOURCE_A, SOURCE_B]);
});

test("accept via main() reads a proposal from stdin and exits 0", async () => {
  const ws = await makeWorkspace();
  const proposal = JSON.stringify({
    source_ids: [SOURCE_A],
    title: "From stdin",
    body: "Body.",
    rationale: "why",
  });
  let stdout = "";
  const code = await main(["distill", "accept", "--workspace", ws], {
    stdin: Readable.from(proposal),
    out: (t) => {
      stdout += t;
    },
    err: () => {},
  });
  assert.equal(code, 0);
  const result = JSON.parse(stdout);
  assert.equal(result.ok, true);
  assert.equal((await wikiFiles(ws)).length, 1);
  assert.equal((await memoryLines(ws)).length, 1);
});

test("accept rejects a proposal missing a title and writes nothing", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () =>
      runDistillAccept({
        workspace: ws,
        proposal: { source_ids: [SOURCE_A], body: "x", rationale: "y" },
      }),
    (err: unknown) => err instanceof DistillCliError && err.code === "bad_proposal",
  );
  assert.deepEqual(await wikiFiles(ws), []);
  assert.deepEqual(await memoryLines(ws), []);
});

test("accept rejects an empty source_ids", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () =>
      runDistillAccept({
        workspace: ws,
        proposal: { source_ids: [], title: "t", body: "b", rationale: "r" },
      }),
    (err: unknown) => err instanceof DistillCliError && err.code === "bad_proposal",
  );
});

test("accept via main() with no proposal errors (exit 1)", async () => {
  const ws = await makeWorkspace();
  let stderr = "";
  const code = await main(["distill", "accept", "--workspace", ws], {
    stdin: Readable.from(""),
    out: () => {},
    err: (t) => {
      stderr += t;
    },
  });
  assert.equal(code, 1);
  assert.equal(JSON.parse(stderr).error.code, "bad_arguments");
});

test("accept via main() with invalid JSON errors (exit 1)", async () => {
  const ws = await makeWorkspace();
  let stderr = "";
  const code = await main(["distill", "accept", "--workspace", ws], {
    stdin: Readable.from("{ not json"),
    out: () => {},
    err: (t) => {
      stderr += t;
    },
  });
  assert.equal(code, 1);
  assert.equal(JSON.parse(stderr).error.code, "bad_proposal");
});

test("unknown distill subcommand errors (exit 1)", async () => {
  let stderr = "";
  const code = await main(["distill", "bogus"], {
    out: () => {},
    err: (t) => {
      stderr += t;
    },
  });
  assert.equal(code, 1);
  assert.equal(JSON.parse(stderr).error.code, "bad_arguments");
});

test("SB-028: multi-source accept records secondary sources as note links", async () => {
  const SOURCE_C = "01KT6D5N163GSHGECNCA88NYPF";
  const ws = await makeWorkspace();
  const result = await runDistillAccept({
    workspace: ws,
    now: "2026-06-10T10:00:00Z",
    proposal: {
      source_ids: [SOURCE_A, SOURCE_B, SOURCE_C],
      title: "Three-source insight",
      body: "Synthesized from three notes.",
      rationale: "r",
    },
  });

  const noteText = await readFile(result.note_path, "utf8");
  // primary stays the single schema source_ref
  assert.match(noteText, new RegExp(`^source_ref: ${SOURCE_A}$`, "m"));
  // the remaining origin ids live on the note itself
  assert.match(noteText, /^links:$/m);
  assert.match(noteText, new RegExp(`^  - "${SOURCE_B}"$`, "m"));
  assert.match(noteText, new RegExp(`^  - "${SOURCE_C}"$`, "m"));

  // event payload still carries the full list (unchanged contract)
  const lines = await memoryLines(ws);
  const event = JSON.parse(lines[0]!);
  assert.deepEqual(event.payload.source_ids, [SOURCE_A, SOURCE_B, SOURCE_C]);
});

test("SB-028: single-source accept emits no links key", async () => {
  const ws = await makeWorkspace();
  const result = await runDistillAccept({
    workspace: ws,
    now: "2026-06-10T10:00:00Z",
    proposal: { source_ids: [SOURCE_A], title: "One source", body: "b", rationale: "r" },
  });
  const noteText = await readFile(result.note_path, "utf8");
  assert.doesNotMatch(noteText, /^links:$/m);
});
