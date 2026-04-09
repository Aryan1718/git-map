# agents.md - GIT-MAP Repo Guide

Use this file as the first stop when making changes in this repo.

## Project Goal

GIT-MAP is a fun codebase explorer. A user can take a public GitHub repo URL and change the domain:

```text
https://github.com/owner/repo
https://git-map.com/owner/repo
```

The app fetches that repo through the GitHub API, extracts code symbols with Aider RepoMap and Tree-sitter, converts the result into graph JSON, and renders an interactive React + D3 graph in the browser.

## Current Architecture

```text
Browser / React
  -> GET /{owner}/{repo}
  -> GET /api/graph/{owner}/{repo}
  -> FastAPI
  -> GitHub API
  -> temp downloaded source files
  -> Aider RepoMap tags
  -> normalized graph nodes and links
  -> React + D3 visualization
```

The backend owns repo fetching, parsing, graph building, caching, and API responses.

The frontend owns the landing page, GitHub URL parsing, route handling, and graph visualization.

## Important Files

### Root

- `README.md` - public-facing project README. Keep it simple and product-focused.
- `agents.md` - this contributor/agent guide.
- `requirements.txt` - Python backend dependencies.
- `.env.example` - backend environment template.
- `pytest.ini` - pytest config.
- `runtime.txt` - Python runtime hint for deployment.
- `docs/git-map.gif` - README/demo GIF.

### Backend

- `app/main.py` - FastAPI app setup, CORS, cache initialization, router registration, static mount.
- `app/config.py` - environment-backed settings, supported extensions, CORS origin parsing.
- `app/api/routes.py` - all HTTP routes and orchestration for analyzing repos.
- `app/core/cache.py` - cache interface and in-memory cache implementation.
- `app/services/github.py` - async GitHub API client for latest SHA, file tree, and file downloads.
- `app/services/repomap.py` - wrapper around `aider.repomap.RepoMap`, converts raw tags to local `Tag` dataclass.
- `app/services/semantic_normalizer.py` - normalizes raw RepoMap tags into visible graph symbol kinds.
- `app/services/graph_builder.py` - converts tags and file paths into `{ nodes, links }`.
- `app/services/discovermap_adapter.py` - converts graph payloads into chunked discover/index/file payloads.
- `app/services/file_language.py` - language detection and per-language graph colors.
- `app/static/index.html` - static browser shell served by FastAPI routes.

### Frontend

- `frontend/package.json` - Vite scripts and frontend dependencies.
- `frontend/src/main.jsx` - React entry point.
- `frontend/src/App.jsx` - top-level React app/router.
- `frontend/src/pages/Home.jsx` - landing/home experience.
- `frontend/src/pages/Graph.jsx` - repo graph page.
- `frontend/src/components/RepoGraphCanvas.jsx` - D3 graph rendering component.
- `frontend/src/components/Hero.jsx` - home hero/domain-swap entry UI.
- `frontend/src/components/ExampleRepos.jsx` - example repo shortcuts.
- `frontend/src/components/Features.jsx` - home feature copy.
- `frontend/src/components/Footer.jsx` - footer.
- `frontend/src/components/BackgroundRippleEffect.jsx` - visual background effect.
- `frontend/src/components/GridDotsBackdrop.jsx` - grid backdrop.
- `frontend/src/components/LayoutTextFlip.jsx` - text flip visual component.
- `frontend/src/utils/parseGithubUrl.js` - GitHub URL parsing utility.
- `frontend/src/index.css` - Tailwind/global styles.
- `frontend/.env.example` - frontend environment template.
- `frontend/vercel.json` - frontend deployment config.

### Tests

- `tests/conftest.py` - pytest setup.
- `tests/test_graph_builder.py` - graph builder unit tests.

## Backend Routes

- `GET /health` - health check.
- `GET /` - serves the static browser shell.
- `POST /analyze-repo` - accepts `{ "owner": "...", "repo": "..." }` and returns graph JSON.
- `GET /graph/{owner}/{repo}` - returns graph JSON for browser route usage.
- `GET /api/graph/{owner}/{repo}` - returns graph JSON for frontend clients.
- `GET /api/discover/{owner}/{repo}/index` - returns discover index.
- `GET /api/discover/{owner}/{repo}/chunk/{chunk_id}` - returns one discover chunk.
- `GET /api/discover/{owner}/{repo}/file?path=...` - returns detailed file payload.
- `GET /{owner}/{repo}` - serves the graph browser shell for domain-swapped repo URLs.

