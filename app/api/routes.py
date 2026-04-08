import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.core.cache import BaseCache
from app.services.discovermap_adapter import build_discovermap_file_payload, build_discovermap_payload
from app.services import graph_builder
from app.services.github import GitHubClient, GitHubError
from app.services.repomap import RepomapError, extract_tags

logger = logging.getLogger(__name__)
router = APIRouter()
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
INDEX_HTML = STATIC_DIR / "index.html"


class AnalyzeRequest(BaseModel):
    owner: str
    repo: str


class AnalyzeResponse(BaseModel):
    meta: dict
    nodes: list[dict]
    links: list[dict]


def get_cache() -> BaseCache:
    from app.main import app

    return app.state.cache


async def analyze_repo_graph(
    owner: str,
    repo: str,
    settings: Settings,
    cache: BaseCache,
) -> dict:
    owner = owner.strip().lower()
    repo = repo.strip().lower()

    if not owner or not repo:
        raise HTTPException(status_code=422, detail="owner and repo are required")

    github = GitHubClient(settings)

    try:
        sha = await github.get_latest_sha(owner, repo)
    except GitHubError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc))

    cache_key = f"{owner}/{repo}:{sha}"
    cached = cache.get(cache_key)
    if cached:
        cached["meta"]["cached"] = True
        return cached

    try:
        file_paths = await github.get_file_tree(owner, repo, sha)
    except GitHubError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc))

    if not file_paths:
        raise HTTPException(status_code=422, detail="No parseable files found in this repo")

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            written = await github.download_files(owner, repo, file_paths, tmpdir)
        except GitHubError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc))

        if not written:
            raise HTTPException(status_code=422, detail="Could not download any files")

        try:
            tags = extract_tags(tmpdir, file_paths)
        except RepomapError as exc:
            raise HTTPException(status_code=500, detail=str(exc))

        graph = graph_builder.build(tags, file_paths)

    response = {
        "meta": {
            "owner": owner,
            "repo": repo,
            "commit_sha": sha,
            "file_count": len(file_paths),
            "node_count": len(graph.nodes),
            "link_count": len(graph.links),
            "cached": False,
        },
        **graph.dict(),
    }

    cache.set(cache_key, response, ttl=settings.cache_ttl)
    return response


async def analyze_repo_discovermap(
    owner: str,
    repo: str,
    settings: Settings,
    cache: BaseCache,
) -> dict:
    graph = await analyze_repo_graph(owner, repo, settings, cache)
    return build_discovermap_payload(graph)


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/", response_class=HTMLResponse)
async def home():
    return INDEX_HTML.read_text(encoding="utf-8")


@router.post("/analyze-repo", response_model=AnalyzeResponse)
async def analyze_repo_post(
    body: AnalyzeRequest,
    settings: Settings = Depends(get_settings),
    cache: BaseCache = Depends(get_cache),
):
    return await analyze_repo_graph(body.owner, body.repo, settings, cache)


@router.get("/graph/{owner}/{repo}", response_model=AnalyzeResponse)
async def analyze_repo_graph_route(
    owner: str,
    repo: str,
    settings: Settings = Depends(get_settings),
    cache: BaseCache = Depends(get_cache),
):
    return await analyze_repo_graph(owner, repo, settings, cache)


@router.get("/api/graph/{owner}/{repo}", response_model=AnalyzeResponse)
async def analyze_repo_api_route(
    owner: str,
    repo: str,
    settings: Settings = Depends(get_settings),
    cache: BaseCache = Depends(get_cache),
):
    return await analyze_repo_graph(owner, repo, settings, cache)


@router.get("/api/discover/{owner}/{repo}/index")
async def discovermap_index_route(
    owner: str,
    repo: str,
    settings: Settings = Depends(get_settings),
    cache: BaseCache = Depends(get_cache),
):
    payload = await analyze_repo_discovermap(owner, repo, settings, cache)
    return payload["index"]


@router.get("/api/discover/{owner}/{repo}/chunk/{chunk_id}")
async def discovermap_chunk_route(
    owner: str,
    repo: str,
    chunk_id: str,
    settings: Settings = Depends(get_settings),
    cache: BaseCache = Depends(get_cache),
):
    payload = await analyze_repo_discovermap(owner, repo, settings, cache)
    chunk = payload["chunks"].get(chunk_id)
    if chunk is None:
        raise HTTPException(status_code=404, detail=f"Chunk not found: {chunk_id}")
    return chunk


@router.get("/api/discover/{owner}/{repo}/file")
async def discovermap_file_route(
    owner: str,
    repo: str,
    path: str = Query(...),
    include_callable: list[str] = Query(default_factory=list),
    settings: Settings = Depends(get_settings),
    cache: BaseCache = Depends(get_cache),
):
    payload = await analyze_repo_discovermap(owner, repo, settings, cache)
    file_payload = build_discovermap_file_payload(payload, path, include_callables=include_callable)
    if file_payload is None:
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    return file_payload


@router.get("/{owner}/{repo}", response_class=HTMLResponse)
async def analyze_repo_browser_route(owner: str, repo: str):
    return INDEX_HTML.read_text(encoding="utf-8")
