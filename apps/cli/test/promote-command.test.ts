/**
 * Tests for the SB-029 `note promote` command: L0 raw -> L1 working note in
 * 00_Inbox, source never mutated, and `distill propose` then surfaces the
 * working note as a candidate (the end-to-end the review finding asked for).
 */
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { runCapture } from "../src/capture-command.js";
import { runDistillPropose } from "../src/distill-command.js";
import { PromoteCliError, runNotePromote } from "../src/promote-command.js";
import { main } from "../src/index.js";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-promote-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("E2E: capture -> promote -> propose lists the working note as a candidate", async () => {
  const ws = await makeWorkspace();
  const captured = await runCapture({
    workspace: ws,
    content: "Raw thought about espresso ratios.",
    source: "paste",
    title: "Espresso ratios",
  });

  const rawDir = join(ws, "vault", "00_Raw");
  const rawFile = (await readdir(rawDir))[0] as string;
  const rawBytesBefore = await readFile(join(rawDir, rawFile), "utf8");

  const promoted = await runNotePromote({ id: captured.note_id, workspace: ws, now: "2026-06-10T11:00:00Z" });
  assert.equal(promoted.ok, true);
  assert.equal(promoted.source_ref, captured.note_id);
  assert.ok(promoted.note_path.includes(join("vault", "00_Inbox")));

  // schema-shaped L1 note seeded from the raw body, source_ref to the origin
  const text = await readFile(promoted.note_path, "utf8");
  assert.match(text, /^type: working$/m);
  assert.match(text, /^layer: 1$/m);
  assert.match(text, new RegExp(`^source_ref: ${captured.note_id}$`, "m"));
  assert.match(text, /Raw thought about espresso ratios\./);

  // the L0 source is byte-unchanged
  assert.equal(await readFile(join(rawDir, rawFile), "utf8"), rawBytesBefore);

  // distill propose now has a real candidate
  const proposal = await runDistillPropose({ workspace: ws });
  assert.deepEqual(
    proposal.candidates.map((c) => c.id),
    [promoted.note_id],
  );
});

test("promote rejects a non-raw note", async () => {
  const ws = await makeWorkspace();
  const captured = await runCapture({ workspace: ws, content: "raw", source: "paste" });
  const promoted = await runNotePromote({ id: captured.note_id, workspace: ws });
  await assert.rejects(
    runNotePromote({ id: promoted.note_id, workspace: ws }),
    (e: unknown) => e instanceof PromoteCliError && e.code === "not_raw",
  );
});

test("promote with a missing id errors; unknown id is not_found", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(runNotePromote({ id: "", workspace: ws }), /requires a raw note/);
  await assert.rejects(
    runNotePromote({ id: "01KT6C7GH0PM1K6XQH3K6ZG8ZZ", workspace: ws }),
    (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "not_found",
  );
});

test("promote via main() prints a structured result and exits 0", async () => {
  const ws = await makeWorkspace();
  const captured = await runCapture({ workspace: ws, content: "raw via main", source: "paste" });
  let stdout = "";
  const code = await main(["note", "promote", captured.note_id, "--title", "Renamed", "--workspace", ws], {
    out: (t) => {
      stdout += t;
    },
    err: () => {},
  });
  assert.equal(code, 0);
  const result = JSON.parse(stdout);
  assert.equal(result.ok, true);
  assert.equal(result.source_ref, captured.note_id);
  const text = await readFile(result.note_path, "utf8");
  assert.match(text, /^title: "Renamed"$/m);
});
