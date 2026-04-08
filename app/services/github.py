import asyncio
import base64
import logging
import os
from pathlib import Path

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
_CONCURRENCY = 20


class GitHubError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


class GitHubClient:
    def __init__(self, settings: Settings):
        self._headers = {
            "Authorization": f"Bearer {settings.github_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self._max_files = settings.max_files
        self._exts = set(settings.supported_extensions)

    async def get_latest_sha(self, owner: str, repo: str) -> str:
        async with httpx.AsyncClient(headers=self._headers, timeout=15) as client:
            resp = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/commits/HEAD")
            self._raise_for_status(resp, owner, repo)
            return resp.json()["sha"]

    async def get_file_tree(self, owner: str, repo: str, sha: str) -> list[str]:
        async with httpx.AsyncClient(headers=self._headers, timeout=30) as client:
            resp = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{sha}",
                params={"recursive": "1"},
            )
            self._raise_for_status(resp, owner, repo)
            tree = resp.json().get("tree", [])

        paths = [
            item["path"]
            for item in tree
            if item["type"] == "blob" and Path(item["path"]).suffix in self._exts
        ]

        if len(paths) > self._max_files:
            logger.warning(
                "%s/%s has %d supported files, truncating to %d",
                owner,
                repo,
                len(paths),
                self._max_files,
            )
            paths = paths[: self._max_files]

        logger.info("%s/%s: %d files to parse", owner, repo, len(paths))
        return paths

    async def download_files(
        self, owner: str, repo: str, paths: list[str], dest_dir: str
    ) -> list[str]:
        sem = asyncio.Semaphore(_CONCURRENCY)
        written: list[str] = []

        async with httpx.AsyncClient(headers=self._headers, timeout=20) as client:
            tasks = [
                self._fetch_and_write(client, sem, owner, repo, path, dest_dir)
                for path in paths
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        for path, result in zip(paths, results):
            if isinstance(result, Exception):
                logger.warning("Failed to download %s: %s", path, result)
            else:
                written.append(result)

        logger.info("Downloaded %d/%d files", len(written), len(paths))
        return written

    async def _fetch_and_write(
        self,
        client: httpx.AsyncClient,
        sem: asyncio.Semaphore,
        owner: str,
        repo: str,
        path: str,
        dest_dir: str,
    ) -> str:
        async with sem:
            resp = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}")
            resp.raise_for_status()
            data = resp.json()

        content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")

        local_path = os.path.join(dest_dir, path)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "w", encoding="utf-8") as f:
            f.write(content)

        return local_path

    @staticmethod
    def _raise_for_status(resp: httpx.Response, owner: str, repo: str) -> None:
        if resp.status_code == 404:
            raise GitHubError(
                f"Repo {owner}/{repo} not found or not public",
                status_code=404,
            )
        if resp.status_code == 403:
            raise GitHubError("GitHub rate limit exceeded", status_code=429)
        if resp.status_code >= 400:
            raise GitHubError(f"GitHub API error {resp.status_code}", status_code=502)
