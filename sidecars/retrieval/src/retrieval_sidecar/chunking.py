"""Heading-aware ~512-token chunking (OQ #20). Pure + deterministic.

Token counts are estimated at ~4 characters/token. Sections split at markdown
headings; sections are packed into chunks up to the target, and an oversized
single section falls back to paragraph packing (then a hard character split).
Chunk ids are `<note ULID>#<seq>` with seq starting at 0.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

TARGET_TOKENS = 512
_CHARS_PER_TOKEN = 4
_TARGET_CHARS = TARGET_TOKENS * _CHARS_PER_TOKEN
_HEADING_RE = re.compile(r"^#{1,6} ")


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    note_id: str
    seq: int
    text: str


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // _CHARS_PER_TOKEN)


def _split_sections(body: str) -> list[str]:
    sections: list[str] = []
    current: list[str] = []
    for line in body.splitlines():
        if _HEADING_RE.match(line) and current:
            section = "\n".join(current).strip()
            if section:
                sections.append(section)
            current = [line]
        else:
            current.append(line)
    tail = "\n".join(current).strip()
    if tail:
        sections.append(tail)
    return sections


def _split_oversized(section: str) -> list[str]:
    if len(section) <= _TARGET_CHARS:
        return [section]
    pieces: list[str] = []
    for paragraph in section.split("\n\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        if len(paragraph) <= _TARGET_CHARS:
            pieces.append(paragraph)
        else:  # pathological single paragraph: hard split
            pieces.extend(
                paragraph[i : i + _TARGET_CHARS] for i in range(0, len(paragraph), _TARGET_CHARS)
            )
    return pieces


def _pack(pieces: list[str]) -> list[str]:
    chunks: list[str] = []
    buffer: list[str] = []
    buffered_chars = 0
    for piece in pieces:
        if buffer and buffered_chars + len(piece) > _TARGET_CHARS:
            chunks.append("\n\n".join(buffer))
            buffer, buffered_chars = [], 0
        buffer.append(piece)
        buffered_chars += len(piece)
    if buffer:
        chunks.append("\n\n".join(buffer))
    return chunks


def chunk_note(note_id: str, title: str, body: str) -> list[Chunk]:
    """Chunk one note body. The title is prepended to the first chunk's text so
    titles stay searchable without a separate index column."""
    pieces: list[str] = []
    for section in _split_sections(body):
        pieces.extend(_split_oversized(section))
    texts = _pack(pieces)
    if not texts and title:
        texts = [""]
    if texts and title:
        texts[0] = f"{title}\n\n{texts[0]}".strip()
    return [
        Chunk(chunk_id=f"{note_id}#{seq}", note_id=note_id, seq=seq, text=text)
        for seq, text in enumerate(texts)
    ]
