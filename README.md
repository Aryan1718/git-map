<h1 align="center">GIT-MAP</h1>

<p align="center">
  <strong>Turn any public GitHub repository into an interactive knowledge graph.</strong>
</p>

<p align="center">
  <a href="https://git-map.com"><img src="https://img.shields.io/badge/website-git--map.com-blue?style=flat-square" alt="Website"></a>
  <a href="#"><img src="https://img.shields.io/badge/backend-FastAPI-009688?style=flat-square" alt="FastAPI"></a>
  <a href="#"><img src="https://img.shields.io/badge/frontend-React%20%2B%20D3-222222?style=flat-square" alt="React and D3"></a>
  <a href="#"><img src="https://img.shields.io/badge/parser-Aider%20RepoMap-orange?style=flat-square" alt="Aider RepoMap"></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/python-3.10%2B-blue.svg?style=flat-square" alt="Python 3.10+"></a>
  <a href="#"><img src="https://img.shields.io/badge/status-active-success?style=flat-square" alt="Status"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-add%20your%20license-lightgrey?style=flat-square" alt="License"></a>
</p>

<br>

GIT-MAP analyzes a GitHub repository with the GitHub API, extracts structural symbols with Aider RepoMap and Tree-sitter, and returns a graph that can be explored visually in the browser. Instead of scanning raw files manually, you get a map of files, definitions, and cross-file relationships.

---



<p align="center">
  <img src="docs/git-map.gif" alt="GIT-MAP demo" width="85%" />
</p>



Example:

```md
<p align="center">
  <a href="https://www.loom.com/share/your-video-id">
    <img src="docs/git-map.gif" alt="Watch the demo" width="85%" />
  </a>
</p>
```

---

## Quick Start

```bash
git clone <your-repo-url>
cd github-kb

python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt

cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173/tiangolo/fastapi
```

or call the API directly:

```bash
curl -X POST http://localhost:8000/analyze-repo \
  -H "Content-Type: application/json" \
  -d '{"owner":"tiangolo","repo":"fastapi"}'
```

---

## How It Works

<p align="center">
  <img src="docs/architecture.png" alt="GIT-MAP architecture" width="90%" />
</p>

The flow is straightforward:

1. The frontend accepts a GitHub repository path.
2. The FastAPI backend resolves the latest commit SHA.
3. The GitHub API returns the repository tree and file contents.
4. Supported source files are downloaded into a temporary workspace.
5. Aider RepoMap extracts definitions and references with Tree-sitter.
6. The graph builder converts those tags into `nodes` and `links`.
7. The frontend renders the graph with D3 for interactive exploration.

### Architecture

```text
Browser / React UI        FastAPI API               GitHub API
-------------------       --------------------      ------------------------
Open repo route      ->   Parse owner/repo     ->   Fetch latest commit SHA
Load graph page      ->   Check cache          ->   Fetch repository tree
Render graph         <-   Build graph JSON     <-   Download source files
                          Extract RepoMap tags
                          Return nodes + links
```

### Graph Model

