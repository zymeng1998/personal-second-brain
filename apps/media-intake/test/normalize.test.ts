/**
 * SB-088 — `.srt`/`.vtt` → prose normalization: cue indices, timestamps, VTT
 * headers, cue ids, and inline tags are stripped (no timestamps in the body);
 * malformed input fails closed; an end-to-end `.srt` ingest carries the same
 * provenance + idempotency as the `.md` path.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { normalizeTimedTranscript, NormalizeError } from "../src/normalize.js";
import { runIngest, IngestError } from "../src/ingest.js";
import { invoke } from "../src/invoke.js";

const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

const SRT = `1
00:00:01,000 --> 00:00:04,000
Hello and welcome.

2
00:00:04,500 --> 00:00:07,200
Today we discuss the espresso ratio.
`;

const VTT = `WEBVTT

NOTE this is a comment block

intro
00:00:01.000 --> 00:00:04.000
<v Host>Hello and welcome.</v>

00:00:04.500 --> 00:00:07.200
Today we discuss the <i>espresso</i> ratio.
`;

test("srt normalizes to prose without indices or timestamps", () => {
  const prose = normalizeTimedTranscript(SRT, "srt");
  assert.equal(prose, "Hello and welcome.\nToday we discuss the espresso ratio.\n");
  assert.doesNotMatch(prose, /-->|00:00:/);
});

test("vtt strips header/NOTE/cue-id/inline tags to prose", () => {
  const prose = normalizeTimedTranscript(VTT, "vtt");
  assert.equal(prose, "Hello and welcome.\nToday we discuss the espresso ratio.\n");
  assert.doesNotMatch(prose, /WEBVTT|NOTE|-->|<v|<i>/);
});

test("malformed timed input fails closed", () => {
  assert.throws(() => normalizeTimedTranscript("just some text\nno timestamps here", "srt"), NormalizeError);
  assert.throws(() => normalizeTimedTranscript("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n", "vtt"), (e: unknown) => e instanceof NormalizeError && e.code === "empty");
});

test("end-to-end: .srt ingest captures the normalized prose with full provenance", async () => {
  const ws = await mkdtemp(join(tmpdir(), "sb-srt-ws-"));
  tmpDirs.push(ws);
  const srcDir = await mkdtemp(join(tmpdir(), "sb-srt-src-"));
  tmpDirs.push(srcDir);
  const file = join(srcDir, "lecture.srt");
  await writeFile(file, SRT, "utf8");

  const res = await runIngest({ workspace: ws, transcript: file, mediaId: "54c63db258a34d84", mediaRef: "https://example.org/v.mp4" });
  const got = await invoke(["note", "get", res.note_id, "--workspace", ws]);
  assert.match(got.stdout, /kind: "transcript"/);
  assert.match(got.stdout, /Hello and welcome\./);
  assert.match(got.stdout, /Today we discuss the espresso ratio\./);
  assert.doesNotMatch(got.stdout, /00:00:0|-->/); // no timestamps captured
  assert.match(got.stdout, /media_id: "54c63db258a34d84"/);

  // a media binary with an .srt-looking sibling is still refused
  await assert.rejects(
    runIngest({ workspace: ws, transcript: join(srcDir, "x.mov"), mediaId: "abcd1234abcd1234", mediaRef: "https://x/y" }),
    (e: unknown) => e instanceof IngestError && e.code === "refused_binary",
  );
});
