"""SB-049 acceptance tests: vector + hybrid retrieval (model-dependent, offline-skippable)."""

from pathlib import Path

import pytest

from retrieval_sidecar.errors import OpError
from retrieval_sidecar.indexer import op_index_vault
from retrieval_sidecar.querying import op_query

from conftest import ULID_A, ULID_B, ULID_C, requires_model, write_note

pytestmark = requires_model


@pytest.fixture
def semantic_workspace(workspace: Path) -> Path:
    vault = workspace / "vault"
    # paraphrase target: no lexical overlap with the query "automobile servicing"
    write_note(vault, ULID_A, "Car upkeep", "Changing the engine oil and rotating tires regularly.")
    write_note(vault, ULID_B, "Garden plan", "Tomatoes and basil for the summer garden bed.")
    write_note(vault, ULID_C, "Espresso brewing", "Notes about espresso extraction and grind size.")
    op_index_vault({"workspace": str(workspace)})
    return workspace


def test_vector_finds_paraphrase_that_lexical_misses(semantic_workspace: Path) -> None:
    base = {"workspace": str(semantic_workspace), "q": "automobile servicing"}
    lexical = op_query({**base, "mode": "lexical"})
    assert all(h["source_ref"] != ULID_A for h in lexical["hits"]), "no lexical term overlap expected"
    vector = op_query({**base, "mode": "vector"})
    assert vector["hits"], "vector mode should return hits"
    assert vector["hits"][0]["source_ref"] == ULID_A


def test_hybrid_is_default_and_not_worse_than_lexical(semantic_workspace: Path) -> None:
    base = {"workspace": str(semantic_workspace)}
    # exact-term query: hybrid must keep the lexical winner on top
    hybrid = op_query({**base, "q": "espresso"})  # mode omitted -> hybrid default
    assert hybrid["hits"][0]["source_ref"] == ULID_C
    # paraphrase query: hybrid must surface what lexical alone cannot
    hybrid_para = op_query({**base, "q": "automobile servicing"})
    assert hybrid_para["hits"], "hybrid should return hits even with zero lexical matches"
    assert hybrid_para["hits"][0]["source_ref"] == ULID_A


def test_vector_weight_is_tunable(semantic_workspace: Path) -> None:
    base = {"workspace": str(semantic_workspace), "q": "espresso machine budget"}
    pure_lexicalish = op_query({**base, "vector_weight": 0.0})
    pure_vectorish = op_query({**base, "vector_weight": 1.0})
    assert pure_lexicalish["hits"] and pure_vectorish["hits"]
    # the weight extremes track each ranker's winner
    lexical = op_query({**base, "mode": "lexical"})
    vector = op_query({**base, "mode": "vector"})
    assert pure_lexicalish["hits"][0]["id"] == lexical["hits"][0]["id"]
    assert pure_vectorish["hits"][0]["id"] == vector["hits"][0]["id"]


def test_semantic_reindex_is_deterministic(semantic_workspace: Path) -> None:
    base = {"workspace": str(semantic_workspace), "q": "automobile servicing"}
    first = op_query(base)
    op_index_vault({"workspace": str(semantic_workspace)})
    second = op_query(base)
    assert first == second


def test_model_mismatch_is_structured_error(
    semantic_workspace: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SB_EMBED_MODEL", "some/other-model")
    with pytest.raises(OpError) as excinfo:
        op_query({"workspace": str(semantic_workspace), "q": "x", "mode": "vector"})
    assert excinfo.value.code == "index_model_mismatch"


def test_query_prefix_only_for_bge_v1_family():
    """Review LOW: the bge instruction prefix must not be forced onto a custom
    SB_EMBED_MODEL from another family (or bge-m3, which wants none)."""
    from retrieval_sidecar.embeddings import QUERY_PREFIX, query_prefix

    assert query_prefix("BAAI/bge-small-en-v1.5") == QUERY_PREFIX
    assert query_prefix("BAAI/bge-base-en-v1.5") == QUERY_PREFIX
    assert query_prefix("BAAI/bge-m3") == ""
    assert query_prefix("intfloat/e5-small-v2") == ""
    assert query_prefix("sentence-transformers/all-MiniLM-L6-v2") == ""
