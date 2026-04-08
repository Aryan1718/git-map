from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import re

from app.services.file_language import detect_file_language, language_color

OVERVIEW_ALL_FILES_THRESHOLD = 199
LARGE_REPO_FILE_THRESHOLD = 200
MAX_OVERVIEW_FILES = 44
MAX_OVERVIEW_IMPORTS = 96
MAX_FILE_CHILDREN = 36
MAX_FILE_IMPORTS = 14


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
    children_by_file: dict[str, list[str]] = defaultdict(list)
    imports_by_file: dict[str, set[str]] = defaultdict(set)
    import_weights: dict[tuple[str, str], int] = defaultdict(int)
    calls_by_callable: dict[str, list[str]] = defaultdict(list)
    called_by_callable: dict[str, list[str]] = defaultdict(list)

    for link in links:
        source = link["source"]
        target = link["target"]
        link_type = link["type"]

        if link_type == "contains" and source in file_nodes and target in nodes_by_id:
            parent_by_child[target] = source
            children_by_file[source].append(target)
            continue

        if (
            link_type == "calls"
            and source in file_nodes
            and target in file_nodes
            and source != target
        ):
            imports_by_file[source].add(target)
            import_weights[(source, target)] += 1
            continue

        if (
            link_type == "calls"
            and source in nodes_by_id
            and target in nodes_by_id
            and source not in file_nodes
            and target not in file_nodes
        ):
            calls_by_callable[source].append(target)
            called_by_callable[target].append(source)

    chunk_files: dict[str, dict] = {}
    file_map: dict[str, str] = {}
    fn_map: dict[str, str] = {}
    file_summaries: dict[str, dict] = {}
    file_signal_scores: dict[str, float] = defaultdict(float)

    for file_id in sorted(file_nodes):
        chunk_id = _chunk_id_for_path(file_id)
        file_map[file_id] = chunk_id
        chunk = chunk_files.setdefault(
            chunk_id,
            {"chunk_id": chunk_id, "type": "backend", "files": {}},
        )
        file_node = file_nodes[file_id]
        language = detect_file_language(file_id)
        file_theme = language_color(language)

        functions: dict[str, dict] = {}
        components: dict[str, dict] = {}
        for child_id in sorted(children_by_file.get(file_id, [])):
            child = nodes_by_id.get(child_id)
            if not child:
                continue

            name = child.get("label") or child_id.rsplit("::", 1)[-1]
            normalized_kind = child.get("normalized_kind") or child.get("type")

            if normalized_kind == "callable":
                fn_ref = _fn_ref(chunk_id, file_id, name)
                qualified_name = child.get("qualified_name") or name
                fn_map[qualified_name] = fn_ref
                fn_map[f"{Path(file_id).name}::{qualified_name}"] = fn_ref
                fn_map[name] = fn_ref

                functions[name] = {
                    "signature": child.get("raw_metadata", {}).get("signature") or f"{qualified_name}()",
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
                        for target_id in calls_by_callable.get(child_id, [])
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
                        for source_id in called_by_callable.get(child_id, [])
                        if source_id in nodes_by_id and parent_by_child.get(source_id)
                    ],
                    "kind": normalized_kind,
                    "qualified_name": qualified_name,
                    "parent_qualified_name": child.get("parent_qualified_name"),
                    "raw_kind": child.get("raw_kind"),
                    "raw_metadata": child.get("raw_metadata", {}),
                }
            else:
                components[name] = {
                    "kind": normalized_kind,
                    "qualified_name": child.get("qualified_name") or name,
                    "parent_qualified_name": child.get("parent_qualified_name"),
                    "lines": [child.get("line"), child.get("line")],
                    "description": child.get("raw_kind") or normalized_kind,
                    "uses": [],
                    "api_calls": [],
                    "raw_kind": child.get("raw_kind"),
                    "raw_metadata": child.get("raw_metadata", {}),
                }

        function_count = len(functions)
        component_count = len(components)
        import_count = len(imports_by_file.get(file_id, set()))

        chunk["files"][file_id] = {
            "description": file_node.get("description"),
            "functions": functions,
            "components": components,
            "imports": sorted(imports_by_file.get(file_id, set())),
            "language": language,
            "language_theme": file_theme,
            "path": file_id,
            "raw_imports": [],
        }

        file_signal_scores[file_id] += function_count * 2.2 + component_count * 1.6 + import_count * 1.4
        file_summaries[file_id] = {
            "path": file_id,
            "label": Path(file_id).name,
            "chunk_id": chunk_id,
            "language": language,
            "language_theme": file_theme,
            "function_count": function_count,
            "component_count": component_count,
            "import_count": import_count,
        }

    route_chunk = {"chunk_id": "chunk_routes", "type": "routes", "routes": {}}
    ordered_chunks = sorted(chunk_files)
    if "chunk_routes" not in ordered_chunks:
        ordered_chunks.append("chunk_routes")

    reverse_imports: dict[str, int] = defaultdict(int)
    for source, targets in imports_by_file.items():
        file_signal_scores[source] += len(targets) * 2.6
        for target in targets:
            reverse_imports[target] += 1
    for file_id, summary in file_summaries.items():
        file_signal_scores[file_id] += reverse_imports[file_id] * 2.1
        summary["importance"] = round(file_signal_scores[file_id], 4)

    overview_paths = _select_overview_files(file_summaries)
    overview_imports = _select_overview_imports(overview_paths, import_weights)
    large_repo = len(file_summaries) > LARGE_REPO_FILE_THRESHOLD
    overview_mode = "capped" if len(overview_paths) < len(file_summaries) else "full"

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
            "total_components": sum(len(chunk["files"][path]["components"]) for chunk in chunk_files.values() for path in chunk["files"]),
            "total_routes": 0,
            "files": file_summaries,
            "overview": {
                "mode": overview_mode,
                "large_repo": large_repo,
                "file_paths": overview_paths,
                "imports": overview_imports,
                "caps": {
                    "max_overview_files": MAX_OVERVIEW_FILES,
                    "max_overview_imports": MAX_OVERVIEW_IMPORTS,
                    "max_file_children": MAX_FILE_CHILDREN,
                    "max_file_imports": MAX_FILE_IMPORTS,
                },
            },
        },
        "chunks": {**chunk_files, "chunk_routes": route_chunk},
    }


