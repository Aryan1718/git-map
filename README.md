# GIT-MAP

<p align="center">
  <strong>Swap <code>github.com</code> for <code>git-map.com</code> and turn any public repo into a living code graph.</strong>
</p>

<p align="center">
  GIT-MAP pulls a repository through the GitHub API, extracts structure with RepoMap + Tree-sitter,
  and renders the result as an interactive graph in the browser.
</p>

<p align="center">
  <code>https://github.com/twbs/bootstrap</code><br/>
  becomes<br/>
  <code>https://git-map.com/twbs/bootstrap</code>
</p>

<p align="center">
  <a href="https://git-map.com"><img src="https://img.shields.io/badge/live-git--map.com-0f172a?style=flat-square" alt="Live site"></a>
  <a href="#"><img src="https://img.shields.io/badge/backend-FastAPI-009688?style=flat-square" alt="FastAPI"></a>
  <a href="#"><img src="https://img.shields.io/badge/frontend-React%20%2B%20D3-111827?style=flat-square" alt="React and D3"></a>
  <a href="#"><img src="https://img.shields.io/badge/parser-RepoMap%20%2B%20Tree--sitter-f59e0b?style=flat-square" alt="RepoMap and Tree-sitter"></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/python-3.10%2B-2563eb?style=flat-square" alt="Python 3.10+"></a>
</p>

<p align="center">
  <img src="docs/git-map.gif" alt="GIT-MAP demo" width="88%" />
</p>

## Why This Exists

Codebases get big fast. Even good repos turn into a maze once you are trying to answer questions like:

- Where does this feature actually start?
- Which files matter?
- What calls what?
- What is the shape of this repo without reading 200 files by hand?

GIT-MAP answers that by turning repository structure into a graph you can explore visually.

## The Hook

This is the whole trick:

1. Take any public GitHub repo URL.
2. Replace `github.com` with `git-map.com`.
3. Open it.
4. The graph is generated automatically.

No copying files. No cloning repos. No manual setup for the end user.

## What It Does

Given a public GitHub repo, GIT-MAP:

- fetches the latest commit SHA
- walks the repo tree through the GitHub API
- downloads supported source files into a temp workspace
- extracts definitions and references with Aider RepoMap and Tree-sitter
- resolves symbol relationships into graph nodes and links
- renders the result in a force-directed UI with React and D3

The output is JSON shaped for graph visualization, with metadata about files, symbols, and relationships.

## How It Works

```text
Browser / React UI        FastAPI API                 GitHub API
-------------------       ------------------------    ------------------------
Paste repo URL       ->   Parse owner/repo       ->   Fetch latest commit SHA
Open graph page      ->   Check cache            ->   Fetch recursive file tree
Render graph         <-   Build graph payload    <-   Download supported files
                          Extract RepoMap tags
                          Resolve links + return JSON
```

### Pipeline

1. User opens a `git-map.com/{owner}/{repo}` URL or enters a GitHub repo.
2. FastAPI resolves the repo and latest commit SHA.
3. The backend fetches the repository tree and filters to supported source files.
4. Files are downloaded into a temporary local directory.
5. `repomap.py` extracts tags from the repo using RepoMap.
6. `graph_builder.py` converts those tags into graph nodes and links.
7. The frontend renders the graph for exploration.

## Graph Shape

Example response:

```json
{
  "meta": {
    "owner": "tiangolo",
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
      "id": "fastapi/routing.py::APIRouter",
      "label": "APIRouter",
      "type": "type",
      "file": "fastapi/routing.py",
      "line": 12,
      "weight": 0.87
    }
  ],
  "links": [
    {
      "source": "fastapi/routing.py",
      "target": "fastapi/routing.py::APIRouter",
      "type": "contains"
    },
    {
      "source": "fastapi/applications.py::FastAPI.__init__",
      "target": "fastapi/routing.py::APIRouter.__init__",
      "type": "calls"
    }
  ]
}
```

