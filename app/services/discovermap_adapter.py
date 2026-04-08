from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import re


def build_discovermap_payload(graph_payload: dict) -> dict:
    nodes = graph_payload.get("nodes", [])
    links = graph_payload.get("links", [])
    meta = graph_payload.get("meta", {})

    nodes_by_id = {node["id"]: node for node in nodes}
    file_nodes = {
        node_id: node
        for node_id, node in nodes_by_id.items()
        if node.get("type") == "file"
    }

    parent_by_child: dict[str, str] = {}
    fn_children_by_file: dict[str, list[str]] = defaultdict(list)
    imports_by_file: dict[str, set[str]] = defaultdict(set)
    calls_by_fn: dict[str, list[str]] = defaultdict(list)
    called_by_fn: dict[str, list[str]] = defaultdict(list)

    for link in links:
        source = link["source"]
        target = link["target"]
        link_type = link["type"]

        if link_type == "contains" and source in file_nodes and target in nodes_by_id:
            parent_by_child[target] = source
            fn_children_by_file[source].append(target)
            continue

        if (
            link_type == "calls"
            and source in file_nodes
            and target in file_nodes
            and source != target
        ):
            imports_by_file[source].add(target)
            continue

        if (
            link_type == "calls"
            and source in nodes_by_id
            and target in nodes_by_id
            and source not in file_nodes
            and target not in file_nodes
        ):
            calls_by_fn[source].append(target)
            called_by_fn[target].append(source)

    chunk_files: dict[str, dict] = {}
    file_map: dict[str, str] = {}
    fn_map: dict[str, str] = {}

    for file_id in sorted(file_nodes):
        chunk_id = _chunk_id_for_path(file_id)
        file_map[file_id] = chunk_id
        chunk = chunk_files.setdefault(
            chunk_id,
            {"chunk_id": chunk_id, "type": "backend", "files": {}},
        )
        file_node = file_nodes[file_id]
        language = _language_for_path(file_id)

        functions: dict[str, dict] = {}
        for child_id in sorted(fn_children_by_file.get(file_id, [])):
            child = nodes_by_id.get(child_id)
            if not child:
                continue

            name = child.get("label") or child_id.rsplit("::", 1)[-1]
            fn_ref = _fn_ref(chunk_id, file_id, name)
            fn_map[f"{Path(file_id).name}::{name}"] = fn_ref
            fn_map[name] = fn_ref

            functions[name] = {
                "signature": f"{name}()",
                "docstring": None,
                "lines": [child.get("line"), child.get("line")],
                "calls": [
                    {
                        "name": nodes_by_id[target_id].get("label") or target_id.rsplit("::", 1)[-1],
                        "ref": _fn_ref(
                            file_map.get(parent_by_child.get(target_id, ""), _chunk_id_for_path(parent_by_child.get(target_id, ""))),
                            parent_by_child.get(target_id, ""),
                            nodes_by_id[target_id].get("label") or target_id.rsplit("::", 1)[-1],
                        ),
                    }
                    for target_id in calls_by_fn.get(child_id, [])
                    if target_id in nodes_by_id and parent_by_child.get(target_id)
                ],
                "called_by": [
                    {
                        "name": nodes_by_id[source_id].get("label") or source_id.rsplit("::", 1)[-1],
                        "ref": _fn_ref(
                            file_map.get(parent_by_child.get(source_id, ""), _chunk_id_for_path(parent_by_child.get(source_id, ""))),
                            parent_by_child.get(source_id, ""),
                            nodes_by_id[source_id].get("label") or source_id.rsplit("::", 1)[-1],
                        ),
                    }
                    for source_id in called_by_fn.get(child_id, [])
                    if source_id in nodes_by_id and parent_by_child.get(source_id)
                ],
            }

        chunk["files"][file_id] = {
            "description": None,
            "functions": functions,
            "components": {},
            "imports": sorted(imports_by_file.get(file_id, set())),
            "language": language,
            "path": file_id,
            "raw_imports": [],
        }

    route_chunk = {"chunk_id": "chunk_routes", "type": "routes", "routes": {}}
    ordered_chunks = sorted(chunk_files)
    if "chunk_routes" not in ordered_chunks:
        ordered_chunks.append("chunk_routes")

    return {
        "index": {
            "analyzed_at": meta.get("commit_sha"),
            "chunks": ordered_chunks,
            "file_map": file_map,
            "fn_map": fn_map,
            "route_map": {},
            "keyword_map": {},
            "total_files": len(file_nodes),
            "total_functions": sum(len(chunk["files"][path]["functions"]) for chunk in chunk_files.values() for path in chunk["files"]),
            "total_components": 0,
            "total_routes": 0,
        },
        "chunks": {**chunk_files, "chunk_routes": route_chunk},
    }


def _language_for_path(path: str) -> str:
    suffix = Path(path).suffix.lower()
    if suffix == ".py":
        return "python"
    if suffix in {".ts", ".tsx"}:
        return "typescript"
    if suffix in {".js", ".jsx", ".mjs", ".cjs"}:
        return "javascript"
    return "unknown"


def _chunk_id_for_path(path: str) -> str:
    parts = Path(path).parts
    if len(parts) <= 1:
        return "chunk_root"
    return f"chunk_{_sanitize_chunk_part(parts[0])}"


def _sanitize_chunk_part(value: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return sanitized or "root"


def _fn_ref(chunk_id: str, file_path: str, name: str) -> str:
    return f"{chunk_id}::{file_path}::{name}"
