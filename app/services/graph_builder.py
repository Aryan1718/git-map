import logging
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from app.services.repomap import Tag

logger = logging.getLogger(__name__)


@dataclass
class Node:
    id: str
    label: str
    type: str
    weight: float = 1.0
    file: str | None = None
    line: int | None = None

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

    name_to_def_ids: dict[str, list[str]] = defaultdict(list)
    defs_by_file: dict[str, list[Tag]] = defaultdict(list)
    file_call_counts: dict[tuple[str, str], int] = defaultdict(int)

    for tag in tags:
        if tag.kind != "def":
            continue

        symbol_id = f"{tag.rel_fname}::{tag.name}"
        if symbol_id not in nodes:
            nodes[symbol_id] = Node(
                id=symbol_id,
                label=tag.name,
                type="def",
                weight=0.0,
                file=tag.rel_fname,
                line=tag.line,
            )
            if tag.rel_fname in nodes:
                links.append(Link(source=tag.rel_fname, target=symbol_id, type="contains"))

        if symbol_id not in name_to_def_ids[tag.name]:
            name_to_def_ids[tag.name].append(symbol_id)
        defs_by_file[tag.rel_fname].append(tag)

    for rel_fname in defs_by_file:
        defs_by_file[rel_fname].sort(key=lambda item: (item.line, item.name))

    ref_counts: dict[str, int] = defaultdict(int)

    for tag in tags:
        if tag.kind != "ref":
            continue

        source_id = _resolve_ref_source_id(tag, defs_by_file, nodes)
        for target_id in name_to_def_ids.get(tag.name, []):
            ref_counts[target_id] += 1
            if source_id != target_id:
                links.append(Link(source=source_id, target=target_id, type="calls"))

            source_file = _node_file(source_id, nodes)
            target_file = _node_file(target_id, nodes)
            if source_file and target_file and source_file != target_file:
                file_call_counts[(source_file, target_file)] += 1

    max_refs = max(ref_counts.values(), default=1)
    for symbol_id, count in ref_counts.items():
        if symbol_id in nodes:
            nodes[symbol_id].weight = round(count / max_refs, 4)

    for node in nodes.values():
        if node.type == "def" and node.weight == 0.0:
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


def _resolve_ref_source_id(tag: Tag, defs_by_file: dict[str, list[Tag]], nodes: dict[str, Node]) -> str:
    defs = defs_by_file.get(tag.rel_fname, [])
    if not defs or tag.line < 0:
        return tag.rel_fname

    current_def: Tag | None = None
    next_def_line: int | None = None

    for index, def_tag in enumerate(defs):
        if def_tag.line > tag.line:
            next_def_line = def_tag.line
            break
        current_def = def_tag
        next_def_line = defs[index + 1].line if index + 1 < len(defs) else None

    if current_def is None:
        return tag.rel_fname

    if next_def_line is not None and tag.line >= next_def_line:
        return tag.rel_fname

    source_id = f"{current_def.rel_fname}::{current_def.name}"
    return source_id if source_id in nodes else tag.rel_fname


def _node_file(node_id: str, nodes: dict[str, Node]) -> str | None:
    node = nodes.get(node_id)
    if node is not None:
        return node.file or node.id if node.type == "file" else node.file
    if "::" in node_id:
        return node_id.split("::", 1)[0]
    return node_id
