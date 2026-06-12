/**
 * Dashboard HTTP server (SB-081/082, OQ #33/#35 + the approved amendment):
 * zero-runtime-dependency `node:http`, bound to 127.0.0.1 ONLY (never
 * 0.0.0.0 — the localhost binding is the documented v1 boundary; no auth).
 * Every response — JSON, static, and errors alike — carries the strict
 * security headers. All core access flows through the enforced dispatch as
 * `surface:dashboard`. secure_refs have no endpoint by design.
 *
 * Same-origin write guard (amendment): every MUTATING endpoint requires the
 * server-issued per-start nonce echoed back as `X-SB-CSRF`. The page obtains
 * it from `GET /api/session`; with no CORS headers anywhere, a cross-site
 * script can never read that response, so it can never present the token.
 * A present-but-foreign `Origin` header is rejected as well (belt and
 * braces). Missing/wrong token ⇒ 403 `csrf_rejected`, ZERO filesystem
 * writes — the request is refused before any dispatch happens.
 */
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { invoke } from "./invoke.js";

const STATIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "static");

/** Exact-name whitelist — no path traversal surface exists. */
const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
};

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

export interface DashboardServer {
  server: Server;
  port: number;
  url: string;
}

interface ErrorEnvelope {
  ok: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
}

function statusFor(code: string): number {
  if (code === "scope_denied") return 403;
  if (code === "not_found") return 404;
  // caller-input rejections from the dispatch (validation codes) are 4xx
  if (/^(bad_|invalid_|empty_|missing_|unsupported_)/.test(code)) return 400;
  return 500;
}

function send(res: ServerResponse, status: number, type: string, body: string): void {
  res.writeHead(status, { "Content-Type": type, ...SECURITY_HEADERS });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(payload));
}

/** Map a failed dispatch to a passthrough envelope (payload-free by upstream design). */
function sendDispatchError(res: ServerResponse, stderr: string): void {
  let envelope: ErrorEnvelope;
  try {
    envelope = JSON.parse(stderr) as ErrorEnvelope;
  } catch {
    envelope = { ok: false, error: { code: "error", message: "dispatch failed" } };
  }
  sendJson(res, statusFor(envelope.error?.code ?? "error"), envelope);
}

interface ListedNote {
  id: string;
  type: string | null;
  title: string | null;
}

function parseNoteList(stdout: string): ListedNote[] {
  return stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [id = "", type = "-", title = ""] = line.split("\t");
      return { id, type: type === "-" ? null : type, title: title.length > 0 ? title : null };
    })
    .filter((note) => note.id.length > 0);
}

const BODY_LIMIT_BYTES = 1024 * 1024;

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer);
    size += buf.length;
    if (size > BODY_LIMIT_BYTES) throw new Error("body_too_large");
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * The same-origin write guard (approved amendment). Returns true when the
 * request may proceed; otherwise responds 403 `csrf_rejected` itself.
 * Checked BEFORE any body parsing or dispatch — a rejected request performs
 * zero filesystem writes by construction.
 */
function writeGuardPasses(
  req: IncomingMessage,
  res: ServerResponse,
  csrfToken: string,
  selfOrigins: ReadonlySet<string>,
): boolean {
  const token = req.headers["x-sb-csrf"];
  const origin = req.headers.origin;
  const tokenOk = typeof token === "string" && token === csrfToken;
  // Origin is absent for same-machine tools (curl); when PRESENT it must be us
  // (both loopback spellings count — browsers may use localhost or 127.0.0.1).
  const originOk = origin === undefined || selfOrigins.has(origin);
  if (tokenOk && originOk) return true;
  sendJson(res, 403, {
    ok: false,
    error: {
      code: "csrf_rejected",
      message: "mutating requests require the server-issued X-SB-CSRF token from a same-origin page",
    },
  });
  return false;
}

interface CaptureBody {
  content?: unknown;
  source?: unknown;
  title?: unknown;
  tags?: unknown;
}

