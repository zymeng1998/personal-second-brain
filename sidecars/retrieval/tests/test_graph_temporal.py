"""SB-055 acceptance tests: graph + temporal indexes and query filters."""

import json
from pathlib import Path

import duckdb
import pytest

from retrieval_sidecar.errors import OpError
from retrieval_sidecar.indexer import op_index_vault
from retrieval_sidecar.querying import op_query

from conftest import ULID_A, ULID_B, ULID_C, requires_model, write_note

pytestmark = requires_model

OLD_TS = "2025-01-05T10:00:00Z"
NEW_TS = "2026-06-01T10:00:00Z"


def write_dated_note(
    vault: Path, note_id: str, title: str, body: str, created: str, entities: list[str] | None = None
) -> None:
    folder = vault / "00_Raw"
    folder.mkdir(parents=True, exist_ok=True)
    entity_block = ""
    if entities:
        entity_block = "entities:\n" + "".join(f"  - {e}\n" for e in entities)
    (folder / f"{note_id}--note.md").write_text(
        f"---\nid: {note_id}\ntype: raw\nlayer: 0\ncreated: {created}\ntitle: {title}\n{entity_block}---\n\n{body}\n",
        encoding="utf-8",
    )


@pytest.fixture
def linked_workspace(workspace: Path) -> Path:
    vault = workspace / "vault"
    # A wikilinks to B's title and entity-refs C; created dates straddle 2026-01-01
    write_dated_note(
        vault, ULID_A, "Espresso brewing",
        "Grind size matters. See [[Garden plan]] for the patio layout.",
        NEW_TS, entities=[ULID_C],
    )
    write_dated_note(
        vault, ULID_B, "Garden plan", "Tomatoes and basil for the summer garden bed.", OLD_TS
    )
    write_dated_note(
        vault, ULID_C, "Meeting notes", "Quarterly planning discussion. Espresso budget.", OLD_TS
    )
    op_index_vault({"workspace": str(workspace)})
    return workspace


def edges_of(workspace: Path) -> set[tuple[str, str, str, str]]:
    connection = duckdb.connect(str(workspace / "indexes" / "retrieval.duckdb"), read_only=True)
    try:
        return set(connection.execute("SELECT * FROM graph_edges").fetchall())
    finally:
        connection.close()


def test_wikilink_and_entity_edges_with_provenance(linked_workspace: Path) -> None:
    assert edges_of(linked_workspace) == {
        (ULID_A, ULID_B, "wikilink", ULID_A),
        (ULID_A, ULID_C, "entity_ref", ULID_A),
    }


def test_unresolved_wikilink_and_self_link_skipped(workspace: Path) -> None:
    vault = workspace / "vault"
    write_dated_note(
        vault, ULID_A, "Self note", "See [[Self note]] and [[No Such Note]].", NEW_TS
    )
    op_index_vault({"workspace": str(workspace)})
    assert edges_of(workspace) == set()


def test_event_timestamps_feed_the_temporal_index(workspace: Path) -> None:
    vault = workspace / "vault"
    write_dated_note(vault, ULID_A, "Espresso brewing", "Grind size matters.", OLD_TS)
    events_dir = workspace / "events"
    events_dir.mkdir()
    event = {
        "event_id": ULID_B, "stream": "capture", "kind": "captured",
        "occurred_at": NEW_TS, "actor": "cli", "subject_id": ULID_A,
    }
    (events_dir / "capture_events.jsonl").write_text(json.dumps(event) + "\n", encoding="utf-8")
    op_index_vault({"workspace": str(workspace)})
    # the note's frontmatter date is OLD, but its capture event is NEW -> in range
    hits = op_query(
        {"workspace": str(workspace), "q": "espresso", "mode": "lexical",
         "filters": {"from": "2026-01-01T00:00:00Z"}}
    )["hits"]
    assert hits and hits[0]["source_ref"] == ULID_A


def test_time_range_filter_excludes_out_of_range_notes(linked_workspace: Path) -> None:
    base = {"workspace": str(linked_workspace), "q": "espresso", "mode": "lexical"}
    unfiltered = op_query(base)["hits"]
    assert {h["source_ref"] for h in unfiltered} == {ULID_A, ULID_C}
    recent = op_query({**base, "filters": {"from": "2026-01-01T00:00:00Z"}})["hits"]
    assert {h["source_ref"] for h in recent} == {ULID_A}
    old = op_query({**base, "filters": {"to": "2025-12-31T00:00:00Z"}})["hits"]
    assert {h["source_ref"] for h in old} == {ULID_C}


def test_near_filter_restricts_to_graph_neighborhood(linked_workspace: Path) -> None:
    base = {"workspace": str(linked_workspace), "q": "garden espresso quarterly", "mode": "lexical", "k": 10}
    near_b = op_query({**base, "filters": {"near": ULID_B}})["hits"]
    # B's 1-hop neighborhood = {B, A}; C must be excluded
    assert {h["source_ref"] for h in near_b} <= {ULID_A, ULID_B}
    assert {h["source_ref"] for h in near_b} == {ULID_A, ULID_B}


def test_filters_compose_with_hybrid_mode(linked_workspace: Path) -> None:
    base = {"workspace": str(linked_workspace), "q": "espresso", "k": 10}
    hybrid_all = op_query(base)["hits"]  # hybrid default
    assert {h["source_ref"] for h in hybrid_all} >= {ULID_A, ULID_C}
    filtered = op_query({**base, "filters": {"from": "2026-01-01T00:00:00Z"}})["hits"]
    assert filtered and {h["source_ref"] for h in filtered} == {ULID_A}
    # near + time-range intersect: neighborhood of B that is also recent = {A}
    both = op_query({**base, "filters": {"near": ULID_B, "from": "2026-01-01T00:00:00Z"}})["hits"]
    assert {h["source_ref"] for h in both} == {ULID_A}


def test_empty_filter_result_short_circuits(linked_workspace: Path) -> None:
    hits = op_query(
        {"workspace": str(linked_workspace), "q": "espresso",
         "filters": {"from": "2030-01-01T00:00:00Z"}}
    )["hits"]
    assert hits == []


def test_invalid_filters_rejected(linked_workspace: Path) -> None:
    base = {"workspace": str(linked_workspace), "q": "x"}
    for bad in [
        {**base, "filters": "recent"},
        {**base, "filters": {"near": ""}},
        {**base, "filters": {"from": "not-a-date"}},
        {**base, "filters": {"until": "2026-01-01"}},
    ]:
        with pytest.raises(OpError) as excinfo:
            op_query(bad)
        assert excinfo.value.code == "invalid_args"


def test_filtered_rebuild_is_lossless(linked_workspace: Path) -> None:
    query = {
        "workspace": str(linked_workspace), "q": "espresso",
        "filters": {"near": ULID_B, "from": "2026-01-01T00:00:00Z"},
    }
    baseline = op_query(query)
    op_index_vault({"workspace": str(linked_workspace)})
    assert op_query(query) == baseline


def test_filter_clause_stays_bounded_for_large_allowed_sets():
    """Review MEDIUM #5: the filter must bind ONE list parameter, not one
    placeholder per allowed note id (unbounded SQL growth)."""
    from retrieval_sidecar.querying import _in_clause

    allowed = {f"01ARZ3NDEKTSV4RRFFQ69G5{i:03d}" for i in range(5000)}
    clause, params = _in_clause("note_id", allowed)
    assert clause.count("?") == 1
    assert len(params) == 1
    assert params[0] == sorted(allowed)
    assert _in_clause("note_id", None) == ("", [])
