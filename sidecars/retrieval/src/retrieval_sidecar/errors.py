"""Structured operation errors. Raised inside op handlers; the protocol layer
converts them into `{ok:false, error:{code,message}}` envelopes — they never
crash the loop and never leak a traceback to stdout."""

from __future__ import annotations


class OpError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
