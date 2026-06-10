"""SB-031 acceptance tests: FTS build + lexical query on a fixture vault."""

from pathlib import Path

import pytest

from retrieval_sidecar.errors import OpError
from retrieval_sidecar.indexer import op_index_vault
from retrieval_sidecar.querying import op_query

from conftest import ULID_A, ULID_B, ULID_C, requires_model, snapshot_tree, write_note


@pytest.fixture
def seeded_workspace(workspace: Path) -> Path:
    vault = workspace / "vault"
    write_note(vault, ULID_A, "Espresso brewing", "Notes about espresso extraction and grind size.")
    write_note(vault, ULID_B, "Garden plan", "Tomatoes and basil for the summer garden bed.")
    write_note(
        vault, ULID_C, "Meeting notes", "Quarterly planning discussion. Espresso machine budget."
    )
    return workspace


@requires_model
def test_index_counts_notes_and_chunks(seeded_workspace: Path) -> None:
    data = op_index_vault({"workspace": str(seeded_workspace)})
    assert data["notes"] == 3
    assert data["chunks"] == 3  # short notes -> one chunk each
    assert data["built"] == ["fts", "vector", "graph", "temporal"]
    assert (seeded_workspace / "indexes" / "retrieval.duckdb").is_file()


@requires_model
def test_reindex_is_idempotent(seeded_workspace: Path) -> None:
    first = op_index_vault({"workspace": str(seeded_workspace)})
    second = op_index_vault({"workspace": str(seeded_workspace)})
    assert first == second
    query = {"workspace": str(seeded_workspace), "q": "espresso"}
    assert op_query(query) == op_query(query)


@requires_model
def test_query_returns_seeded_note_with_provenance(seeded_workspace: Path) -> None:
    op_index_vault({"workspace": str(seeded_workspace)})
    data = op_query({"workspace": str(seeded_workspace), "q": "tomatoes basil"})
    assert data["hits"], "expected at least one hit"
    top = data["hits"][0]
    assert top["source_ref"] == ULID_B
    assert top["id"] == f"{ULID_B}#0"
    assert top["score"] > 0
    assert "basil" in top["snippet"].lower()


@requires_model
def test_query_ranking_is_score_desc(seeded_workspace: Path) -> None:
    op_index_vault({"workspace": str(seeded_workspace)})
    data = op_query({"workspace": str(seeded_workspace), "q": "espresso", "k": 10, "mode": "lexical"})
    scores = [hit["score"] for hit in data["hits"]]
    assert scores == sorted(scores, reverse=True)
    assert {hit["source_ref"] for hit in data["hits"]} == {ULID_A, ULID_C}


@requires_model
def test_k_limits_results(seeded_workspace: Path) -> None:
    op_index_vault({"workspace": str(seeded_workspace)})
    data = op_query({"workspace": str(seeded_workspace), "q": "espresso", "k": 1})
    assert len(data["hits"]) == 1


@requires_model
def test_empty_vault_indexes_to_zero_and_queries_empty(workspace: Path) -> None:
    data = op_index_vault({"workspace": str(workspace)})
    assert data["notes"] == 0 and data["chunks"] == 0
    hits = op_query({"workspace": str(workspace), "q": "anything"})
    assert hits == {"hits": []}


@requires_model
def test_vault_bytes_unchanged_and_only_indexes_written(seeded_workspace: Path) -> None:
    before = snapshot_tree(seeded_workspace, exclude_top={"indexes"})
    op_index_vault({"workspace": str(seeded_workspace)})
    op_query({"workspace": str(seeded_workspace), "q": "espresso"})
    after = snapshot_tree(seeded_workspace, exclude_top={"indexes"})
    assert before == after
    new_top_level = {
        p.name for p in seeded_workspace.iterdir() if p.name not in {"vault", "indexes"}
    }
    assert new_top_level == set()


def test_query_before_index_is_structured_error(workspace: Path) -> None:
    with pytest.raises(OpError) as excinfo:
        op_query({"workspace": str(workspace), "q": "x"})
    assert excinfo.value.code == "index_missing"


def test_invalid_workspace_rejected() -> None:
    with pytest.raises(OpError) as excinfo:
        op_index_vault({"workspace": "relative/path"})
    assert excinfo.value.code == "invalid_args"
    with pytest.raises(OpError) as excinfo:
        op_index_vault({})
    assert excinfo.value.code == "invalid_args"


def test_invalid_query_args_rejected(seeded_workspace: Path) -> None:
    base = {"workspace": str(seeded_workspace)}
    for bad in [{**base, "q": ""}, {**base, "q": "x", "k": 0}, {**base, "q": "x", "k": True}]:
        with pytest.raises(OpError) as excinfo:
            op_query(bad)
        assert excinfo.value.code == "invalid_args"
    with pytest.raises(OpError) as excinfo:
        op_query({**base, "q": "x", "mode": "psychic"})
    assert excinfo.value.code == "unsupported_mode"
    with pytest.raises(OpError) as excinfo:
        op_query({**base, "q": "x", "vector_weight": 1.5})
    assert excinfo.value.code == "invalid_args"


@requires_model
def test_notes_without_frontmatter_id_fall_back_to_filename(workspace: Path) -> None:
    vault = workspace / "vault" / "10_Inbox"
    vault.mkdir(parents=True)
    path = vault / f"{ULID_A}--no-frontmatter.md"
    path.write_text("Plain body mentioning zanzibar.\n", encoding="utf-8")
    data = op_index_vault({"workspace": str(workspace)})
    assert data["notes"] == 1
    hits = op_query({"workspace": str(workspace), "q": "zanzibar"})["hits"]
    assert hits and hits[0]["source_ref"] == ULID_A
