/**
 * @sb/cli entry (SB-013). Dispatches the `capture` command: parses flags, reads
 * stdin when `--content` is absent, runs the capture, and prints a structured
 * JSON result to stdout (or a structured error to stderr with a non-zero exit).
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { argv as processArgv } from "node:process";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { CaptureCliError, runCapture } from "./capture-command.js";
import { runNoteGet, runNoteList } from "./note-command.js";
import { runNotePromote } from "./promote-command.js";
import { DistillCliError, runDistillAccept, runDistillPropose } from "./distill-command.js";
import { runRebuild } from "./rebuild-command.js";
import { runIndex } from "./index-command.js";
import { runQuery } from "./query-command.js";
import { FactCliError, runFactAccept, runFactAdd, runFactList } from "./fact-command.js";

export interface CliIO {
  stdin: Readable | NodeJS.ReadStream;
  out: (text: string) => void;
  err: (text: string) => void;
}

const USAGE = `sb capture — capture raw text into the Second Brain (L0 raw note + capture event)

Usage:
  sb capture --content "<text>" --source paste [options]
  echo "<text>" | sb capture --source paste [options]

Flags:
  --content <text>     Raw content. Optional if text is piped via stdin.
  --source <kind>      Source kind (paste | email | wechat | ocr | voice | clip | import). MVP: paste.
  --title <title>      Optional human title.
  --tag <tag>          Optional tag; repeatable, or comma-separated.
  --ref <ref>          Optional non-sensitive external reference (URL, message id).
  --slug <slug>        Optional human-readable filename slug (non-canonical).
  --workspace <path>   Absolute workspace override; else SECOND_BRAIN_WORKSPACE / .env.
  --help               Show this help.

Read-only:
  sb note list [--type <kind>] [--workspace <path>]
  sb note get <id> [--workspace <path>]

Organize (L0 → L1):
  sb note promote <rawId> [--title <t>] [--workspace <path>]   # seed an editable L1 working note in 00_Inbox (source never mutated)

Distillation (human-confirmed L1 → L2):
  sb distill propose [--limit <n>] [--workspace <path>]        # READ-ONLY: list L1 candidates + scaffold
  sb distill accept --file <proposal.json> [--workspace <path>]
  cat proposal.json | sb distill accept [--workspace <path>]   # accept is the only writing step

Facts (L3, human-confirmed; provenance mandatory):
  sb fact add --statement <s> --source-ref <ulid> [--confidence <0..1>] [--observed-at <iso>] [--supersedes <ulid>] [--workspace <path>]
  sb fact accept --file <proposal.json> [--workspace <path>]   # batch-write a REVIEWED extract_facts proposal; invalid file writes nothing
  sb fact list [--source-ref <ulid>] [--min-confidence <0..1>] [--limit <n>] [--workspace <path>]   # READ-ONLY current facts

Projections (L3, rebuildable):
  sb rebuild [--workspace <path>]                              # rebuild facts/entities/edges/tasks from the event log + vault

Retrieval (L4, disposable indexes):
  sb index [--workspace <path>]                                # sidecar builds indexes/retrieval.duckdb + one TS-emitted 'indexed' event
  sb query "<text>" [--k <n>] [--mode lexical|vector|hybrid] [--workspace <path>]   # READ-ONLY ranked hits {id, score, snippet, source_ref}
`;

interface ParsedCaptureArgs {
  content?: string;
  source?: string;
  title?: string;
  ref?: string;
  slug?: string;
  workspace?: string;
  tags: string[];
  help: boolean;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (value === undefined) {
    throw new CaptureCliError("bad_arguments", `flag ${flag} requires a value`);
  }
  return value;
}

function parseCaptureArgs(args: string[]): ParsedCaptureArgs {
  const parsed: ParsedCaptureArgs = { tags: [], help: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    switch (arg) {
      case "--":
        // Standard end-of-options separator (also forwarded by `pnpm run ... --`). Ignore it.
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--content":
        parsed.content = requireValue(args, ++i, arg);
        break;
      case "--source":
        parsed.source = requireValue(args, ++i, arg);
        break;
      case "--title":
        parsed.title = requireValue(args, ++i, arg);
        break;
      case "--ref":
        parsed.ref = requireValue(args, ++i, arg);
        break;
      case "--slug":
        parsed.slug = requireValue(args, ++i, arg);
        break;
      case "--workspace":
        parsed.workspace = requireValue(args, ++i, arg);
        break;
      case "--tag": {
        const value = requireValue(args, ++i, arg);
        for (const part of value.split(",")) {
          const tag = part.trim();
          if (tag.length > 0) parsed.tags.push(tag);
        }
        break;
      }
      default:
        throw new CaptureCliError("bad_arguments", `unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function errorEnvelope(err: unknown): { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } } {
  const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "error";
  const message = err instanceof Error ? err.message : String(err);
  const details = typeof err === "object" && err !== null && "details" in err ? (err as { details?: Record<string, unknown> }).details : undefined;
  return { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } };
}

async function readStream(stream: Readable | NodeJS.ReadStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Run the CLI. Returns a process exit code. IO is injectable for tests. */
export async function main(argv: string[], io: Partial<CliIO> = {}): Promise<number> {
  const out = io.out ?? ((text: string) => void process.stdout.write(text));
  const err = io.err ?? ((text: string) => void process.stderr.write(text));
  const stdin = io.stdin ?? process.stdin;

  const command = argv[0];
  if (command === undefined) {
    err(USAGE);
    return 1;
  }
  if (command === "--help" || command === "-h" || command === "help") {
    out(USAGE);
    return 0;
  }
  if (command === "note") {
    return handleNote(argv.slice(1), out, err);
  }
  if (command === "distill") {
    return handleDistill(argv.slice(1), out, err, stdin);
  }
  if (command === "fact") {
    return handleFact(argv.slice(1), out, err);
  }
  if (command === "rebuild") {
    return handleRebuild(argv.slice(1), out, err);
  }
  if (command === "index") {
    return handleIndex(argv.slice(1), out, err);
  }
  if (command === "query") {
    return handleQuery(argv.slice(1), out, err);
  }
  if (command !== "capture") {
    err(`${JSON.stringify(errorEnvelope(new CaptureCliError("bad_arguments", `unknown command: ${command}`)))}\n`);
    return 1;
  }

  let parsed: ParsedCaptureArgs;
  try {
    parsed = parseCaptureArgs(argv.slice(1));
  } catch (e) {
    err(`${JSON.stringify(errorEnvelope(e))}\n`);
    return 1;
  }
  if (parsed.help) {
    out(USAGE);
    return 0;
  }

  let content = parsed.content;
  if (content === undefined) {
    const isTty = "isTTY" in stdin && (stdin as NodeJS.ReadStream).isTTY === true;
    if (!isTty) {
      const piped = await readStream(stdin);
      if (piped.length > 0) content = piped;
    }
  }

  try {
    const result = await runCapture({
      content: content ?? "",
      source: parsed.source ?? "",
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.tags.length > 0 ? { tags: parsed.tags } : {}),
      ...(parsed.ref !== undefined ? { ref: parsed.ref } : {}),
      ...(parsed.slug !== undefined ? { slug: parsed.slug } : {}),
      ...(parsed.workspace !== undefined ? { workspace: parsed.workspace } : {}),
    });
    out(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (e) {
    err(`${JSON.stringify(errorEnvelope(e))}\n`);
    return 1;
  }
}

interface ParsedNoteArgs {
  workspace?: string;
  type?: string;
  title?: string;
  positionals: string[];
}

function parseNoteArgs(args: string[]): ParsedNoteArgs {
  const parsed: ParsedNoteArgs = { positionals: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    switch (arg) {
      case "--":
        break;
      case "--workspace":
        parsed.workspace = requireValue(args, ++i, arg);
        break;
      case "--type":
        parsed.type = requireValue(args, ++i, arg);
        break;
      case "--title":
        parsed.title = requireValue(args, ++i, arg);
        break;
      default:
        if (arg.startsWith("--")) {
          throw new CaptureCliError("bad_arguments", `unknown argument: ${arg}`);
        }
        parsed.positionals.push(arg);
    }
  }
  return parsed;
}

async function handleNote(rawArgs: string[], out: (t: string) => void, err: (t: string) => void): Promise<number> {
  // Drop standalone `--` separators (also forwarded by `pnpm run ... --`).
  const args = rawArgs.filter((a) => a !== "--");
  const sub = args[0];
  if (sub === undefined || sub === "--help" || sub === "-h") {
    out(USAGE);
    return sub === undefined ? 1 : 0;
  }

  let parsed: ParsedNoteArgs;
  try {
    parsed = parseNoteArgs(args.slice(1));
  } catch (e) {
    err(`${JSON.stringify(errorEnvelope(e))}\n`);
    return 1;
  }

  try {
    if (sub === "list") {
      const result = await runNoteList({
        ...(parsed.workspace !== undefined ? { workspace: parsed.workspace } : {}),
        ...(parsed.type !== undefined ? { type: parsed.type } : {}),
      });
      for (const note of result.notes) {
        out(`${note.id}\t${note.type ?? "-"}\t${note.title ?? ""}\n`);
      }
      return 0;
    }
    if (sub === "get") {
      const id = parsed.positionals[0];
      const result = await runNoteGet({
        id: id ?? "",
        ...(parsed.workspace !== undefined ? { workspace: parsed.workspace } : {}),
      });
      out(result.content.endsWith("\n") ? result.content : `${result.content}\n`);
      return 0;
    }
    if (sub === "promote") {
      const id = parsed.positionals[0];
      const result = await runNotePromote({
        id: id ?? "",
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.workspace !== undefined ? { workspace: parsed.workspace } : {}),
      });
      out(`${JSON.stringify(result)}\n`);
      return 0;
    }
    err(`${JSON.stringify(errorEnvelope(new CaptureCliError("bad_arguments", `unknown note subcommand: ${sub}`)))}\n`);
    return 1;
  } catch (e) {
    err(`${JSON.stringify(errorEnvelope(e))}\n`);
    return 1;
  }
}

