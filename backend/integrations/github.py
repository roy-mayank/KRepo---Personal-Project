from __future__ import annotations

import base64
from collections.abc import AsyncIterator
from typing import Any

import httpx

from .base import BaseIntegration, Document

# File extensions worth indexing for navigation
_TEXT_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".go",
    ".rs",
    ".java",
    ".cs",
    ".cpp",
    ".c",
    ".h",
    ".rb",
    ".php",
    ".swift",
    ".kt",
    ".md",
    ".txt",
    ".yaml",
    ".yml",
    ".json",
    ".toml",
    ".env.example",
    ".sh",
    ".sql",
}
_MAX_TREE_FILES = 2000  # cap to avoid huge payloads


class GitHubIntegration(BaseIntegration):
    """Ingests the *navigation layer* of GitHub repos into Qdrant.

    What gets indexed (cheap, rarely stale):
    - README.md content per repo
    - Full file tree (paths only) per repo
    - Last 50 commit messages per repo

    Actual file content is NOT indexed here — use fetch_file() on demand.
    """

    DESCRIPTION = "GitHub repository navigation layer (READMEs, file tree, commits)"

    def __init__(
        self,
        repos: list[str] | None = None,
        token: str | None = None,
    ) -> None:
        from settings import settings as _settings

        self.token = token or _settings.GITHUB_TOKEN
        raw_repos = repos or [r.strip() for r in _settings.GITHUB_REPOS.split(",") if r.strip()]
        self.repos = raw_repos  # ["owner/repo", ...]
        self._headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            self._headers["Authorization"] = f"Bearer {self.token}"

    async def fetch_documents(self) -> AsyncIterator[Document]:
        async with httpx.AsyncClient(timeout=30) as client:
            for repo in self.repos:
                async for doc in self._ingest_repo(client, repo):
                    yield doc

    async def _ingest_repo(self, client: httpx.AsyncClient, repo: str) -> AsyncIterator[Document]:
        owner, _, name = repo.partition("/")
        base = f"https://api.github.com/repos/{owner}/{name}"
        source = f"github:{repo}"

        # 1. README
        readme_doc = await self._fetch_readme(client, base, source, repo)
        if readme_doc:
            yield readme_doc

        # 2. File tree
        tree_doc = await self._fetch_tree(client, base, source, repo)
        if tree_doc:
            yield tree_doc

        # 3. Recent commits
        commits_doc = await self._fetch_commits(client, base, source, repo)
        if commits_doc:
            yield commits_doc

    async def _fetch_readme(self, client: httpx.AsyncClient, base: str, source: str, repo: str) -> Document | None:
        resp = await client.get(f"{base}/readme", headers=self._headers)
        if resp.status_code != 200:
            return None
        data: dict[str, Any] = resp.json()
        encoded = data.get("content", "")
        try:
            content = base64.b64decode(encoded).decode("utf-8", errors="replace")
        except Exception:
            return None
        if not content.strip():
            return None
        return Document(
            source=source,
            source_id=f"{repo}:README",
            title=f"{repo} — README",
            content=content,
            url=data.get("html_url", ""),
            metadata={"repo": repo, "doc_type": "readme"},
        )

    async def _fetch_tree(self, client: httpx.AsyncClient, base: str, source: str, repo: str) -> Document | None:
        resp = await client.get(
            f"{base}/git/trees/HEAD",
            headers=self._headers,
            params={"recursive": "1"},
        )
        if resp.status_code != 200:
            return None
        data: dict[str, Any] = resp.json()
        tree: list[dict[str, Any]] = data.get("tree", [])

        paths = [item["path"] for item in tree if item.get("type") == "blob" and _is_indexable(item.get("path", ""))][
            :_MAX_TREE_FILES
        ]

        if not paths:
            return None

        content = f"File tree for {repo}:\n\n" + "\n".join(paths)
        return Document(
            source=source,
            source_id=f"{repo}:tree",
            title=f"{repo} — file tree",
            content=content,
            url=f"https://github.com/{repo}",
            metadata={"repo": repo, "doc_type": "tree"},
        )

    async def _fetch_commits(self, client: httpx.AsyncClient, base: str, source: str, repo: str) -> Document | None:
        resp = await client.get(
            f"{base}/commits",
            headers=self._headers,
            params={"per_page": "50"},
        )
        if resp.status_code != 200:
            return None
        commits: list[dict[str, Any]] = resp.json()

        lines: list[str] = []
        for c in commits:
            sha = c.get("sha", "")[:7]
            msg = (c.get("commit") or {}).get("message", "").split("\n")[0]
            author = ((c.get("commit") or {}).get("author") or {}).get("name", "")
            date = ((c.get("commit") or {}).get("author") or {}).get("date", "")[:10]
            lines.append(f"{sha} {date} [{author}] {msg}")

        if not lines:
            return None

        content = f"Recent commits for {repo}:\n\n" + "\n".join(lines)
        return Document(
            source=source,
            source_id=f"{repo}:commits",
            title=f"{repo} — recent commits",
            content=content,
            url=f"https://github.com/{repo}/commits",
            metadata={"repo": repo, "doc_type": "commits"},
        )


async def fetch_file(
    repo: str,
    path: str,
    ref: str = "HEAD",
    token: str | None = None,
) -> str:
    """Fetch raw content of a single file from GitHub on demand.

    Returns the decoded file content as a string, or raises httpx.HTTPStatusError
    on 404/403 etc.
    """
    from settings import settings as _settings

    _token = token or _settings.GITHUB_TOKEN
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if _token:
        headers["Authorization"] = f"Bearer {_token}"

    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers, params={"ref": ref})
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

    encoded = data.get("content", "")
    return base64.b64decode(encoded).decode("utf-8", errors="replace")


def _is_indexable(path: str) -> bool:
    """Return True for source/doc files worth putting in the file tree index."""
    lower = path.lower()
    # skip hidden dirs, lock files, generated dirs
    skip_prefixes = (".", "node_modules/", "vendor/", "dist/", "build/", ".git/")
    if any(lower.startswith(p) or f"/{p}" in lower for p in skip_prefixes):
        return False
    dot = lower.rfind(".")
    if dot == -1:
        return False
    return lower[dot:] in _TEXT_EXTENSIONS