async function handleCapture(
  req: IncomingMessage,
  res: ServerResponse,
  workspace: string,
): Promise<void> {
  let body: CaptureBody;
  try {
    body = JSON.parse(await readBody(req)) as CaptureBody;
  } catch (error: unknown) {
    const tooLarge = error instanceof Error && error.message === "body_too_large";
    sendJson(res, tooLarge ? 413 : 400, {
      ok: false,
      error: { code: tooLarge ? "body_too_large" : "bad_arguments", message: tooLarge ? "request body exceeds 1MB" : "body must be valid JSON" },
    });
    return;
  }
  // fail fast at the boundary; the capture op re-validates source kinds etc.
  if (typeof body.content !== "string" || body.content.trim().length === 0) {
    sendJson(res, 400, { ok: false, error: { code: "bad_arguments", message: "content must be a non-empty string" } });
    return;
  }
  if (typeof body.source !== "string" || body.source.length === 0) {
    sendJson(res, 400, { ok: false, error: { code: "bad_arguments", message: "source is required" } });
    return;
  }
  const argv = ["capture", "--content", body.content, "--source", body.source];
  if (typeof body.title === "string" && body.title.length > 0) argv.push("--title", body.title);
  if (Array.isArray(body.tags)) {
    const tags = body.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
    if (tags.length > 0) argv.push("--tag", tags.join(","));
  }
  argv.push("--workspace", workspace);

  const result = await invoke(argv);
  if (result.exitCode !== 0) return sendDispatchError(res, result.stderr);
  send(res, 200, "application/json; charset=utf-8", result.stdout);
}

/**
 * Review-queue accepts (SB-083, OQ #35): the HUMAN-REVIEWED proposal JSON is
 * passed VERBATIM into the unchanged whole-file-validated accept paths —
 * written to a tmp file OUTSIDE the workspace and handed to
 * `distill accept --file` / `fact accept --file`. Invalid proposal ⇒ the
 * core writes nothing (exactly the Phase 4 contract, surfaced over HTTP).
 * The dashboard never generates or edits proposals.
 */