The API returns graph data shaped like this:

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
    }
  ]
}
```

---

## Features

| Feature | Details |
|---------|---------|
| **GitHub repo analysis** | Analyze public repositories by owner and repo name |
| **AST-backed symbol extraction** | Uses Aider RepoMap with Tree-sitter to collect structural tags |
| **Interactive graph UI** | Visualize files and symbols in a browser with React and D3 |
| **Call relationship mapping** | Resolve references to definitions and emit `calls` edges |
| **File ownership graph** | Emit `contains` edges from files to symbol nodes |
| **In-memory caching** | Cache graph results by `owner/repo:sha` |
| **Discover endpoints** | Additional endpoints for index, chunks, and file-oriented payloads |
| **Supported language filtering** | Downloads only supported source files to keep analysis bounded |

---

## Tech Stack

| Layer | Tech |
|------|------|
| Backend | FastAPI, Uvicorn |
| HTTP client | httpx |
| Parsing | aider-chat RepoMap, Tree-sitter |
| Config | Pydantic, pydantic-settings |
| Cache | In-memory cache |
| Frontend | React, Vite, D3, Tailwind CSS, Framer Motion |
| Testing | Pytest |

---

## API

<details>
<summary><strong>REST endpoints</strong></summary>
<br>

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Health check |
| GET | `/` | Static graph shell |
| POST | `/analyze-repo` | Analyze repository from JSON body |
| GET | `/graph/{owner}/{repo}` | Return graph payload |
| GET | `/api/graph/{owner}/{repo}` | Return graph payload for clients |
| GET | `/api/discover/{owner}/{repo}/index` | Return discover index |
| GET | `/api/discover/{owner}/{repo}/chunk/{chunk_id}` | Return discover chunk |
| GET | `/api/discover/{owner}/{repo}/file?path=...` | Return discover file payload |
| GET | `/{owner}/{repo}` | Static graph route |

</details>

<details>
<summary><strong>Node types</strong></summary>
<br>

| Type | Meaning |
|------|---------|
| `file` | Source file node |
| `class` | Class definition |
| `def` | Function or method definition |
| `ref` | Symbol reference or call site |

</details>

<details>
<summary><strong>Link types</strong></summary>
<br>

| Type | Meaning |
|------|---------|
| `contains` | File owns a symbol |
| `calls` | Symbol references another symbol |

</details>

---

## Supported File Extensions

```text
.py .js .ts .tsx .jsx .java .go .rs .rb .cpp .c .h .cs .php .swift .kt
```

---

## Project Structure

```text
github-kb/
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
│   │   └── index.html
│   ├── config.py
│   └── main.py
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── tests/
├── requirements.txt
└── README.md
```

---

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Set the required values:

```env
GITHUB_TOKEN=ghp_your_github_token_here
MAX_FILES=300
CACHE_TTL=3600
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://git-map.com,https://www.git-map.com
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | Yes | - | GitHub token used for API requests |
| `MAX_FILES` | No | `300` | Maximum files downloaded per repository |
| `CACHE_TTL` | No | `3600` | Cache lifetime in seconds |
| `LOG_LEVEL` | No | `INFO` | Backend logging level |
| `CORS_ORIGINS` | No | preset list | Allowed frontend origins |

---

## Usage

<details>
<summary><strong>Backend</strong></summary>
<br>

```bash
uvicorn app.main:app --reload --port 8000
```

</details>

<details>
<summary><strong>Frontend</strong></summary>
<br>

```bash
cd frontend
npm install
npm run dev
```

</details>

<details>
<summary><strong>Sample requests</strong></summary>
<br>

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

</details>

---

## Development

```bash
pytest
```

Useful entry points:

- [app/main.py](/Users/csuftitan/Desktop/github-kb/app/main.py)
- [app/api/routes.py](/Users/csuftitan/Desktop/github-kb/app/api/routes.py)
- [app/services/github.py](/Users/csuftitan/Desktop/github-kb/app/services/github.py)
- [app/services/repomap.py](/Users/csuftitan/Desktop/github-kb/app/services/repomap.py)
- [app/services/graph_builder.py](/Users/csuftitan/Desktop/github-kb/app/services/graph_builder.py)
- [frontend/src/App.jsx](/Users/csuftitan/Desktop/github-kb/frontend/src/App.jsx)
- [frontend/src/pages/Graph.jsx](/Users/csuftitan/Desktop/github-kb/frontend/src/pages/Graph.jsx)

---

## Roadmap

- Add Redis-backed caching without changing service interfaces
- Improve symbol resolution and graph quality across larger repositories
- Expand graph interactions, search, and filtering in the UI
- Add production deployment instructions
- Add screenshots, demo assets, and benchmark examples

---

## Contributing

```bash
git clone <your-repo-url>
cd github-kb
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
pytest
```

Open a pull request with a clear description of the change and any relevant screenshots or API examples.

---

## License

No license file is included yet.

Add your preferred open-source license, such as MIT or Apache-2.0, and update the badge at the top of this README.

<p align="center">
<br>
<a href="https://git-map.com">git-map.com</a><br><br>
<code>uvicorn app.main:app --reload --port 8000</code><br>
<sub>GitHub repository structure, mapped visually.</sub>
</p>
