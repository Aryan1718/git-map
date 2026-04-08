# Repo Knowledge Graph

This project turns a GitHub repository into an interactive knowledge graph.

Given a GitHub repo like:

```text
https://github.com/Aryan1718/mini-redis
```

you can open:

```text
http://localhost:8000/Aryan1718/mini-redis
```

and the app will fetch the repo, analyze supported source files, build a graph of files and symbols, and render it in the browser.

## What This App Does

The system has two parts:

1. A FastAPI backend that:
   - talks to the GitHub API
   - downloads supported source files into a temporary directory
   - runs Aider RepoMap / Tree-sitter to extract definitions and references
   - converts those tags into a graph JSON response
   - caches the result in memory

2. A browser UI that:
   - loads the graph JSON from the backend
   - renders it with D3.js as a force-directed graph
   - colors nodes by file type such as `.py`, `.js`, `.ts`, `.jsx`, `.tsx`
   - lets you click files to expand internal symbols
   - shows node details and live graph filtering

## Current Project Structure

```text
git-map/
├── README.md
├── agents.md
├── requirements.txt
├── .env.example
├── .gitignore
├── pytest.ini
├── app/
│   ├── main.py
│   ├── config.py
│   ├── api/
│   │   └── routes.py
│   ├── core/
│   │   └── cache.py
│   ├── services/
│   │   ├── github.py
│   │   ├── repomap.py
│   │   └── graph_builder.py
│   └── static/
│       └── index.html
└── tests/
    └── test_graph_builder.py
```

## How It Works

### 1. Browser Request

When you open a URL like:

```text
http://localhost:8000/Aryan1718/enterprise-rag-platform
```

the server returns the graph UI page.

That page reads the current path and then requests:

```text
/api/graph/Aryan1718/enterprise-rag-platform
```

### 2. GitHub Fetch

The backend:

- gets the latest commit SHA from GitHub
- gets the full repository tree
- filters only supported source files
- limits the repo to `MAX_FILES`
- downloads those files to a temporary directory

This logic is in [app/services/github.py](/Users/csuftitan/Desktop/github-kb/app/services/github.py).

### 3. AST / Tag Extraction

After files are downloaded, the backend runs Aider RepoMap on each file.

RepoMap extracts tags like:

- definition names
- reference names
- line numbers
- relative file paths

This logic is in [app/services/repomap.py](/Users/csuftitan/Desktop/github-kb/app/services/repomap.py).

### 4. Graph Build

The app converts extracted tags into:

- file nodes
- symbol nodes
- `contains` links
- `calls` links

The graph builder also:

- deduplicates nodes and links
- tries to attribute references to the containing definition
- creates file-to-file overview call edges
- calculates basic node weights

This logic is in [app/services/graph_builder.py](/Users/csuftitan/Desktop/github-kb/app/services/graph_builder.py).

### 5. Cache

Each analyzed repo is cached in memory using a key like:

```text
owner/repo:commit_sha
```

That means if the commit SHA has not changed, the graph can be served from cache.

This logic is in [app/core/cache.py](/Users/csuftitan/Desktop/github-kb/app/core/cache.py).

### 6. Frontend Rendering

The frontend page:

- loads graph JSON from the backend
- draws a D3 force graph
- keeps files visible by default
- expands child symbols when a file is clicked
- colors nodes by extension family
- shows a details panel for the selected node

This UI is in [app/static/index.html](/Users/csuftitan/Desktop/github-kb/app/static/index.html).

## Routes

### Browser Routes

- `GET /`
  - loads the graph UI
- `GET /{owner}/{repo}`
  - loads the graph UI for that GitHub repo path

### API Routes

- `GET /health`
  - health check
- `POST /analyze-repo`
  - accepts JSON body like `{ "owner": "tiangolo", "repo": "fastapi" }`
- `GET /graph/{owner}/{repo}`
  - returns graph JSON
- `GET /api/graph/{owner}/{repo}`
  - returns graph JSON for the frontend

## Example Graph Response

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
    }
  ],
  "links": [
    {
      "source": "fastapi/main.py",
      "target": "fastapi/main.py::main",
      "type": "contains"
    }
  ]
}
```

## Supported File Types

The backend currently filters these extensions:

```text
.py .js .ts .tsx .jsx .java .go .rs .rb .cpp .c .h .cs .php .swift .kt
```

The frontend currently has distinct color families for:

- `.py`
- `.js`
- `.ts`
- `.jsx` / `.tsx`
- all others as fallback

## Setup

### 1. Create and activate a virtual environment

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

If `python3.12` is not installed on your machine, install it first. Python 3.12 is recommended for this project because some dependencies do not work reliably with Python 3.14.

### 2. Install dependencies

```bash
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
```

### 3. Create your environment file

```bash
cp .env.example .env
```

Then edit `.env` and add your GitHub token:

```env
GITHUB_TOKEN=ghp_your_token_here
MAX_FILES=300
CACHE_TTL=3600
LOG_LEVEL=INFO
```

## How To Get a GitHub Token

1. Sign in to GitHub.
2. Open `Settings`.
3. Go to `Developer settings`.
4. Open `Personal access tokens`.
5. Create a token.

Recommended:

- use a fine-grained token
- give it read-only access to repository contents
- include any private repos you want to analyze

For public repos, a token is still useful because it gives higher API rate limits.

## Run The App

Start the server with:

```bash
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

Then open:

```text
http://localhost:8000/
```

or directly open a repo:

```text
http://localhost:8000/Aryan1718/mini-redis
```

## Test The App

Run tests:

```bash
pytest -q
```

Health check:

```bash
curl http://localhost:8000/health
```

API request:

```bash
curl http://localhost:8000/api/graph/tiangolo/fastapi
```

POST request:

```bash
curl -X POST http://localhost:8000/analyze-repo \
  -H "Content-Type: application/json" \
  -d '{"owner":"tiangolo","repo":"fastapi"}'
```

## Important Notes

- The graph is only as good as the extracted RepoMap tags. Some relationships are inferred, not guaranteed exact.
- Very large repositories are capped by `MAX_FILES`.
- The cache is in memory only. Restarting the app clears it.
- The current frontend is a single static page, not a React app.
- The embedded `discovermap/` folder is being used here as a reference implementation for graph presentation ideas.

## Current Limitations

- Function call resolution is approximate because Aider RepoMap tags do not provide full ownership/context for every reference.
- There is no persistent cache like Redis yet.
- There is no authentication UI or repo history view.
- The graph may still need further tuning for very large repos.

## Future Improvements

- stronger cross-file call resolution
- better clustering and grouping
- persistent Redis cache
- richer side panel with code snippets
- search by full symbol path
- more DiscoverMap-style graph behavior and animation

