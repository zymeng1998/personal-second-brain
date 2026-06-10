"""Unit tests for the pure protocol layer (no subprocess)."""

import json

from retrieval_sidecar import __version__
from retrieval_sidecar.protocol import handle_line


def test_ping_round_trip() -> None:
    response = handle_line(json.dumps({"op": "ping", "req_id": "r1"}))
    assert response == {"req_id": "r1", "ok": True, "data": {"pong": True}}


def test_health_reports_version_and_python() -> None:
    response = handle_line(json.dumps({"op": "health", "req_id": "r2"}))
    assert response is not None and response["ok"] is True
    assert response["req_id"] == "r2"
    assert response["data"]["version"] == __version__
    major, minor, _patch = response["data"]["python"].split(".")
    assert (int(major), int(minor)) >= (3, 11)


def test_unknown_op_is_structured_error() -> None:
    response = handle_line(json.dumps({"op": "nope", "req_id": "r3"}))
    assert response is not None and response["ok"] is False
    assert response["req_id"] == "r3"
    assert response["error"]["code"] == "unknown_op"


def test_malformed_json_line_is_structured_error() -> None:
    response = handle_line("{this is not json")
    assert response is not None and response["ok"] is False
    assert response["req_id"] == ""
    assert response["error"]["code"] == "malformed_request"


def test_non_object_request_rejected() -> None:
    response = handle_line(json.dumps(["ping"]))
    assert response is not None and response["ok"] is False
    assert response["error"]["code"] == "malformed_request"


def test_missing_req_id_rejected_with_empty_correlation() -> None:
    response = handle_line(json.dumps({"op": "ping"}))
    assert response is not None and response["ok"] is False
    assert response["req_id"] == ""
    assert response["error"]["code"] == "malformed_request"


def test_blank_line_produces_no_response() -> None:
    assert handle_line("   \n") is None


def test_req_id_correlation_across_requests() -> None:
    ids = ["a", "b", "c"]
    responses = [handle_line(json.dumps({"op": "ping", "req_id": rid})) for rid in ids]
    assert [r["req_id"] for r in responses if r is not None] == ids