## Data Flow

1. `routes.py` receives owner/repo and normalizes them.
2. `GitHubClient.get_latest_sha()` fetches the current commit SHA.
3. `MemoryCache` is checked with key `{owner}/{repo}:{sha}`.
4. `GitHubClient.get_file_tree()` fetches the recursive tree and filters to supported source extensions.
5. `GitHubClient.download_files()` downloads files into a temporary directory.
6. `extract_tags()` in `repomap.py` runs Aider RepoMap against the downloaded files.
7. `graph_builder.build()` creates file, type, module, and callable nodes plus `contains` and `calls` links.
8. The graph response is cached and returned.
9. `discovermap_adapter.py` can reshape the same graph into index/chunk/file payloads for richer clients.

## Graph Contract

Graph responses look like:

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
  "nodes": [],
  "links": []
}
```

Node types currently used by `graph_builder.py`:

- `file` - source file node.
- `module` - module-like definition.
- `type` - class/interface/struct/type-like definition.
- `callable` - function/method/callable-like definition.

Link types:

- `contains` - a file or parent symbol owns a symbol.
- `calls` - one callable or file references another callable or file.

## Environment

Backend `.env`:

```env
GITHUB_TOKEN=ghp_your_github_token_here
MAX_FILES=300
CACHE_TTL=3600
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://git-map.com,https://www.git-map.com
```

`GITHUB_TOKEN` is required for backend repo API calls.

Supported source extensions are defined in `app/config.py`.

## Local Commands

Backend setup:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
cp .env.example .env
```

Backend dev server:

```bash
uvicorn app.main:app --reload --port 8000
```

Frontend setup and dev server:

```bash
cd frontend
npm install
npm run dev
```

Frontend build:

```bash
cd frontend
npm run build
```

Tests:

```bash
pytest
```

Useful API checks:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/graph/tiangolo/fastapi
curl -X POST http://localhost:8000/analyze-repo \
  -H "Content-Type: application/json" \
  -d '{"owner":"tiangolo","repo":"fastapi"}'
```

## Where To Change Things

- Change URL/domain-swap behavior in `app/api/routes.py`, `frontend/src/App.jsx`, `frontend/src/pages/Graph.jsx`, or `frontend/src/utils/parseGithubUrl.js`.
- Change GitHub fetching, file filtering, or download behavior in `app/services/github.py` and `app/config.py`.
- Change supported file extensions in `app/config.py`.
- Change symbol extraction details in `app/services/repomap.py`.
- Change symbol classification in `app/services/semantic_normalizer.py`.
- Change graph nodes, links, weights, or call resolution in `app/services/graph_builder.py`.
- Change discover/index/chunk/file API payloads in `app/services/discovermap_adapter.py`.
- Change graph visuals in `frontend/src/components/RepoGraphCanvas.jsx`.
- Change landing page content in `frontend/src/pages/Home.jsx` and related components.
- Change README/demo presentation in `README.md` and `docs/git-map.gif`.

## Implementation Notes

- Keep backend services separate: routes orchestrate, services do the work.
- Do not import the cache directly inside services. Pass cache through route dependencies.
- Preserve the graph response shape unless the frontend and tests are updated together.
- If adding or changing graph behavior, add or update tests in `tests/test_graph_builder.py`.
- If changing frontend graph payload expectations, check `RepoGraphCanvas.jsx` and `Graph.jsx`.
- Keep README language simple: this project is positioned as a fun way to visualize a repo by changing `github.com` to `git-map.com`.
- Avoid committing generated files such as `__pycache__`, `.pytest_cache`, `frontend/node_modules`, or `frontend/dist` unless the deployment setup explicitly requires them.

## Known Future Work

- Improve symbol resolution for larger repos.
- Add better graph search and filtering.
- Add richer file drill-down.
- Add Redis cache backend behind the existing cache interface.
- Improve performance for large repositories.
