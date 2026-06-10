"""Embedding model wrapper (SB-049, OQ #9).

Default model: bge-small-en-v1.5 (384-d) — the documented OQ #9 fallback.
BGE-M3 is NOT loadable on this machine: its repo ships only pytorch_model.bin,
transformers requires torch>=2.6 to load .bin files (CVE-2025-32434), and torch
on macOS x86_64 caps at 2.2.2. Override via SB_EMBED_MODEL if the environment
ever changes. The model cache is the default HF cache (~/.cache/huggingface) —
OUTSIDE the workspace per OQ #19.

Loading is lazy so ping/health/lexical paths never pay the model cost.
"""

from __future__ import annotations

import os
from typing import Any

from .errors import OpError

DEFAULT_MODEL = "BAAI/bge-small-en-v1.5"
ENV_MODEL = "SB_EMBED_MODEL"
# bge retrieval models want this prefix on QUERIES (not passages)
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

_models: dict[str, Any] = {}


def model_name() -> str:
    return os.environ.get(ENV_MODEL, DEFAULT_MODEL)


def model_available() -> bool:
    """True if the model is already in the local HF cache (no network needed)."""
    try:
        from huggingface_hub import snapshot_download

        snapshot_download(model_name(), local_files_only=True)
        return True
    except Exception:
        return False


def _get_model() -> Any:
    name = model_name()
    if name not in _models:
        try:
            from sentence_transformers import SentenceTransformer

            _models[name] = SentenceTransformer(name, device="cpu")
        except Exception as exc:
            raise OpError(
                "embed_model_unavailable",
                f"cannot load embedding model '{name}': {type(exc).__name__}: {exc}",
            ) from exc
    return _models[name]


def embedding_dim() -> int:
    return int(_get_model().get_sentence_embedding_dimension())


def embed_passages(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    vectors = _get_model().encode(
        texts, batch_size=8, normalize_embeddings=True, show_progress_bar=False
    )
    return [vector.tolist() for vector in vectors]


def embed_query(q: str) -> list[float]:
    vector = _get_model().encode(
        [QUERY_PREFIX + q], normalize_embeddings=True, show_progress_bar=False
    )
    return vector[0].tolist()
