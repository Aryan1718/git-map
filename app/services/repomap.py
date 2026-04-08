import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class _RepoMapIO:
    def read_text(self, fname: str) -> str:
        return Path(fname).read_text(encoding="utf-8", errors="replace")

    def tool_warning(self, message: str) -> None:
        logger.debug(message)

    def tool_output(self, message: str) -> None:
        logger.debug(message)

    def tool_error(self, message: str) -> None:
        logger.debug(message)


@dataclass
class Tag:
    rel_fname: str
    name: str
    kind: str
    line: int
    raw_kind: str | None = None
    is_definition: bool | None = None
    parent_name: str | None = None
    signature: str | None = None
    raw_metadata: dict[str, Any] = field(default_factory=dict)


class RepomapError(Exception):
    pass


def extract_tags(repo_dir: str, file_list: list[str]) -> list[Tag]:
    try:
        from aider.repomap import RepoMap  # type: ignore
    except ImportError as exc:
        raise RepomapError(
            "aider-chat is not installed. Run: pip install aider-chat"
        ) from exc

    abs_files = [str(Path(repo_dir) / f) for f in file_list]
    abs_files = [p for p in abs_files if Path(p).exists()]

    if not abs_files:
        raise RepomapError("No files available for AST extraction")

    logger.info("Running RepoMap on %d files in %s", len(abs_files), repo_dir)

    try:
        rm = RepoMap(root=repo_dir, io=_RepoMapIO())
        raw_tags = []
        for abs_fname in abs_files:
            rel_fname = str(Path(abs_fname).relative_to(repo_dir))
            raw_tags.extend(rm.get_tags(abs_fname, rel_fname))
    except Exception as exc:
        raise RepomapError(f"RepoMap extraction failed: {exc}") from exc

    tags: list[Tag] = []
    for t in raw_tags:
        try:
            metadata = _extract_raw_metadata(t)
            tags.append(
                Tag(
                    rel_fname=t.rel_fname,
                    name=t.name,
                    kind=t.kind,
                    line=t.line,
                    raw_kind=_first_present_str(
                        metadata,
                        "kind_name",
                        "symbol_kind",
                        "category",
                        "type",
                    )
                    or t.kind,
                    is_definition=_infer_is_definition(t.kind, metadata),
                    parent_name=_first_present_str(
                        metadata,
                        "parent_name",
                        "parent",
                        "scope",
                        "scope_name",
                        "container_name",
                        "container",
                        "class_name",
                        "namespace",
                        "package",
                        "module",
                    ),
                    signature=_first_present_str(metadata, "signature", "display", "text"),
                    raw_metadata=metadata,
                )
            )
        except AttributeError as exc:
            logger.debug("Skipping malformed tag %s: %s", t, exc)

    logger.info("Extracted %d tags", len(tags))
    return tags


_KNOWN_TAG_FIELDS = (
    "kind_name",
    "symbol_kind",
    "category",
    "type",
    "scope",
    "scope_name",
    "scope_kind",
    "parent",
    "parent_name",
    "container",
    "container_name",
    "class_name",
    "namespace",
    "package",
    "module",
    "signature",
    "display",
    "text",
    "access",
    "language",
)


def _extract_raw_metadata(raw_tag: Any) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    for field_name in _KNOWN_TAG_FIELDS:
        value = getattr(raw_tag, field_name, None)
        if value is not None and not callable(value):
            metadata[field_name] = value

    raw_dict = getattr(raw_tag, "__dict__", None)
    if isinstance(raw_dict, dict):
        for key, value in raw_dict.items():
            if key.startswith("_") or key in {"rel_fname", "name", "kind", "line"}:
                continue
            if value is None or callable(value):
                continue
            metadata.setdefault(key, value)

    return metadata


def _first_present_str(metadata: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _infer_is_definition(kind: str, metadata: dict[str, Any]) -> bool | None:
    for key in ("is_definition", "definition", "is_def"):
        value = metadata.get(key)
        if isinstance(value, bool):
            return value

    kind_lower = (kind or "").strip().lower()
    if kind_lower in {"def", "definition", "decl", "declaration"}:
        return True
    if kind_lower in {"ref", "reference", "usage", "call", "callsite"}:
        return False
    return None