### Node Types

| Type | Meaning |
|------|---------|
| `file` | Source file node |
| `callable` | Function or method-like symbol |
| `type` | Class or type-like symbol |
| `module` | Module-level semantic node |

### Link Types

| Type | Meaning |
|------|---------|
| `contains` | File or parent symbol owns a symbol |
| `calls` | One symbol or file references another |

## Stack

| Layer | Tech |
|------|------|
| API | FastAPI, Uvicorn |
| HTTP client | `httpx` |
| Parsing | `aider-chat` RepoMap, Tree-sitter |
| Cache | In-memory cache |
| Frontend | React, Vite, D3, Tailwind, Framer Motion |
| Testing | Pytest |

## Project Layout

```text
git-map/
├── app/
│   ├── api/
│   │   └── routes.py
│   ├── core/
│   │   └── cache.py
│   ├── services/
│   │   ├── discovermap_adapter.py
│   │   ├── file_language.py
│   │   ├── github.py
│   │   ├── graph_builder.py
│   │   ├── repomap.py
│   │   └── semantic_normalizer.py
│   ├── static/
│   ├── config.py
│   └── main.py
├── frontend/
│   ├── src/
│   └── package.json
├── requirements.txt
└── README.md
```

## Quick Start

### Use It

For any public repository, swap the domain:

```text
github.com/owner/repo -> git-map.com/owner/repo
```

Example:

```text
https://github.com/twbs/bootstrap
https://git-map.com/twbs/bootstrap
```

### Backend

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt

cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the app at `http://localhost:5173`.

## Environment

Create `.env` from the example file:

```bash
cp .env.example .env
```

```env
GITHUB_TOKEN=ghp_your_github_token_here
MAX_FILES=300
CACHE_TTL=3600
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://git-map.com,https://www.git-map.com
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub token used for repository API requests |
| `MAX_FILES` | No | Maximum supported files downloaded per repo |
| `CACHE_TTL` | No | Cache lifetime in seconds |
| `LOG_LEVEL` | No | Backend logging level |
| `CORS_ORIGINS` | No | Allowed frontend origins |

## API

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/health` | Health check |
| `POST` | `/analyze-repo` | Analyze repo from JSON body |
| `GET` | `/graph/{owner}/{repo}` | Return graph payload |
| `GET` | `/api/graph/{owner}/{repo}` | Return graph payload for clients |
| `GET` | `/api/discover/{owner}/{repo}/index` | Return discover index |
| `GET` | `/api/discover/{owner}/{repo}/chunk/{chunk_id}` | Return discover chunk |
| `GET` | `/api/discover/{owner}/{repo}/file?path=...` | Return discover file payload |
| `GET` | `/{owner}/{repo}` | Browser route for the graph shell |

### Sample Requests

```bash
curl http://localhost:8000/health
```

```bash
curl http://localhost:8000/api/graph/tiangolo/fastapi
```

```bash
curl -X POST http://localhost:8000/analyze-repo \
  -H "Content-Type: application/json" \
  -d '{"owner":"tiangolo","repo":"fastapi"}'
```

## Supported File Extensions

```text
.py .js .ts .tsx .jsx .java .go .rs .rb .cpp .c .h .cs .php .swift .kt
```

## Development

Run tests:

```bash
pytest
```

Useful entry points:

- `app/main.py`
- `app/api/routes.py`
- `app/services/github.py`
- `app/services/repomap.py`
- `app/services/graph_builder.py`
- `frontend/src/App.jsx`
- `frontend/src/pages/Graph.jsx`

## Roadmap

- Improve symbol resolution across larger and messier repos
- Upgrade caching from in-memory to Redis without changing service interfaces
- Expand graph interactions, search, filtering, and file drill-down
- Add stronger benchmark and scale examples
- Ship cleaner deployment docs

## License

No license file is included yet.

Add your preferred license and update the badge when you are ready to publish this more formally.
