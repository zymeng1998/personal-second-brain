"""Pure request handling for the stdio JSONL protocol.

Envelope (mirrors @sb/interfaces retrieval.ts):
  request:  {"op": str, "req_id": str, "args"?: object}
  response: {"req_id": str, "ok": true, "data": object}
          | {"req_id": str, "ok": false, "error": {"code": str, "message": str}}

Errors are always structured responses — never exceptions across the boundary,
never a non-JSON stdout line. A line whose req_id cannot be recovered is
answered with req_id "".
"""

from __future__ import annotations

import json
import sys
from typing import Any, Callable

from . import __version__


def ok_response(req_id: str, data: dict[str, Any]) -> dict[str, Any]:
    return {"req_id": req_id, "ok": True, "data": data}


def error_response(req_id: str, code: str, message: str) -> dict[str, Any]:
    return {"req_id": req_id, "ok": False, "error": {"code": code, "message": message}}


def _op_ping(args: dict[str, Any]) -> dict[str, Any]:
    return {"pong": True}


def _op_health(args: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": __version__,
        "python": "%d.%d.%d" % sys.version_info[:3],
    }


OPS: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
    "ping": _op_ping,
    "health": _op_health,
}


def handle_request(request: dict[str, Any]) -> dict[str, Any]:
    """Dispatch one parsed request object to its op handler."""
    req_id = request.get("req_id")
    if not isinstance(req_id, str) or req_id == "":
        return error_response("", "malformed_request", "missing or invalid req_id")
    op = request.get("op")
    if not isinstance(op, str):
        return error_response(req_id, "malformed_request", "missing or invalid op")
    handler = OPS.get(op)
    if handler is None:
        return error_response(req_id, "unknown_op", f"unknown op: {op}")
    args = request.get("args")
    if args is None:
        args = {}
    if not isinstance(args, dict):
        return error_response(req_id, "malformed_request", "args must be an object")
    try:
        return ok_response(req_id, handler(args))
    except Exception as exc:  # never let an op crash the loop or leak a traceback to stdout
        return error_response(req_id, "internal_error", f"{type(exc).__name__}: {exc}")


def handle_line(line: str) -> dict[str, Any] | None:
    """Handle one raw stdin line. Returns a response object, or None for blank lines."""
    if line.strip() == "":
        return None
    try:
        parsed = json.loads(line)
    except ValueError:
        return error_response("", "malformed_request", "line is not valid JSON")
    if not isinstance(parsed, dict):
        return error_response("", "malformed_request", "request must be a JSON object")
    return handle_request(parsed)
