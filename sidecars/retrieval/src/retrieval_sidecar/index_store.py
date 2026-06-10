"""The single disposable index artifact: `<workspace>/indexes/retrieval.duckdb`
(OQ #19). Writes go ONLY here; the vault, events, and db/ are never touched."""

from __future__ import annotations

from pathlib import Path

from .errors import OpError

INDEX_RELATIVE_PATH = Path("indexes") / "retrieval.duckdb"


def resolve_workspace(args: dict) -> Path:
    workspace = args.get("workspace")
    if not isinstance(workspace, str) or workspace == "":
        raise OpError("invalid_args", "args.workspace (absolute path) is required")
    path = Path(workspace)
    if not path.is_absolute():
        raise OpError("invalid_args", f"workspace must be an absolute path: {workspace}")
    if not path.is_dir():
        raise OpError("invalid_args", f"workspace does not exist: {workspace}")
    return path


def index_path(workspace: Path) -> Path:
    return workspace / INDEX_RELATIVE_PATH
