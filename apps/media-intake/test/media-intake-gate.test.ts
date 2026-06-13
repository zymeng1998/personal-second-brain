/**
 * SB-087 — the EPIC-CORE-013 "Done when" gate:
 *  (a) media_id idempotency — double ingest writes one L0, the second reports
 *      the existing note, workspace byte-identical;
 *  (b) provenance round-trip — L1 → L0 → media_id → media-ref handle resolves;
 *  (c) NO media binary in the vault — only transcript text;
 *  (d) NO secret leak — a private signed-URL sentinel never appears in any
 *      note/event/CLI-output/error; the locator lives ONLY in the secref file;
 *  (e) domain-neutral — no broker vocabulary in apps/media-intake;
 *  (f) SB-074 + SB-077 + SB-084 invariants re-asserted (surface:media-intake
 *      denied outside its grant; ALWAYS_DENIED unobtainable for every caller;
 *      read:secure_refs hard-denied), incl. with a grant config present.
 */
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  ALWAYS_DENIED_SCOPES,
  OPERATION_CONTRACTS,
  ScopeDeniedError,
  enforceScope,
  grantAllows,
  parseGrantConfig,
  resolveGrant,
} from "@sb/interfaces";
import type { CoreOperations, PermissionScope } from "@sb/interfaces";
import { runIngest } from "../src/ingest.js";
import { invoke, MEDIA_INTAKE_CALLER } from "../src/invoke.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function makeWorkspace(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-media-gate-ws-"));
  tmpDirs.push(ws);
  return ws;
}
async function makeArtifactDir(mediaId: string, transcript: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sb-media-gate-art-"));
  tmpDirs.push(root);
  const dir = join(root, mediaId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "transcript.md"), transcript, "utf8");
  return dir;
}
async function snapshot(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const walk = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else files.set(relative(root, p), (await readFile(p)).toString("base64"));
    }
  };
  await walk(root);
  return files;
}

test("GATE (a): media_id idempotency — double ingest writes one L0, byte-identical", async () => {
  const ws = await makeWorkspace();
  const dir = await makeArtifactDir("54c63db258a34d84", "Gate transcript A.\n");
  const first = await runIngest({ workspace: ws, artifactDir: dir, mediaRef: "https://example.org/v.mp4" });
  const before = await snapshot(ws);
  const second = await runIngest({ workspace: ws, artifactDir: dir, mediaRef: "https://example.org/v.mp4" });
  assert.equal(second.idempotent, true);
  assert.equal(second.note_id, first.note_id);
  const afterAll = await snapshot(ws);
  assert.deepEqual([...afterAll.keys()].sort(), [...before.keys()].sort());
  for (const [p, b] of before) assert.equal(afterAll.get(p), b, p);
});

test("GATE (b)+(c): provenance round-trip resolves; the vault holds only transcript text", async () => {
  const ws = await makeWorkspace();
  const dir = await makeArtifactDir("a4bf9becd046d7ae", "Gate transcript B.\n");
  const res = await runIngest({ workspace: ws, artifactDir: dir, mediaRef: "https://example.org/lec.mp4", review: true });

  const l1 = await invoke(["note", "get", res.working_note_id as string, "--workspace", ws]);
  assert.match(l1.stdout, new RegExp(`source_ref: ${res.note_id}`)); // L1 → L0
  const l0 = await invoke(["note", "get", res.note_id, "--workspace", ws]);
  assert.match(l0.stdout, /media_id: "a4bf9becd046d7ae"/); // L0 → media_id
  assert.match(l0.stdout, /ref_class: "public_ref"/);
  assert.match(l0.stdout, /ref: "https:\/\/example\.org\/lec\.mp4"/); // → media reference

  for (const p of (await snapshot(ws)).keys()) {
    assert.doesNotMatch(p, /\.(mov|mp4|m4v|m4a|wav|mp3|aac|flac|avi|mkv|webm)$/i, `media binary in vault: ${p}`);
  }
});

