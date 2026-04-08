# agents.md — Repo Knowledge Graph

## Project goal

User pastes a GitHub URL (domain swapped to yourdomain.com).
Backend fetches the repo via GitHub API, parses it with Aider's RepoMap
(Tree-sitter AST), and returns a `{ nodes, links }` JSON that a D3.js
force-directed graph renders.

---

## Architecture

```
Browser                FastAPI              GitHub API
──────────────────     ──────────────────   ──────────────
POST /analyze-repo  →  parse owner/repo  →  GET /git/trees
                       check cache          GET /contents/{path}
                       download files       ← file contents
                       write to tmpdir
                       RepoMap.get_tags()
                       build_graph()
                    ←  { nodes, links }
```

---

## Stack

| Layer       | Tech                               |
|-------------|------------------------------------|
| API         | FastAPI + uvicorn                  |
| HTTP client | httpx (async)                      |
| AST parsing | aider-chat (RepoMap + Tree-sitter) |
| Cache       | in-memory dict (swap Redis later)  |
| Output      | JSON: { nodes[], links[] }         |
| Frontend    | D3.js (next phase)                 |

---

## Project structure

```
repo-knowledge-graph/
├── agents.md                   ← this file
├── requirements.txt
├── .env.example
├── app/
│   ├── main.py                 ← FastAPI app, CORS, routes
│   ├── config.py               ← settings from env
│   ├── api/
│   │   └── routes.py           ← POST /analyze-repo, GET /health
│   ├── core/
│   │   └── cache.py            ← in-memory cache (Redis-ready interface)
│   └── services/
│       ├── github.py           ← GitHub API client (fetch tree + files)
│       ├── repomap.py          ← Aider RepoMap wrapper → tags
│       └── graph_builder.py    ← tags → { nodes, links } JSON
└── tests/
    └── test_graph_builder.py
```

---

## Data contracts

### POST /analyze-repo

Request:
```json
{ "owner": "fastapi", "repo": "fastapi" }
```

Response:
```json
{
  "meta": {
    "owner": "fastapi",
    "repo": "fastapi",
    "commit_sha": "abc123",
    "file_count": 42,
    "node_count": 310,
    "link_count": 480,
    "cached": false
  },
  "nodes": [
    {
      "id": "fastapi/main.py",
      "label": "main.py",
      "type": "file",
      "weight": 1.0
    },
    {
      "id": "fastapi/main.py::FastAPI",
      "label": "FastAPI",
      "type": "class",
      "file": "fastapi/main.py",
      "line": 14,
      "weight": 0.87
    }
  ],
  "links": [
    {
      "source": "fastapi/main.py",
      "target": "fastapi/main.py::FastAPI",
      "type": "contains"
    },
    {
      "source": "fastapi/main.py::get_openapi",
      "target": "fastapi/utils.py::get_openapi",
      "type": "calls"
    }
  ]
}
```

### Node types

| type    | meaning                          | D3 color hint |
|---------|----------------------------------|---------------|
| file    | source file node                 | teal          |
| class   | class definition                 | purple        |
| def     | function / method definition     | amber         |
| ref     | symbol reference / call site     | gray          |

### Link types

| type     | meaning                     |
|----------|-----------------------------|
| contains | file owns a symbol          |
| calls    | symbol references another   |

---

## Service responsibilities

### github.py
- `get_latest_sha(owner, repo) → str`
- `get_file_tree(owner, repo, sha) → list[str]`  (paths only, blobs only)
- `download_files(owner, repo, paths, dest_dir)` (async batch, respects rate limit)
- Filters: only download files matching `SUPPORTED_EXTENSIONS`
- Hard cap: `MAX_FILES = 300` (skip rest, log warning)

### repomap.py
- `extract_tags(repo_dir, file_list) → list[Tag]`
- Wraps `aider.repomap.RepoMap`
- Tag fields used: `rel_fname`, `name`, `kind` ("def"/"ref"), `line`
- Catches parse errors per file (tree-sitter may fail on malformed files)

### graph_builder.py
- `build(tags: list[Tag], file_list: list[str]) → GraphResult`
- Deduplicates nodes by id
- Resolves `ref` tags to their `def` counterparts → `calls` links
- Applies simple weight: files get 1.0, defs get ref_count / max_ref_count
- Returns `{ nodes, links }` ready to serialize

### cache.py
- Key: `{owner}/{repo}:{sha}`
- Interface: `get(key)`, `set(key, value, ttl=3600)`, `clear()`
- Default: `MemoryCache` (plain dict + timestamp)
- Swap: implement `RedisCache` with same interface when ready

---

## Environment variables

```
GITHUB_TOKEN=ghp_...        # required — Personal Access Token (read:repo scope)
MAX_FILES=300               # max files downloaded per repo
CACHE_TTL=3600              # seconds
LOG_LEVEL=INFO
```

---

## Supported file extensions

```
.py .js .ts .tsx .jsx .java .go .rs .rb .cpp .c .h .cs .php .swift .kt
```

---

## Error handling

| Situation                    | HTTP status | message                          |
|------------------------------|-------------|----------------------------------|
| Repo not found / private     | 404         | "Repo not found or not public"   |
| GitHub rate limit hit        | 429         | "GitHub rate limit exceeded"     |
| No supported files in repo   | 422         | "No parseable files found"       |
| RepoMap parse total failure  | 500         | "AST extraction failed"          |

---

## Phase 2 — D3 frontend (not in this phase)

- `GET /graph/{owner}/{repo}` serves cached JSON
- React + D3 force simulation
- Node color by type, radius by weight
- Click node → sidebar with file path, line, outgoing links
- Search / filter by symbol name

---

## Running locally

```bash
pip install -r requirements.txt
cp .env.example .env        # add your GITHUB_TOKEN
uvicorn app.main:app --reload --port 8000

# test
curl -X POST http://localhost:8000/analyze-repo \
  -H "Content-Type: application/json" \
  -d '{"owner":"tiangolo","repo":"fastapi"}'
```

---

## Adding Redis later (zero code change to services)

1. `pip install redis`
2. In `cache.py` implement `RedisCache(BaseCache)`
3. In `config.py` set `CACHE_BACKEND=redis`
4. In `main.py` swap `MemoryCache()` → `RedisCache()`

Services never import cache directly — they receive it via dependency injection.
