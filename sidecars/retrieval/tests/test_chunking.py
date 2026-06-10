"""Unit tests for the heading-aware chunker (pure)."""

from retrieval_sidecar.chunking import TARGET_TOKENS, chunk_note, estimate_tokens


def test_short_note_is_one_chunk_with_title_prepended() -> None:
    chunks = chunk_note("01ARZ3NDEKTSV4RRFFQ69G5FAV", "My Title", "Just a short body.")
    assert len(chunks) == 1
    assert chunks[0].chunk_id == "01ARZ3NDEKTSV4RRFFQ69G5FAV#0"
    assert chunks[0].seq == 0
    assert chunks[0].text.startswith("My Title")
    assert "short body" in chunks[0].text


def test_long_note_splits_into_sequenced_chunks() -> None:
    sections = [f"## Section {i}\n\n" + ("word " * 300) for i in range(8)]
    chunks = chunk_note("01ARZ3NDEKTSV4RRFFQ69G5FAV", "Long", "\n\n".join(sections))
    assert len(chunks) > 1
    assert [c.seq for c in chunks] == list(range(len(chunks)))
    assert all(c.chunk_id == f"{c.note_id}#{c.seq}" for c in chunks)
    # each chunk stays in the ballpark of the target (packing never doubles it)
    assert all(estimate_tokens(c.text) <= TARGET_TOKENS * 2 for c in chunks)


def test_heading_boundaries_are_respected_where_possible() -> None:
    body = "## Alpha\n\n" + ("a " * 900) + "\n\n## Beta\n\n" + ("b " * 900)
    chunks = chunk_note("01ARZ3NDEKTSV4RRFFQ69G5FAV", "", body)
    alpha_chunks = [c for c in chunks if "Alpha" in c.text]
    beta_chunks = [c for c in chunks if "## Beta" in c.text]
    assert alpha_chunks and beta_chunks
    assert not any("## Beta" in c.text for c in alpha_chunks)


def test_chunking_is_deterministic() -> None:
    body = "## H\n\n" + ("x " * 2000)
    first = chunk_note("01ARZ3NDEKTSV4RRFFQ69G5FAV", "T", body)
    second = chunk_note("01ARZ3NDEKTSV4RRFFQ69G5FAV", "T", body)
    assert first == second


def test_empty_body_with_title_still_indexable() -> None:
    chunks = chunk_note("01ARZ3NDEKTSV4RRFFQ69G5FAV", "Only A Title", "")
    assert len(chunks) == 1
    assert chunks[0].text == "Only A Title"


def test_empty_body_without_title_yields_no_chunks() -> None:
    assert chunk_note("01ARZ3NDEKTSV4RRFFQ69G5FAV", "", "") == []
