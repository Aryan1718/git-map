import logging
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.services.repomap import Tag
from app.services.semantic_normalizer import NormalizedSymbol, normalize_definitions

logger = logging.getLogger(__name__)


@dataclass
class Node:
    id: str
    label: str
    type: str
    weight: float = 1.0
    file: str | None = None
    line: int | None = None
    normalized_kind: str | None = None
    raw_kind: str | None = None
    qualified_name: str | None = None
    parent_qualified_name: str | None = None
    is_definition: bool | None = None
    raw_metadata: dict[str, Any] = field(default_factory=dict)

    def dict(self) -> dict:
        data = {
            "id": self.id,
            "label": self.label,
            "type": self.type,
            "weight": round(self.weight, 4),
        }
        if self.file is not None:
            data["file"] = self.file
        if self.line is not None:
            data["line"] = self.line
        if self.normalized_kind is not None:
            data["normalized_kind"] = self.normalized_kind
        if self.raw_kind is not None:
            data["raw_kind"] = self.raw_kind
        if self.qualified_name is not None:
            data["qualified_name"] = self.qualified_name
        if self.parent_qualified_name is not None:
            data["parent_qualified_name"] = self.parent_qualified_name
        if self.is_definition is not None:
            data["is_definition"] = self.is_definition
        if self.raw_metadata:
            data["raw_metadata"] = self.raw_metadata
        return data


@dataclass
class Link:
    source: str
    target: str
    type: str

    def dict(self) -> dict:
        return {"source": self.source, "target": self.target, "type": self.type}


@dataclass
class GraphResult:
    nodes: list[Node] = field(default_factory=list)
    links: list[Link] = field(default_factory=list)

    def dict(self) -> dict:
        return {
            "nodes": [node.dict() for node in self.nodes],
            "links": [link.dict() for link in self.links],
        }


def build(tags: list[Tag], file_list: list[str]) -> GraphResult:
    nodes: dict[str, Node] = {}
    links: list[Link] = []

    for path in file_list:
        if path not in nodes:
            nodes[path] = Node(
                id=path,
                label=Path(path).name,
                type="file",
                weight=1.0,
            )

    normalized_symbols = normalize_definitions(tags)
    symbols_by_id: dict[str, NormalizedSymbol] = {symbol.id: symbol for symbol in normalized_symbols}
    callable_symbols_by_file: dict[str, list[NormalizedSymbol]] = defaultdict(list)
    callable_lookup_exact: dict[str, list[str]] = defaultdict(list)
    callable_lookup_short: dict[str, list[str]] = defaultdict(list)
    file_call_counts: dict[tuple[str, str], int] = defaultdict(int)

    for symbol in normalized_symbols:
        if symbol.id not in nodes:
            nodes[symbol.id] = Node(
                id=symbol.id,
                label=symbol.display_name,
                type=symbol.normalized_kind,
                weight=0.0,
                file=symbol.file,
                line=symbol.line,
                normalized_kind=symbol.normalized_kind,
                raw_kind=symbol.raw_kind,
                qualified_name=symbol.qualified_name,
                parent_qualified_name=symbol.parent_qualified_name,
                is_definition=symbol.is_definition,
                raw_metadata=symbol.raw_metadata,
            )

        parent_id = (
            f"{symbol.file}::{symbol.parent_qualified_name}"
            if symbol.parent_qualified_name and f"{symbol.file}::{symbol.parent_qualified_name}" in symbols_by_id
            else symbol.file
        )
        if parent_id in nodes:
            links.append(Link(source=parent_id, target=symbol.id, type="contains"))

        if symbol.normalized_kind == "callable":
            callable_symbols_by_file[symbol.file].append(symbol)
            callable_lookup_exact[symbol.qualified_name].append(symbol.id)
            callable_lookup_short[symbol.display_name].append(symbol.id)

    for rel_fname in callable_symbols_by_file:
        callable_symbols_by_file[rel_fname].sort(key=lambda item: (item.line, item.qualified_name))

    ref_counts: dict[str, int] = defaultdict(int)

    for tag in tags:
        if _is_definition_tag(tag):
            continue

        source_id = _resolve_ref_source_id(tag, callable_symbols_by_file, symbols_by_id)
        target_ids = _resolve_ref_target_ids(tag.name, callable_lookup_exact, callable_lookup_short)

        if not target_ids:
            continue

        for target_id in target_ids:
            ref_counts[target_id] += 1
            if source_id is not None and source_id != target_id:
                links.append(Link(source=source_id, target=target_id, type="calls"))

            source_file = _node_file(source_id, nodes) if source_id is not None else tag.rel_fname
            target_file = _node_file(target_id, nodes)
            if source_file and target_file and source_file != target_file:
                file_call_counts[(source_file, target_file)] += 1

    max_refs = max(ref_counts.values(), default=1)
    for symbol_id, count in ref_counts.items():
        if symbol_id in nodes:
            nodes[symbol_id].weight = round(count / max_refs, 4)

    for node in nodes.values():
        if node.type in {"callable", "type", "module"} and node.weight == 0.0:
            node.weight = 0.05

    unique_links: list[Link] = []
    seen_links: set[tuple[str, str, str]] = set()
    for link in links:
        key = (link.source, link.target, link.type)
        if key in seen_links:
            continue
        seen_links.add(key)
        unique_links.append(link)

    for source_file, target_file in sorted(file_call_counts):
        key = (source_file, target_file, "calls")
        if key in seen_links:
            continue
        seen_links.add(key)
        unique_links.append(Link(source=source_file, target=target_file, type="calls"))

    result = GraphResult(nodes=list(nodes.values()), links=unique_links)
    logger.info("Graph built: %d nodes, %d links", len(result.nodes), len(result.links))
    return result


def _resolve_ref_source_id(
    tag: Tag,
    callable_symbols_by_file: dict[str, list[NormalizedSymbol]],
    symbols_by_id: dict[str, NormalizedSymbol],
) -> str | None:
    defs = callable_symbols_by_file.get(tag.rel_fname, [])
    if not defs or tag.line < 0:
        return None

    current_def: NormalizedSymbol | None = None
    next_def_line: int | None = None

    for index, def_symbol in enumerate(defs):
        if def_symbol.line > tag.line:
            next_def_line = def_symbol.line
            break
        current_def = def_symbol
        next_def_line = defs[index + 1].line if index + 1 < len(defs) else None

    if current_def is None:
        return None

    if next_def_line is not None and tag.line >= next_def_line:
        return None

    return current_def.id if current_def.id in symbols_by_id else None


def _resolve_ref_target_ids(
    name: str,
    callable_lookup_exact: dict[str, list[str]],
    callable_lookup_short: dict[str, list[str]],
) -> list[str]:
    exact_matches = callable_lookup_exact.get(name, [])
    if exact_matches:
        return exact_matches

    short_name = name.rsplit("::", 1)[-1].rsplit("#", 1)[-1].rsplit(".", 1)[-1]
    short_matches = callable_lookup_short.get(short_name, [])
    return short_matches if len(short_matches) == 1 else []


def _is_definition_tag(tag: Tag) -> bool:
    if tag.is_definition is not None:
        return tag.is_definition
    return (tag.kind or "").strip().lower() in {"def", "definition", "decl", "declaration"}


def _node_file(node_id: str, nodes: dict[str, Node]) -> str | None:
    node = nodes.get(node_id)
    if node is not None:
        return node.file or node.id if node.type == "file" else node.file
    if "::" in node_id:
        return node_id.split("::", 1)[0]
    return node_id
