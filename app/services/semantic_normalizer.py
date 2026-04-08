from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.services.repomap import Tag

VISIBLE_KINDS = {"module", "type", "callable"}
_MODULE_TOKENS = {"module", "namespace", "package"}
_TYPE_TOKENS = {
    "class",
    "interface",
    "struct",
    "enum",
    "trait",
    "object",
    "record",
    "protocol",
    "union",
    "datatype",
    "typedef",
    "typealias",
    "type",
}
_CALLABLE_TOKENS = {
    "function",
    "method",
    "constructor",
    "procedure",
    "routine",
    "subroutine",
    "callable",
    "func",
    "lambda",
}
_NON_VISIBLE_TOKENS = {
    "ref",
    "reference",
    "usage",
    "use",
    "callsite",
    "call",
    "import",
    "alias",
    "variable",
    "local",
    "parameter",
    "argument",
    "property",
    "field",
    "constant",
    "const",
    "member",
    "label",
    "macro",
}
_GENERIC_DEFINITION_TOKENS = {"def", "definition", "decl", "declaration", "symbol"}
_QUALIFIER_PATTERN = re.compile(r"::|#|\.")
_TOKEN_SPLIT_PATTERN = re.compile(r"[^a-z0-9]+")
_CAMEL_BOUNDARY_PATTERN = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")


@dataclass
class NormalizedSymbol:
    id: str
    file: str
    qualified_name: str
    display_name: str
    line: int
    normalized_kind: str
    raw_kind: str
    is_definition: bool
    parent_qualified_name: str | None = None
    signature: str | None = None
    raw_metadata: dict[str, Any] = field(default_factory=dict)
    explicit_kind: bool = False
    explicit_callable: bool = False


def normalize_symbol_kind(raw_kind: str | None, metadata: dict[str, Any], is_definition: bool | None) -> str | None:
    if is_definition is False:
        return None

    tokens = semantic_tokens(raw_kind, metadata)
    if not tokens:
        return "callable" if is_definition else None

    if tokens & _NON_VISIBLE_TOKENS:
        return None
    if tokens & _MODULE_TOKENS:
        return "module"
    if tokens & _CALLABLE_TOKENS:
        return "callable"
    if tokens & _TYPE_TOKENS:
        return "type"
    if tokens & _GENERIC_DEFINITION_TOKENS:
        return "callable"
    return "callable" if is_definition else None


def normalize_definitions(tags: list[Tag]) -> list[NormalizedSymbol]:
    symbols: list[NormalizedSymbol] = []

    for tag in tags:
        normalized_kind = normalize_symbol_kind(tag.raw_kind or tag.kind, tag.raw_metadata, tag.is_definition)
        if normalized_kind not in VISIBLE_KINDS:
            continue

        qualified_name = tag.name.strip()
        if not qualified_name:
            continue

        symbols.append(
            NormalizedSymbol(
                id=f"{tag.rel_fname}::{qualified_name}",
                file=tag.rel_fname,
                qualified_name=qualified_name,
                display_name=display_name_for_name(qualified_name),
                line=tag.line,
                normalized_kind=normalized_kind,
                raw_kind=tag.raw_kind or tag.kind,
                is_definition=tag.is_definition is not False,
                parent_qualified_name=normalized_parent_name(tag),
                signature=tag.signature,
                raw_metadata={
                    "raw_kind": tag.raw_kind or tag.kind,
                    "kind": tag.kind,
                    "name": tag.name,
                    "line": tag.line,
                    "parent_name": tag.parent_name,
                    "signature": tag.signature,
                    **tag.raw_metadata,
                },
                explicit_kind=has_explicit_kind_signal(tag.raw_kind or tag.kind, tag.raw_metadata),
                explicit_callable=has_callable_signal(tag.raw_kind or tag.kind, tag.raw_metadata),
            )
        )

    by_file: dict[str, dict[str, NormalizedSymbol]] = {}
    for symbol in symbols:
        by_file.setdefault(symbol.file, {})[symbol.qualified_name] = symbol

    for file_symbols in by_file.values():
        for symbol in file_symbols.values():
            if symbol.parent_qualified_name:
                continue
            symbol.parent_qualified_name = infer_parent_name(symbol.qualified_name, file_symbols)

        container_names = {
            symbol.parent_qualified_name
            for symbol in file_symbols.values()
            if symbol.parent_qualified_name
        }
        for symbol in file_symbols.values():
            if (
                symbol.qualified_name in container_names
                and symbol.normalized_kind == "callable"
                and not symbol.explicit_callable
            ):
                symbol.normalized_kind = "type"

    return sorted(symbols, key=lambda item: (item.file, item.line, item.qualified_name))


def semantic_tokens(raw_kind: str | None, metadata: dict[str, Any]) -> set[str]:
    text_parts: list[str] = []
    if raw_kind:
        text_parts.append(raw_kind)

    for key in (
        "kind_name",
        "symbol_kind",
        "category",
        "type",
        "scope_kind",
        "scope",
        "parent",
        "parent_name",
        "container",
        "container_name",
        "class_name",
        "namespace",
        "package",
        "module",
    ):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            text_parts.append(value)

    tokens: set[str] = set()
    for part in text_parts:
        split_part = _CAMEL_BOUNDARY_PATTERN.sub(" ", part).lower()
        for token in _TOKEN_SPLIT_PATTERN.split(split_part):
            if token:
                tokens.add(token)
    return tokens


def has_explicit_kind_signal(raw_kind: str | None, metadata: dict[str, Any]) -> bool:
    tokens = semantic_tokens(raw_kind, metadata)
    return bool(tokens & (_MODULE_TOKENS | _TYPE_TOKENS | _CALLABLE_TOKENS | _NON_VISIBLE_TOKENS))


def has_callable_signal(raw_kind: str | None, metadata: dict[str, Any]) -> bool:
    return bool(semantic_tokens(raw_kind, metadata) & _CALLABLE_TOKENS)


def normalized_parent_name(tag: Tag) -> str | None:
    if tag.parent_name and tag.parent_name != tag.name:
        return strip_callable_suffix(tag.parent_name)
    return None


def infer_parent_name(qualified_name: str, file_symbols: dict[str, NormalizedSymbol]) -> str | None:
    for candidate in parent_name_candidates(qualified_name):
        if candidate in file_symbols:
            return candidate
    return None


def parent_name_candidates(qualified_name: str) -> list[str]:
    parts = _QUALIFIER_PATTERN.split(qualified_name)
    separators = _QUALIFIER_PATTERN.findall(qualified_name)
    if len(parts) <= 1:
        return []

    candidates: list[str] = []
    for end_index in range(len(parts) - 1, 0, -1):
        candidate = parts[0]
        for part_index in range(1, end_index):
            candidate = f"{candidate}{separators[part_index - 1]}{parts[part_index]}"
        candidates.append(strip_callable_suffix(candidate))
    return candidates


def strip_callable_suffix(value: str) -> str:
    return value[:-2] if value.endswith("()") else value


def display_name_for_name(qualified_name: str) -> str:
    parts = _QUALIFIER_PATTERN.split(qualified_name)
    return parts[-1] if parts else qualified_name
