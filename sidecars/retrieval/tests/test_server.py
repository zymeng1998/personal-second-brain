"""End-to-end subprocess tests: real stdin/stdout pipes, EOF shutdown, stdout purity."""

import json
import subprocess
import sys


def run_sidecar(lines: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "retrieval_sidecar"],
        input="".join(line + "\n" for line in lines),
        capture_output=True,
        text=True,
        timeout=30,
    )


def test_ping_health_round_trip_and_eof_exit() -> None:
    result = run_sidecar(
        [
            json.dumps({"op": "ping", "req_id": "p1"}),
            json.dumps({"op": "health", "req_id": "h1"}),
        ]
    )
    assert result.returncode == 0
    responses = [json.loads(line) for line in result.stdout.splitlines()]
    assert [r["req_id"] for r in responses] == ["p1", "h1"]
    assert responses[0]["data"] == {"pong": True}
    assert "version" in responses[1]["data"]


def test_stdout_purity_under_garbage_input() -> None:
    """Every stdout line must parse as a response envelope, even for junk input."""
    result = run_sidecar(
        [
            "not json at all {{{",
            json.dumps({"op": "ping", "req_id": "ok1"}),
            json.dumps({"op": "does_not_exist", "req_id": "u1"}),
            json.dumps(42),
            "",
            json.dumps({"op": "ping", "req_id": "ok2"}),
        ]
    )
    assert result.returncode == 0
    responses = [json.loads(line) for line in result.stdout.splitlines()]
    for response in responses:
        assert isinstance(response["req_id"], str)
        assert isinstance(response["ok"], bool)
        assert ("data" in response) is response["ok"]
        assert ("error" in response) is not response["ok"]
    # blank line yields no response; the other 5 lines each yield exactly one
    assert len(responses) == 5
    by_id = {r["req_id"]: r for r in responses if r["req_id"]}
    assert by_id["ok1"]["ok"] and by_id["ok2"]["ok"]
    assert by_id["u1"]["error"]["code"] == "unknown_op"


def test_logs_go_to_stderr_not_stdout() -> None:
    result = run_sidecar(["garbage line"])
    assert result.returncode == 0
    assert "[retrieval-sidecar]" in result.stderr
    assert "[retrieval-sidecar]" not in result.stdout
