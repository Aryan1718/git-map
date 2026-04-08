import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import get_settings
from app.core.cache import MemoryCache

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Repo Knowledge Graph",
    description="Turns a GitHub repo into a knowledge graph via Aider RepoMap + Tree-sitter",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.cache = MemoryCache()
app.include_router(router)
app.mount("/static", StaticFiles(directory=Path(__file__).resolve().parent / "static"), name="static")


@app.on_event("startup")
async def startup():
    logger.info("Repo Knowledge Graph API starting up")
    logger.info("Cache backend: MemoryCache")
    logger.info("Max files per repo: %d", settings.max_files)