interface ParsedDistillArgs {
  workspace?: string;
  file?: string;
  limit?: number;
}

function parseDistillArgs(args: string[]): ParsedDistillArgs {
  const parsed: ParsedDistillArgs = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    switch (arg) {
      case "--":
        break;
      case "--workspace":
        parsed.workspace = requireValue(args, ++i, arg);
        break;
      case "--file":
        parsed.file = requireValue(args, ++i, arg);
        break;
      case "--limit": {
        const value = requireValue(args, ++i, arg);
        const n = Number.parseInt(value, 10);
        if (!Number.isInteger(n) || n < 0) {
          throw new CaptureCliError("bad_arguments", `--limit must be a non-negative integer: ${value}`);
        }
        parsed.limit = n;
        break;
      }
      default:
        throw new CaptureCliError("bad_arguments", `unknown argument: ${arg}`);
    }
  }
  return parsed;
}

interface ParsedFactArgs {
  statement?: string;
  sourceRef?: string;
  observedAt?: string;
  confidence?: number;
  supersedes?: string;
  minConfidence?: number;
  limit?: number;
  file?: string;
  workspace?: string;
}

function parseFactArgs(args: string[]): ParsedFactArgs {
  const parsed: ParsedFactArgs = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    const next = (): string => {
      const value = args[++i];
      if (value === undefined) throw new FactCliError("bad_arguments", `missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case "--":
        break;
      case "--statement":
        parsed.statement = next();
        break;
      case "--source-ref":
        parsed.sourceRef = next();
        break;
      case "--observed-at":
        parsed.observedAt = next();
        break;
      case "--confidence": {
        const value = Number(next());
        if (!Number.isFinite(value)) throw new FactCliError("bad_arguments", "--confidence must be a number");
        parsed.confidence = value;
        break;
      }
      case "--supersedes":
        parsed.supersedes = next();
        break;
      case "--min-confidence": {
        const value = Number(next());
        if (!Number.isFinite(value)) throw new FactCliError("bad_arguments", "--min-confidence must be a number");
        parsed.minConfidence = value;
        break;
      }
      case "--limit": {
        const value = Number.parseInt(next(), 10);
        if (!Number.isInteger(value) || value < 1) throw new FactCliError("bad_arguments", "--limit must be a positive integer");
        parsed.limit = value;
        break;
      }
      case "--file":
        parsed.file = next();
        break;
      case "--workspace":
        parsed.workspace = next();
        break;
      default:
        throw new FactCliError("bad_arguments", `unknown fact argument: ${arg}`);
    }
  }
  return parsed;
}

async function handleFact(
  rawArgs: string[],
  out: (t: string) => void,
  err: (t: string) => void,
): Promise<number> {
  const args = rawArgs.filter((a) => a !== "--");
  const sub = args[0];
  if (sub === undefined || sub === "--help" || sub === "-h") {
    out(USAGE);
    return sub === undefined ? 1 : 0;
  }

  try {
    const parsed = parseFactArgs(args.slice(1));
    if (sub === "add") {
      if (parsed.statement === undefined || parsed.sourceRef === undefined) {
        throw new FactCliError("bad_arguments", "fact add requires --statement and --source-ref (provenance)");
      }
      const result = await runFactAdd({
        statement: parsed.statement,
        sourceRef: parsed.sourceRef,
        ...(parsed.observedAt !== undefined ? { observedAt: parsed.observedAt } : {}),
        ...(parsed.confidence !== undefined ? { confidence: parsed.confidence } : {}),
        ...(parsed.supersedes !== undefined ? { supersedes: parsed.supersedes } : {}),
        ...(parsed.workspace !== undefined ? { workspace: parsed.workspace } : {}),
      });
      out(`${JSON.stringify(result)}\n`);
      return 0;
    }
    if (sub === "accept") {
      if (parsed.file === undefined) {
        throw new FactCliError("bad_arguments", "fact accept requires --file <proposal.json>");
      }
      let raw: string;
      try {
        raw = await readFile(parsed.file, "utf8");
      } catch (e) {
        throw new FactCliError("bad_arguments", `cannot read proposal file: ${parsed.file}`, {
          cause: e instanceof Error ? e.message : String(e),
        });
      }
      let proposal: unknown;
      try {
        proposal = JSON.parse(raw);
      } catch {
        throw new FactCliError("invalid_proposal", "proposal is not valid JSON");
      }
      const result = await runFactAccept({
        proposal,
        ...(parsed.workspace !== undefined ? { workspace: parsed.workspace } : {}),
      });
      out(`${JSON.stringify(result)}\n`);
      return result.ok ? 0 : 1;
    }
    if (sub === "list") {
      const result = await runFactList({
        ...(parsed.sourceRef !== undefined ? { sourceRef: parsed.sourceRef } : {}),
        ...(parsed.minConfidence !== undefined ? { minConfidence: parsed.minConfidence } : {}),
        ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
        ...(parsed.workspace !== undefined ? { workspace: parsed.workspace } : {}),
      });
      out(`${JSON.stringify(result)}\n`);
      return 0;
    }
    err(`${JSON.stringify(errorEnvelope(new FactCliError("bad_arguments", `unknown fact subcommand: ${sub}`)))}\n`);
    return 1;
  } catch (e) {
    err(`${JSON.stringify(errorEnvelope(e))}\n`);
    return 1;
  }
}

async function handleDistill(
  rawArgs: string[],
  out: (t: string) => void,
  err: (t: string) => void,
  stdin: Readable | NodeJS.ReadStream,
): Promise<number> {
  const args = rawArgs.filter((a) => a !== "--");
  const sub = args[0];
  if (sub === undefined || sub === "--help" || sub === "-h") {
    out(USAGE);
    return sub === undefined ? 1 : 0;
  }

  let parsed: ParsedDistillArgs;
  try {
    parsed = parseDistillArgs(args.slice(1));
  } catch (e) {
    err(`${JSON.stringify(errorEnvelope(e))}\n`);
    return 1;
  }

  try {
    if (sub === "propose") {
      const result = await runDistillPropose({
        ...(parsed.workspace !== undefined ? { workspace: parsed.workspace } : {}),
        ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
      });
      out(`${JSON.stringify(result)}\n`);
      return 0;
    }
    if (sub === "accept") {
      let raw: string;
      if (parsed.file !== undefined) {
        try {
          raw = await readFile(parsed.file, "utf8");
        } catch (e) {
          throw new DistillCliError("bad_arguments", `cannot read proposal file: ${parsed.file}`, {
            cause: e instanceof Error ? e.message : String(e),
          });
        }
      } else {
        const isTty = "isTTY" in stdin && (stdin as NodeJS.ReadStream).isTTY === true;
        raw = isTty ? "" : await readStream(stdin);
      }
      if (raw.trim().length === 0) {
        throw new DistillCliError(
          "bad_arguments",
          "no proposal provided: pass --file <path> or pipe proposal JSON via stdin",
        );
      }
      let proposal: unknown;
      try {
        proposal = JSON.parse(raw);
      } catch {
        throw new DistillCliError("bad_proposal", "proposal is not valid JSON");
      }
      const result = await runDistillAccept({
        proposal,
        ...(parsed.workspace !== undefined ? { workspace: parsed.workspace } : {}),
      });
      out(`${JSON.stringify(result)}\n`);
      return 0;
    }
    err(`${JSON.stringify(errorEnvelope(new CaptureCliError("bad_arguments", `unknown distill subcommand: ${sub}`)))}\n`);
    return 1;
  } catch (e) {
    err(`${JSON.stringify(errorEnvelope(e))}\n`);
    return 1;
  }
}

async function handleRebuild(
  rawArgs: string[],
  out: (t: string) => void,
  err: (t: string) => void,
): Promise<number> {
  const args = rawArgs.filter((a) => a !== "--");
  if (args[0] === "--help" || args[0] === "-h") {
    out(USAGE);
    return 0;
  }
  let workspace: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === "--workspace") {
      workspace = requireValue(args, ++i, arg);
      continue;
    }
    err(`${JSON.stringify(errorEnvelope(new CaptureCliError("bad_arguments", `unknown argument: ${arg}`)))}\n`);
    return 1;
  }
  try {
    const result = await runRebuild(workspace !== undefined ? { workspace } : {});
    out(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (e) {
    err(`${JSON.stringify(errorEnvelope(e))}\n`);
    return 1;
  }
}

async function handleIndex(
  rawArgs: string[],
  out: (t: string) => void,
  err: (t: string) => void,
): Promise<number> {
  const args = rawArgs.filter((a) => a !== "--");
  if (args[0] === "--help" || args[0] === "-h") {
    out(USAGE);
    return 0;
  }
  let workspace: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === "--workspace") {
      workspace = requireValue(args, ++i, arg);
      continue;
    }
    err(`${JSON.stringify(errorEnvelope(new CaptureCliError("bad_arguments", `unknown argument: ${arg}`)))}\n`);
    return 1;
  }
  try {
    const result = await runIndex(workspace !== undefined ? { workspace } : {});
    out(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (e) {
    err(`${JSON.stringify(errorEnvelope(e))}\n`);
    return 1;
  }
}

async function handleQuery(
  rawArgs: string[],
  out: (t: string) => void,
  err: (t: string) => void,
): Promise<number> {
  const args = rawArgs.filter((a) => a !== "--");
  if (args[0] === "--help" || args[0] === "-h") {
    out(USAGE);
    return 0;
  }
  let q: string | undefined;
  let k: number | undefined;
  let mode: string | undefined;
  let workspace: string | undefined;
  try {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i] as string;
      switch (arg) {
        case "--workspace":
          workspace = requireValue(args, ++i, arg);
          break;
        case "--mode":
          mode = requireValue(args, ++i, arg);
          break;
        case "--k": {
          const value = requireValue(args, ++i, arg);
          const n = Number.parseInt(value, 10);
          if (!Number.isInteger(n) || n < 1) {
            throw new CaptureCliError("bad_arguments", `--k must be a positive integer: ${value}`);
          }
          k = n;
          break;
        }
        default:
          if (arg.startsWith("--")) {
            throw new CaptureCliError("bad_arguments", `unknown argument: ${arg}`);
          }
          if (q !== undefined) {
            throw new CaptureCliError("bad_arguments", `unexpected extra argument: ${arg}`);
          }
          q = arg;
      }
    }
  } catch (e) {
    err(`${JSON.stringify(errorEnvelope(e))}\n`);
    return 1;
  }
  try {
    const result = await runQuery({
      q: q ?? "",
      ...(k !== undefined ? { k } : {}),
      ...(mode !== undefined ? { mode } : {}),
      ...(workspace !== undefined ? { workspace } : {}),
    });
    out(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (e) {
    err(`${JSON.stringify(errorEnvelope(e))}\n`);
    return 1;
  }
}

// Auto-run only when executed directly (not when imported by tests).
const invokedDirectly = processArgv[1] !== undefined && resolve(processArgv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  void main(processArgv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
