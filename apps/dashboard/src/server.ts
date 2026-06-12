/**
 * Dashboard HTTP server (SB-081, OQ #33): zero-runtime-dependency
 * `node:http`, bound to 127.0.0.1 ONLY (never 0.0.0.0 — the localhost
 * binding is the documented v1 boundary; no auth). Every response — JSON,
 * static, and errors alike — carries the strict security headers. All core
 * access flows through the enforced dispatch as `surface:dashboard`.
 * secure_refs have no endpoint by design: nothing to render, nothing to leak.
 */
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
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
  if (code === "bad_arguments" || code === "invalid_ulid") return 400;
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

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  workspace: string,
): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: { code: "method_not_allowed", message: "read-only v1 endpoint" } });
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
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const route = url.pathname.startsWith("/api/")
      ? handleApi(req, res, url, workspace)
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
  return { server, port: boundPort, url: `http://127.0.0.1:${boundPort}/` };
}
