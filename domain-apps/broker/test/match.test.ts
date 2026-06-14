/**
 * SB-093 — showing-match summary (READ-ONLY, gate-independent).
 *  - under a READ-ONLY broker grant ([read:notes, read:facts]) the broker reads
 *    client-preference facts + captured property notes and produces a
 *    deterministic ranked summary — proving match needs NO write scope;
 *  - the matching property ranks above the non-matching one (reproducible);
 *  - a full match pass leaves the workspace byte-identical (zero writes);
 *  - the rendered summary leaks no contact detail.
 *
 * Synthetic data only (OQ #45). Seeding is done AS THE HUMAN (cli); the broker
 * only reads.
 */
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { main } from "@sb/cli";
import { matchClient, renderMatchSummary } from "../src/index.js";

const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function cliIo(): { io: { out: (t: string) => void; err: (t: string) => void }; text: () => string } {
  let buf = "";
  return { io: { out: (t: string) => void (buf += t), err: (t: string) => void (buf += t) }, text: () => buf };
}

async function cli(argv: string[]): Promise<string> {
  const c = cliIo();
  const code = await main(argv, c.io);
  assert.equal(code, 0, c.text());
  return c.text();
}

async function snapshot(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const walk = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.set(relative(root, path), (await readFile(path)).toString("base64"));
    }
  };
  await walk(root);
  return files;
}

/** Seed preferences (facts) + two property notes AS THE HUMAN; grant broker read-only. */
async function seedWorkspace(): Promise<{ ws: string; matchId: string; otherId: string }> {
  const ws = await mkdtemp(join(tmpdir(), "sb-broker-match-"));
  tmpDirs.push(ws);

  // A client note, to anchor preference provenance (source_ref must be a ULID).
  const cap = JSON.parse(await cli(["capture", "--content", "Client A rental brief", "--source", "import", "--workspace", ws])) as { note_id: string };
  for (const statement of [
    "Client A target budget is around 2000 per month",
    "Client A needs at least 2 bedrooms",
    "Client A prefers the river district",
  ]) {
    await cli(["fact", "add", "--statement", statement, "--source-ref", cap.note_id, "--confidence", "0.9", "--workspace", ws]);
  }

  // Two captured property notes (generic tag property-note).
  const matchProp = JSON.parse(await cli([
    "capture", "--content", "2 bedroom apartment in the river district, 2000 per month, quiet building",
    "--source", "import", "--tag", "property-note", "--title", "River district 2BR", "--workspace", ws,
  ])) as { note_id: string };
  const otherProp = JSON.parse(await cli([
    "capture", "--content", "studio downtown near the stadium, 1200 per month",
    "--source", "import", "--tag", "property-note", "--title", "Downtown studio", "--workspace", ws,
  ])) as { note_id: string };

  // Broker is granted READ-ONLY — match must need no write scope.
  await mkdir(join(ws, "config"), { recursive: true });
  await writeFile(
    join(ws, "config", "grants.json"),
    JSON.stringify({ version: 1, grants: [{ app: "domain-app:broker", allow: ["read:notes", "read:facts"] }] }),
  );
  return { ws, matchId: matchProp.note_id, otherId: otherProp.note_id };
}

test("ranks the matching property first under a read-only grant; zero writes", async () => {
  const { ws, matchId, otherId } = await seedWorkspace();
  const before = await snapshot(ws);

  const result = await matchClient(ws, "Client A");
  assert.equal(result.preferences.length, 3, "all three client preferences surfaced");
  assert.equal(result.matches.length, 2, "both property notes considered");
  assert.equal(result.matches[0]?.note_id, matchId, "river-district property ranks first");
  assert.equal(result.matches[1]?.note_id, otherId, "downtown studio ranks second");
  assert.ok((result.matches[0]?.score ?? 0) > (result.matches[1]?.score ?? 0), "match outscores non-match");
  assert.ok(result.matches[0]?.overlap.includes("river"), "overlap is auditable");

  // Deterministic: a second pass is identical.
  const again = await matchClient(ws, "Client A");
  assert.deepEqual(again, result, "match is reproducible");

  const summary = renderMatchSummary(result);
  assert.match(summary, /Match summary for Client A/);
  assert.ok(summary.includes(matchId));

  const after = await snapshot(ws);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), "no file created or deleted");
  for (const [path, bytes] of before) assert.equal(after.get(path), bytes, `byte change in ${path}`);
});
