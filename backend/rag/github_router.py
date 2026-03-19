from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel

from integrations.github import GitHubIntegration, fetch_file
from rag.ingest import ingest_integration

router = APIRouter(prefix="/github")

_ingest_status: dict[str, str] = {}


class IngestRequest(BaseModel):
    repos: list[str] | None = None  # overrides settings if provided
    token: str | None = None  # overrides settings if provided


class IngestResponse(BaseModel):
    message: str
    repos: list[str]


class IngestStatusResponse(BaseModel):
    status: dict[str, str]


class FileResponse(BaseModel):
    repo: str
    path: str
    ref: str
    content: str


async def _run_ingest(repos: list[str], token: str | None) -> None:
    key = ",".join(repos)
    _ingest_status[key] = "running"
    try:
        integration = GitHubIntegration(repos=repos, token=token)
        count = await ingest_integration(integration)
        _ingest_status[key] = f"completed: {count} chunks ingested"
    except Exception as e:
        _ingest_status[key] = f"error: {e}"


@router.post("/ingest", response_model=IngestResponse)
async def ingest_repos(
    body: IngestRequest,
    background_tasks: BackgroundTasks,
) -> IngestResponse:
    """Trigger background ingestion of the navigation layer for one or more repos.

    If `repos` is omitted, uses the GITHUB_REPOS env var.
    """
    # Resolve the repo list so we can return it immediately
    from settings import settings

    repos = body.repos or [r.strip() for r in settings.GITHUB_REPOS.split(",") if r.strip()]
    if not repos:
        raise HTTPException(
            status_code=400,
            detail="No repos specified and GITHUB_REPOS env var is empty.",
        )

    background_tasks.add_task(_run_ingest, repos, body.token)
    key = ",".join(repos)
    _ingest_status[key] = "started"
    return IngestResponse(message="Ingestion started", repos=repos)


@router.get("/ingest/status", response_model=IngestStatusResponse)
async def ingest_status() -> IngestStatusResponse:
    return IngestStatusResponse(status=_ingest_status)


@router.get("/file", response_model=FileResponse)
async def get_file(
    repo: str = Query(..., description="owner/repo"),
    path: str = Query(..., description="path to file inside the repo"),
    ref: str = Query("HEAD", description="branch, tag, or commit SHA"),
    token: str | None = Query(None, description="GitHub token (overrides env var)"),
) -> FileResponse:
    """Fetch the raw content of a single file on demand.

    Use this when the LLM (or user) needs to read actual source code after
    locating the right file via RAG on the indexed file tree.
    """
    try:
        content = await fetch_file(repo=repo, path=path, ref=ref, token=token)
    except Exception as e:
        status_code = 404
        # httpx raises HTTPStatusError; surface the real status when available
        if hasattr(e, "response") and hasattr(e.response, "status_code"):
            status_code = e.response.status_code
        raise HTTPException(status_code=status_code, detail=str(e)) from e

    return FileResponse(repo=repo, path=path, ref=ref, content=content)
