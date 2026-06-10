"""stdio JSONL server loop: one request line in, one response line out.

stdout carries response envelopes ONLY; all logging goes to stderr. The loop
ends cleanly on stdin EOF.
"""

from __future__ import annotations

import json
import sys
from typing import IO

from .protocol import handle_line


def serve(stdin: IO[str], stdout: IO[str], stderr: IO[str]) -> int:
    for line in stdin:
        response = handle_line(line)
        if response is None:
            continue
        stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
        stdout.flush()
        if not response["ok"]:
            error = response["error"]
            print(f"[retrieval-sidecar] {error['code']}: {error['message']}", file=stderr)
    return 0


def main() -> int:
    return serve(sys.stdin, sys.stdout, sys.stderr)
