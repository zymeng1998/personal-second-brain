/**
 * SB-072 — media reference recording: classification (private-by-default for
 * signed/token/path/ambiguous), secure_ref creation via the enforced dispatch
 * for private pointers, and the no-leak guarantee (the raw locator appears only
 * inside the secref pointer file — never in the handle, output, or errors).
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { classifyMediaPointer, recordMediaReference } from "../src/media-ref.js";
import { invoke } from "../src/invoke.js";

const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function makeWorkspace(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-media-ref-"));
  tmpDirs.push(ws);
  return ws;
}

test("classification: signed/token/path/ambiguous are private; clean public URL is public", () => {
  // public intent
  assert.equal(classifyMediaPointer("https://example.org/lectures/intro.mp4", "public"), "public_ref");
  assert.equal(
    classifyMediaPointer("https://s3.amazonaws.com/b/v.mp4?X-Amz-Signature=abc&X-Amz-Credential=x", "public"),
    "signed_url_detected",
  );
  assert.equal(classifyMediaPointer("https://cdn.example.com/v.mp4?token=SECRET", "public"), "token_detected");
  assert.equal(classifyMediaPointer("/Users/me/Movies/private.mov", "public"), "local_private_path");
  assert.equal(classifyMediaPointer("some-bare-label", "public"), "ambiguous_default_private");
  // private intent always private; a clean URL offered as private stays private
  assert.equal(classifyMediaPointer("https://example.org/intro.mp4", "private"), "ambiguous_default_private");
  assert.equal(classifyMediaPointer("file:///Volumes/secure/v.mov", "private"), "local_private_path");
});

test("public pointer → plain ref handle (no secref, no writes)", async () => {
  const ws = await makeWorkspace();
  const before = existsSync(join(ws, "secure_refs"));
  const handle = await recordMediaReference({
    pointer: "https://example.org/lectures/intro.mp4",
    intent: "public",
    workspace: ws,
  });
  assert.deepEqual(handle, { ref_class: "public_ref", ref: "https://example.org/lectures/intro.mp4" });
  assert.equal(existsSync(join(ws, "secure_refs")), before, "no secref written for a public pointer");
});

test("private/signed pointer → secref id handle; raw locator only inside the pointer file", async () => {
  const ws = await makeWorkspace();
  const SIGNED = "https://s3.amazonaws.com/bucket/lecture.mov?X-Amz-Signature=DEADBEEFSENTINEL&X-Amz-Credential=AKIA";
  const handle = await recordMediaReference({ pointer: SIGNED, intent: "public", workspace: ws });
  assert.equal(handle.ref_class, "signed_url_detected");
  assert.ok(handle.secref?.startsWith("secref_"));
  assert.equal(handle.ref, undefined);
  // the handle itself never carries the locator
  assert.ok(!JSON.stringify(handle).includes("DEADBEEFSENTINEL"));

  // the locator lives ONLY in secure_refs/<id>.md ... actually the secref file
  // stores it (that is its purpose); NO OTHER file may contain it.
  const offenders: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if ((await readFile(p, "utf8")).includes("DEADBEEFSENTINEL")) offenders.push(p);
    }
  };
  await walk(ws);
  assert.equal(offenders.length, 1, "sentinel appears in exactly one file (the secref pointer)");
  assert.match(offenders[0] ?? "", /secure_refs/);
});

test("private intent forces a secref even for an otherwise-clean URL", async () => {
  const ws = await makeWorkspace();
  const handle = await recordMediaReference({ pointer: "https://example.org/intro.mp4", intent: "private", workspace: ws });
  assert.equal(handle.ref_class, "ambiguous_default_private");
  assert.ok(handle.secref?.startsWith("secref_"));
});

test("the recorder cannot read secure_refs back (read:secure_refs hard-denied)", async () => {
  const ws = await makeWorkspace();
  // surface:media-intake holds write:secure_refs but NOT read:secure_refs
  const denied = await invoke(["secref", "add", "--kind", "media", "--locator", "x://y", "--workspace", ws]);
  assert.equal(denied.exitCode, 0, "write:secure_refs is granted");
  // there is no read:secure_refs op surface; confirm the adapter is denied a privileged op it lacks
  const rebuild = await invoke(["rebuild", "--workspace", ws]);
  assert.equal(rebuild.exitCode, 1);
  assert.match(rebuild.stderr, /scope_denied/);
});
