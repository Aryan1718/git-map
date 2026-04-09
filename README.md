<h1 align="center">GIT-MAP</h1>

<p align="center">
  <strong>Turn any public GitHub repo into a code knowledge graph.</strong>
</p>

<p align="center">
  <a href="https://git-map.com"><img src="https://img.shields.io/badge/try-git--map.com-blue?style=flat-square" alt="Try GIT-MAP"></a>
  <a href="https://github.com/csuftitan/github-kb/stargazers"><img src="https://img.shields.io/github/stars/csuftitan/github-kb?style=flat-square" alt="Stars"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square" alt="MIT License"></a>
</p>

<p align="center">
  <img src="docs/git-map.gif" alt="GIT-MAP demo" width="90%" />
</p>

## The Idea

GIT-MAP is a fun way to see what a codebase looks like as a graph.

Instead of going to a website, pasting a repo URL, and waiting for a tool to understand it, just change the domain:

```text
https://github.com/owner/repo
https://git-map.com/owner/repo
```

That is it. Open the new URL and GIT-MAP builds an interactive knowledge graph for the repo.

## Why

Sometimes you just want to explore a codebase visually:

- see the main files
- find important classes and functions
- understand how pieces connect
- get a quick feel for a repo without cloning it

This is not trying to replace reading code. It is a cool first look before you dive in.

## How It Works

```text
GitHub repo URL
   -> GitHub API
   -> Aider RepoMap + Tree-sitter
   -> graph nodes and links
   -> React + D3 visualization
```

The backend fetches supported source files, extracts symbols and references, builds graph JSON, and the frontend renders it in the browser.

## Stack

- FastAPI
- GitHub API
- Aider RepoMap
- Tree-sitter
- React
- D3
- Tailwind

## Quick Start

Create your environment:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
cp .env.example .env
```

Add a GitHub token to `.env`:

```env
GITHUB_TOKEN=ghp_your_github_token_here
MAX_FILES=300
CACHE_TTL=3600
LOG_LEVEL=INFO
```

Run the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

Run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## API

Health check:

```bash
curl http://localhost:8000/health
```

Analyze a repo:

```bash
curl -X POST http://localhost:8000/analyze-repo \
  -H "Content-Type: application/json" \
  -d '{"owner":"tiangolo","repo":"fastapi"}'
```

Get a graph:

```bash
curl http://localhost:8000/api/graph/tiangolo/fastapi
```

## Supported Files

```text
.py .js .ts .tsx .jsx .java .go .rs .rb .cpp .c .h .cs .php .swift .kt
```

## Development

Run tests:

```bash
pytest
```

Main files:

- `app/main.py`
- `app/api/routes.py`
- `app/services/github.py`
- `app/services/repomap.py`
- `app/services/graph_builder.py`
- `frontend/src/App.jsx`

## Roadmap

- better symbol resolution
- search and filtering
- file drill-down
- larger repo performance improvements
- Redis cache backend

## License

MIT
