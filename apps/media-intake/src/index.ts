/**
 * @sb/media-intake entry (EPIC-CORE-013). Optional CLI adapter that ingests a
 * `psb-media-transcriber` transcript as an L0 capture with auditable media
 * provenance. Runs as `surface:media-intake` through the one enforced dispatch;
 * the core never stores media binaries.
 */
import { argv as processArgv } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runIngest, IngestError } from "./ingest.js";
import type { IngestArgs } from "./ingest.js";

export { invoke, MEDIA_INTAKE_CALLER } from "./invoke.js";
export type { InvokeResult } from "./invoke.js";
export { classifyMediaPointer, recordMediaReference, MediaRefError } from "./media-ref.js";
export type { MediaRefHandle } from "./media-ref.js";
export { runIngest, IngestError } from "./ingest.js";
export type { IngestArgs, IngestResult } from "./ingest.js";
export { normalizeTimedTranscript, NormalizeError } from "./normalize.js";
export type { TimedFormat } from "./normalize.js";

export interface MediaIntakeIO {
  out: (text: string) => void;
  err: (text: string) => void;
}

const USAGE = `media-intake — ingest psb-media-transcriber transcripts as L0 captures (surface:media-intake)

Usage:
  media-intake ingest --artifact-dir <dir> (--media-ref <pointer> | --media-secref <pointer>) [--title <t>] [--workspace <path>]
  media-intake ingest --transcript <file.md|.txt> --media-id <hash> (--media-ref <pointer> | --media-secref <pointer>) [--title <t>] [--workspace <path>]

  --artifact-dir <dir>   Transcriber artifact dir: reads <dir>/transcript.md; media_id = dir name.
  --transcript <file>    Explicit transcript .md/.txt/.srt/.vtt (with --media-id). .srt/.vtt are normalized to prose (no timestamps). Media binaries are refused.
  --media-id <hash>      Content hash (with --transcript). Strictly validated.
  --media-ref <pointer>  PUBLIC original-media pointer (non-sensitive). Signed/token/ambiguous ⇒ forced to a secure_ref.
  --media-secref <ptr>   PRIVATE original-media pointer ⇒ stored as an opaque secure_ref (locator never echoed).
  --title <t>            Optional note title.
  --review               Also seed an L1 working note in 00_Inbox (reuses note promote) for the distill/review flow.
  --workspace <path>     Workspace override; else SECOND_BRAIN_WORKSPACE / .env.

The transcript text is captured verbatim as an immutable L0 note (source:transcript). Re-ingesting the
same media_id with the same transcript + media reference is idempotent; with a different transcript or
media reference it fails closed as media_id_conflict (zero writes). The original media binary is never read.
`;

function errorEnvelope(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "error";
  const message = err instanceof Error ? err.message : String(err);
  return JSON.stringify({ ok: false, error: { code, message } });
}

export async function main(argv: string[], io: Partial<MediaIntakeIO> = {}): Promise<number> {
  const out = io.out ?? ((t: string) => void process.stdout.write(t));
  const err = io.err ?? ((t: string) => void process.stderr.write(t));

  const args = argv.filter((a) => a !== "--");
  const command = args[0];
  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    out(USAGE);
    return command === undefined ? 1 : 0;
  }
  if (command !== "ingest") {
    err(`${errorEnvelope(new IngestError("bad_arguments", `unknown command: ${command}`))}\n`);
    return 1;
  }

  const parsed: Partial<IngestArgs> = {};
  const rest = args.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] as string;
    const next = (): string => {
      const v = rest[++i];
      if (v === undefined) throw new IngestError("bad_arguments", `${arg} requires a value`);
      return v;
    };
    try {
      if (arg === "--artifact-dir") parsed.artifactDir = next();
      else if (arg === "--transcript") parsed.transcript = next();
      else if (arg === "--media-id") parsed.mediaId = next();
      else if (arg === "--media-ref") parsed.mediaRef = next();
      else if (arg === "--media-secref") parsed.mediaSecref = next();
      else if (arg === "--title") parsed.title = next();
      else if (arg === "--review") parsed.review = true;
      else if (arg === "--workspace") parsed.workspace = next();
      else throw new IngestError("bad_arguments", `unknown argument: ${arg}`);
    } catch (e) {
      err(`${errorEnvelope(e)}\n`);
      return 1;
    }
  }

  try {
    const result = await runIngest({
      workspace: parsed.workspace ?? process.env.SECOND_BRAIN_WORKSPACE ?? "",
      ...(parsed.artifactDir !== undefined ? { artifactDir: parsed.artifactDir } : {}),
      ...(parsed.transcript !== undefined ? { transcript: parsed.transcript } : {}),
      ...(parsed.mediaId !== undefined ? { mediaId: parsed.mediaId } : {}),
      ...(parsed.mediaRef !== undefined ? { mediaRef: parsed.mediaRef } : {}),
      ...(parsed.mediaSecref !== undefined ? { mediaSecref: parsed.mediaSecref } : {}),
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.review === true ? { review: true } : {}),
    });
    out(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (e) {
    err(`${errorEnvelope(e)}\n`);
    return 1;
  }
}

const invokedDirectly =
  processArgv[1] !== undefined && resolve(processArgv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  void main(processArgv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
