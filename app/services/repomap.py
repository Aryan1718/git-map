import logging
from dataclasses import dataclass
from pathlib import Path

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
            tags.append(
                Tag(
                    rel_fname=t.rel_fname,
                    name=t.name,
                    kind=t.kind,
                    line=t.line,
                )
            )
        except AttributeError as exc:
            logger.debug("Skipping malformed tag %s: %s", t, exc)

    logger.info("Extracted %d tags", len(tags))
    return tags