def build_discovermap_file_payload(
    payload: dict,
    path: str,
    include_callables: list[str] | None = None,
) -> dict | None:
    index = payload.get("index", {})
    file_map = index.get("file_map", {})
    chunk_id = file_map.get(path)
    if not chunk_id:
        return None

    chunk = payload.get("chunks", {}).get(chunk_id, {})
    file_entry = chunk.get("files", {}).get(path)
    if file_entry is None:
        return None

    include_callables = include_callables or []
    summary = index.get("files", {}).get(path, {})
    detail = {
        **summary,
        **file_entry,
        "chunk_id": chunk_id,
    }
    detail["functions"] = _slice_named_items(
        file_entry.get("functions", {}),
        include_names=include_callables,
        limit=MAX_FILE_CHILDREN,
    )
    component_limit = max(MAX_FILE_CHILDREN - len(detail["functions"]), 0)
    detail["components"] = _slice_named_items(
        file_entry.get("components", {}),
        limit=component_limit,
    )
    detail["imports"] = sorted(file_entry.get("imports", []))[:MAX_FILE_IMPORTS]
    detail["hidden_function_count"] = max(len(file_entry.get("functions", {})) - len(detail["functions"]), 0)
    detail["hidden_component_count"] = max(len(file_entry.get("components", {})) - len(detail["components"]), 0)
    detail["hidden_import_count"] = max(len(file_entry.get("imports", [])) - len(detail["imports"]), 0)
    return detail


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


def _select_overview_files(file_summaries: dict[str, dict]) -> list[str]:
    ordered = sorted(
        file_summaries.items(),
        key=lambda item: (-float(item[1].get("importance", 0.0)), item[0]),
    )
    if len(ordered) <= OVERVIEW_ALL_FILES_THRESHOLD:
        return [path for path, _summary in ordered]
    return [path for path, _summary in ordered[:MAX_OVERVIEW_FILES]]


def _select_overview_imports(
    overview_paths: list[str],
    import_weights: dict[tuple[str, str], int],
) -> list[dict]:
    allowed = set(overview_paths)
    ranked = [
        {"source": source, "target": target, "weight": weight}
        for (source, target), weight in import_weights.items()
        if source in allowed and target in allowed
    ]
    ranked.sort(key=lambda item: (-item["weight"], item["source"], item["target"]))
    return ranked[:MAX_OVERVIEW_IMPORTS]


def _slice_named_items(
    items: dict[str, dict],
    *,
    include_names: list[str] | None = None,
    limit: int,
) -> dict[str, dict]:
    if limit <= 0 or not items:
        return {}

    include_names = include_names or []
    ranked = sorted(
        items.items(),
        key=lambda item: (
            -_item_rank_score(item[1]),
            _item_line(item[1]),
            item[0],
        ),
    )

    selected: dict[str, dict] = {}
    for name in include_names:
        value = items.get(name)
        if value is not None and name not in selected:
            selected[name] = value

    for name, value in ranked:
        if len(selected) >= limit:
            break
        if name in selected:
            continue
        selected[name] = value

    return {
        name: selected[name]
        for name in sorted(selected, key=lambda key: (_item_line(selected[key]), key))
    }


def _item_rank_score(item: dict) -> float:
    raw_metadata = item.get("raw_metadata", {})
    line = _item_line(item)
    line_score = 0.0 if line >= 10**9 else max(0.0, 10000.0 - line) / 10000.0
    call_score = len(item.get("calls", [])) * 2.1 + len(item.get("called_by", [])) * 1.7 + len(item.get("uses", [])) * 1.2
    signature_bonus = 0.5 if raw_metadata.get("signature") else 0.0
    return call_score + signature_bonus + line_score


def _item_line(item: dict) -> int:
    lines = item.get("lines") or []
    if lines and isinstance(lines[0], int):
        return lines[0]
    return 10**9