async function handleAccept(
  req: IncomingMessage,
  res: ServerResponse,
  workspace: string,
  kind: "distill" | "fact",
): Promise<void> {
  let proposalText: string;
  try {
    proposalText = await readBody(req);
    JSON.parse(proposalText); // fail fast; the core re-validates the whole file
  } catch (error: unknown) {
    const tooLarge = error instanceof Error && error.message === "body_too_large";
    sendJson(res, tooLarge ? 413 : 400, {
      ok: false,
      error: { code: tooLarge ? "body_too_large" : "invalid_proposal", message: tooLarge ? "request body exceeds 1MB" : "proposal must be valid JSON" },
    });
    return;
  }
  const tmpPath = join(tmpdir(), `sb-dashboard-proposal-${randomBytes(8).toString("hex")}.json`);
  try {
    await writeFile(tmpPath, proposalText, "utf8");
    const result = await invoke([kind, "accept", "--file", tmpPath, "--workspace", workspace]);
    if (result.exitCode !== 0) {
      // fact accept reports per-item runtime failures on stdout with exit 1
      if (result.stderr.trim().length === 0 && result.stdout.trim().length > 0) {
        send(res, 422, "application/json; charset=utf-8", result.stdout);
        return;
      }
      return sendDispatchError(res, result.stderr);
    }
    send(res, 200, "application/json; charset=utf-8", result.stdout);
  } finally {
    await rm(tmpPath, { force: true });
  }
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  workspace: string,
  csrfToken: string,
  selfOrigins: ReadonlySet<string>,
): Promise<void> {
  // session: hands the page the write-guard token (same-origin readable only)
  if (url.pathname === "/api/session" && req.method === "GET") {
    sendJson(res, 200, { ok: true, csrf: csrfToken });
    return;
  }

  // review queue (SB-083): read-only candidates + guarded accepts
  if (url.pathname === "/api/distill/candidates" && req.method === "GET") {
    const result = await invoke(["distill", "propose", "--workspace", workspace]);
    if (result.exitCode !== 0) return sendDispatchError(res, result.stderr);
    send(res, 200, "application/json; charset=utf-8", result.stdout);
    return;
  }
  if (url.pathname === "/api/distill/accept" || url.pathname === "/api/fact/accept") {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: { code: "method_not_allowed", message: "accept is POST-only" } });
      return;
    }
    if (!writeGuardPasses(req, res, csrfToken, selfOrigins)) return;
    await handleAccept(req, res, workspace, url.pathname === "/api/distill/accept" ? "distill" : "fact");
    return;
  }

  // the ONLY mutating endpoint in v1 — guarded BEFORE anything else happens
  if (url.pathname === "/api/capture") {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: { code: "method_not_allowed", message: "capture is POST-only" } });
      return;
    }
    if (!writeGuardPasses(req, res, csrfToken, selfOrigins)) return;
    await handleCapture(req, res, workspace);
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: { code: "method_not_allowed", message: "read-only endpoint" } });
    return;
  }

  if (url.pathname === "/api/notes") {
    const type = url.searchParams.get("type");
    const argv = ["note", "list", "--workspace", workspace];
    if (type !== null && type.length > 0) argv.push("--type", type);
    const result = await invoke(argv);
    if (result.exitCode !== 0) return sendDispatchError(res, result.stderr);
    sendJson(res, 200, { ok: true, notes: parseNoteList(result.stdout) });
    return;
  }

  const noteMatch = /^\/api\/notes\/([0-7][0-9A-HJKMNP-TV-Z]{25})$/.exec(url.pathname);
  if (noteMatch !== null) {
    const id = noteMatch[1] as string;
    const result = await invoke(["note", "get", id, "--workspace", workspace]);
    if (result.exitCode !== 0) return sendDispatchError(res, result.stderr);
    sendJson(res, 200, { ok: true, id, content: result.stdout });
    return;
  }
  if (url.pathname.startsWith("/api/notes/")) {
    sendJson(res, 400, { ok: false, error: { code: "invalid_ulid", message: "note id must be a canonical ULID" } });
    return;
  }

  if (url.pathname === "/api/facts") {
    const result = await invoke(["fact", "list", "--workspace", workspace]);
    if (result.exitCode !== 0) return sendDispatchError(res, result.stderr);
    send(res, 200, "application/json; charset=utf-8", result.stdout);
    return;
  }

  sendJson(res, 404, { ok: false, error: { code: "not_found", message: "unknown api route" } });
}

async function handleStatic(res: ServerResponse, pathname: string): Promise<boolean> {
  const entry = STATIC_FILES[pathname];
  if (entry === undefined) return false;
  const body = await readFile(join(STATIC_DIR, entry.file), "utf8");
  send(res, 200, entry.type, body);
  return true;
}

/**
 * Start the dashboard bound to 127.0.0.1. `port: 0` (tests) picks an
 * ephemeral port. The returned server is the caller's to close.
 */
export async function startDashboard(workspace: string, port = 8765): Promise<DashboardServer> {
  // per-server-start nonce for the same-origin write guard (amendment)
  const csrfToken = randomBytes(32).toString("hex");
  const selfOrigins = new Set<string>();

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const route = url.pathname.startsWith("/api/")
      ? handleApi(req, res, url, workspace, csrfToken, selfOrigins)
      : handleStatic(res, url.pathname).then((served) => {
          if (!served) {
            sendJson(res, 404, { ok: false, error: { code: "not_found", message: "unknown route" } });
          }
        });
    route.catch(() => {
      // fail closed without leaking internals
      sendJson(res, 500, { ok: false, error: { code: "error", message: "internal error" } });
    });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    // 127.0.0.1 ONLY — never 0.0.0.0 (OQ #33; the binding is the v1 boundary)
    server.listen(port, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  const boundPort = typeof address === "object" && address !== null ? address.port : port;
  selfOrigins.add(`http://127.0.0.1:${boundPort}`);
  selfOrigins.add(`http://localhost:${boundPort}`);
  return { server, port: boundPort, url: `http://127.0.0.1:${boundPort}/` };
}
