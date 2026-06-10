"""OQ #9 CPU benchmark: embedding model speed on this machine.

Usage: uv run python benchmarks/bench_embed.py BAAI/bge-m3 [n_chunks]

Reports model load time, indexing throughput over synthetic ~512-token chunks,
and single-query embed latency (median of 5). Output is one JSON line.
"""

from __future__ import annotations

import json
import random
import statistics
import sys
import time

WORDS = (
    "espresso garden meeting projection retrieval vault notebook schedule "
    "quarterly maintenance workshop binder library kernel index query memory "
    "chunk heading embedding vector lexical hybrid ranking provenance event"
).split()


def synthetic_chunk(rng: random.Random, n_words: int = 380) -> str:
    return " ".join(rng.choice(WORDS) for _ in range(n_words))


def main() -> None:
    model_name = sys.argv[1] if len(sys.argv) > 1 else "BAAI/bge-m3"
    n_chunks = int(sys.argv[2]) if len(sys.argv) > 2 else 32

    from sentence_transformers import SentenceTransformer

    t0 = time.perf_counter()
    model = SentenceTransformer(model_name, device="cpu")
    load_s = time.perf_counter() - t0

    rng = random.Random(42)
    chunks = [synthetic_chunk(rng) for _ in range(n_chunks)]

    t0 = time.perf_counter()
    vectors = model.encode(chunks, batch_size=8, show_progress_bar=False, normalize_embeddings=True)
    index_s = time.perf_counter() - t0

    query_times = []
    for _ in range(5):
        t0 = time.perf_counter()
        model.encode(["espresso maintenance schedule"], show_progress_bar=False, normalize_embeddings=True)
        query_times.append(time.perf_counter() - t0)

    print(
        json.dumps(
            {
                "model": model_name,
                "dim": int(vectors.shape[1]),
                "load_s": round(load_s, 2),
                "n_chunks": n_chunks,
                "index_s": round(index_s, 2),
                "chunks_per_s": round(n_chunks / index_s, 2),
                "query_embed_median_s": round(statistics.median(query_times), 3),
            }
        )
    )


if __name__ == "__main__":
    main()