test("GATE (d): a private signed-URL sentinel never leaks into notes/events/output", async () => {
  const ws = await makeWorkspace();
  const dir = await makeArtifactDir("deadbeefcafe0007", "Gate transcript private.\n");
  const SENTINEL = "GATELEAKSENTINEL-0xC0FFEE";
  const SIGNED = `https://s3.amazonaws.com/b/lec.mov?X-Amz-Signature=${SENTINEL}&X-Amz-Credential=AKIA`;
  const res = await runIngest({ workspace: ws, artifactDir: dir, mediaSecref: SIGNED, review: true });
  assert.equal(JSON.stringify(res).includes(SENTINEL), false, "ingest result must not echo the locator");

  // scan every file EXCEPT the secref pointer (the designated opaque store)
  for (const [path, b64] of await snapshot(ws)) {
    if (path.startsWith(join("secure_refs"))) continue;
    const text = Buffer.from(b64, "base64").toString("utf8");
    assert.ok(!text.includes(SENTINEL), `sentinel leaked into ${path}`);
  }
  // CLI output never carries it either
  const got = await invoke(["note", "get", res.note_id, "--workspace", ws]);
  assert.ok(!got.stdout.includes(SENTINEL));
  assert.match(got.stdout, /ref_class: "signed_url_detected"/);
});

test("GATE (e): no domain vocabulary in apps/media-intake", async () => {
  const DOMAIN_TERMS = /broker|landlord|commission|rental/i;
  const GUARD_LINE = /no broker|never broker|domain-neutral/i;
  const offenders: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "media-intake-gate.test.ts" || entry.isSymbolicLink()) continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (/\.(ts|js|json|md)$/.test(entry.name)) {
        const lines = (await readFile(p, "utf8")).split("\n");
        if (lines.some((line) => DOMAIN_TERMS.test(line) && !GUARD_LINE.test(line))) {
          offenders.push(relative(REPO_ROOT, p));
        }
      }
    }
  };
  await walk(join(REPO_ROOT, "apps", "media-intake"));
  assert.deepEqual(offenders, [], `domain terms in media-intake: ${offenders.join(", ")}`);
});

test("GATE (f): SB-074/077/084 invariants — media-intake denied outside its grant; ALWAYS_DENIED unobtainable", () => {
  const config = parseGrantConfig(
    JSON.stringify({ version: 1, grants: [{ app: "domain-app:x", allow: ["read:notes"] }] }),
  );
  // surface:media-intake holds capture + read/promote notes + write:secure_refs — and NOTHING else
  for (const op of ["composeOutput", "acceptDistillation", "addFact", "rebuildProjections", "indexVault"] as Array<keyof CoreOperations>) {
    assert.throws(() => enforceScope(MEDIA_INTAKE_CALLER, op, config), ScopeDeniedError, String(op));
  }
  assert.doesNotThrow(() => enforceScope(MEDIA_INTAKE_CALLER, "capture", config));
  assert.doesNotThrow(() => enforceScope(MEDIA_INTAKE_CALLER, "listNotes", config));

  // ALWAYS_DENIED (incl. read:secure_refs) unobtainable for every caller class
  for (const denied of ALWAYS_DENIED_SCOPES) {
    const probe: PermissionScope = denied === "delete:*" ? ("delete:notes" as PermissionScope) : denied;
    for (const caller of ["cli", "surface:media-intake", "surface:dashboard", "domain-app:x", "skill:any"]) {
      assert.equal(grantAllows(resolveGrant(caller, config), probe), false, `${caller} vs ${probe}`);
    }
  }
  // the under-privileged-caller write sweep still holds for a rogue identity
  const writeOps = (Object.keys(OPERATION_CONTRACTS) as Array<keyof CoreOperations>).filter(
    (op) => !OPERATION_CONTRACTS[op].readOnly,
  );
  for (const op of writeOps) {
    assert.throws(() => enforceScope("domain-app:rogue", op, config), ScopeDeniedError);
  }
});
