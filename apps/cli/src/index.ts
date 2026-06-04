/**
 * @sb/cli entry (SB-013). Dispatches the `capture` command: parses flags, reads
 * stdin when `--content` is absent, runs the capture, and prints a structured
 * JSON result to stdout (or a structured error to stderr with a non-zero exit).
 */
import { resolve } from "node:path";
import { argv as processArgv } from "node:process";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { CaptureCliError, runCapture } from "./capture-command.js";

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

// Auto-run only when executed directly (not when imported by tests).
const invokedDirectly = processArgv[1] !== undefined && resolve(processArgv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  void main(processArgv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
