from __future__ import annotations

import colorsys
import hashlib
from pathlib import Path


def detect_file_language(path: str) -> str:
    file_path = Path(path)
    name = file_path.name
    lower_name = name.lower()

    if lower_name in _SPECIAL_FILENAMES:
        return _SPECIAL_FILENAMES[lower_name]

    suffix = file_path.suffix.lower()
    if suffix in _LANGUAGE_BY_EXTENSION:
        return _LANGUAGE_BY_EXTENSION[suffix]

    if suffix:
        return suffix[1:].upper()

    return "UNKNOWN"


def language_color(language: str) -> dict[str, str]:
    normalized = normalize_language_label(language)
    if normalized in _CURATED_FILE_THEME:
        return _CURATED_FILE_THEME[normalized]

    if normalized == "UNKNOWN":
        return _UNKNOWN_FILE_THEME

    return _hashed_file_theme(normalized)


def normalize_language_label(language: str) -> str:
    return (language or "").strip().upper() or "UNKNOWN"


def _hashed_file_theme(language: str) -> dict[str, str]:
    digest = hashlib.sha256(language.encode("utf-8")).hexdigest()
    hue = int(digest[:8], 16) % 360
    saturation = 0.66 + (int(digest[8:10], 16) / 255) * 0.12
    stroke_lightness = 0.66 + (int(digest[10:12], 16) / 255) * 0.08
    fill_lightness = 0.17 + (int(digest[12:14], 16) / 255) * 0.08
    badge_lightness = min(0.82, stroke_lightness + 0.1)
    text_lightness = 0.9 + (int(digest[14:16], 16) / 255) * 0.04

    return {
        "fill": _hsl_to_hex(hue, saturation * 0.58, fill_lightness),
        "stroke": _hsl_to_hex(hue, saturation, stroke_lightness),
        "text": _hsl_to_hex(hue, max(0.32, saturation * 0.42), text_lightness),
        "badge": _hsl_to_hex(hue, min(0.88, saturation * 0.9), badge_lightness),
    }


def _hsl_to_hex(hue: float, saturation: float, lightness: float) -> str:
    red, green, blue = colorsys.hls_to_rgb((hue % 360) / 360, lightness, saturation)
    return f"#{round(red * 255):02x}{round(green * 255):02x}{round(blue * 255):02x}"


_CURATED_FILE_THEME = {
    "PY": {"fill": "#1f2246", "stroke": "#8a84f7", "text": "#d9d6ff", "badge": "#c4b5fd"},
    "JS": {"fill": "#3b2d11", "stroke": "#fbbf24", "text": "#fde7a5", "badge": "#fde047"},
    "JSX": {"fill": "#3b2d11", "stroke": "#fbbf24", "text": "#fde7a5", "badge": "#fde047"},
    "TS": {"fill": "#132f48", "stroke": "#38bdf8", "text": "#c8ecff", "badge": "#7dd3fc"},
    "TSX": {"fill": "#132f48", "stroke": "#38bdf8", "text": "#c8ecff", "badge": "#7dd3fc"},
}

_UNKNOWN_FILE_THEME = {"fill": "#2a2f3b", "stroke": "#94a3b8", "text": "#dbe2ee", "badge": "#cbd5e1"}

_SPECIAL_FILENAMES = {
    "dockerfile": "DOCKER",
    "makefile": "MAKE",
    "cmakelists.txt": "CMAKE",
    "jenkinsfile": "JENKINS",
    "procfile": "PROCFILE",
    "gemfile": "RUBY",
    "rakefile": "RUBY",
}

_LANGUAGE_BY_EXTENSION = {
    ".py": "PY",
    ".pyi": "PY",
    ".js": "JS",
    ".mjs": "JS",
    ".cjs": "JS",
    ".jsx": "JSX",
    ".ts": "TS",
    ".tsx": "TSX",
    ".java": "JAVA",
    ".kt": "KOTLIN",
    ".kts": "KOTLIN",
    ".swift": "SWIFT",
    ".go": "GO",
    ".rs": "RUST",
    ".rb": "RUBY",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "CPP",
    ".cc": "CPP",
    ".cxx": "CPP",
    ".c": "C",
    ".h": "C/C++",
    ".hpp": "C/C++",
    ".hh": "C/C++",
    ".m": "OBJ-C",
    ".mm": "OBJ-C++",
    ".scala": "SCALA",
    ".sc": "SCALA",
    ".dart": "DART",
    ".lua": "LUA",
    ".pl": "PERL",
    ".pm": "PERL",
    ".r": "R",
    ".jl": "JULIA",
    ".el": "LISP",
    ".clj": "CLJ",
    ".cljs": "CLJS",
    ".groovy": "GROOVY",
    ".gvy": "GROOVY",
    ".sql": "SQL",
    ".sh": "SHELL",
    ".bash": "SHELL",
    ".zsh": "SHELL",
    ".fish": "SHELL",
    ".ps1": "POWERSHELL",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".json": "JSON",
    ".toml": "TOML",
    ".xml": "XML",
    ".html": "HTML",
    ".htm": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "SASS",
    ".less": "LESS",
    ".md": "MARKDOWN",
}
