from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel

from auth.dependencies import get_current_user, require_role
from auth.models import Role, User
from integrations.github import GitHubIntegration, fetch_file
from rag.ingest import ingest_integration

router = APIRouter(prefix="/github")

# Keyed as "{tenant_id}:{repos}" to isolate status per tenant
_ingest_status: dict[str, str] = {}


class IngestRequest(BaseModel):
    repos: list[str] | None = None
    token: str | None = None


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


async def _run_ingest(repos: list[str], token: str | None, tenant_id: str) -> None:
    key = f"{tenant_id}:{','.join(repos)}"
    _ingest_status[key] = "running"
    try:
        integration = GitHubIntegration(repos=repos, token=token)
        count = await ingest_integration(integration, tenant_id)
        _ingest_status[key] = f"completed: {count} chunks ingested"
    except Exception as e:
        _ingest_status[key] = f"error: {e}"


@router.post("/ingest", response_model=IngestResponse)
async def ingest_repos(
    body: IngestRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(Role.admin, Role.member)),
) -> IngestResponse:
    from settings import settings

    repos = body.repos or [r.strip() for r in settings.GITHUB_REPOS.split(",") if r.strip()]
    if not repos:
        raise HTTPException(
            status_code=400,
            detail="No repos specified and GITHUB_REPOS env var is empty.",
        )

    tenant_id = str(current_user.tenant_id)
    background_tasks.add_task(_run_ingest, repos, body.token, tenant_id)
    _ingest_status[f"{tenant_id}:{','.join(repos)}"] = "started"
    return IngestResponse(message="Ingestion started", repos=repos)


@router.get("/ingest/status", response_model=IngestStatusResponse)
async def ingest_status(
    current_user: User = Depends(get_current_user),
) -> IngestStatusResponse:
    tenant_id = str(current_user.tenant_id)
    tenant_status = {
        key.split(":", 1)[1]: val for key, val in _ingest_status.items() if key.startswith(f"{tenant_id}:")
    }
    return IngestStatusResponse(status=tenant_status)


@router.get("/file", response_model=FileResponse)
async def get_file(
    repo: str = Query(..., description="owner/repo"),
    path: str = Query(..., description="path to file inside the repo"),
    ref: str = Query("HEAD", description="branch, tag, or commit SHA"),
    token: str | None = Query(None, description="GitHub token (overrides env var)"),
    _: User = Depends(get_current_user),
) -> FileResponse:
    try:
        content = await fetch_file(repo=repo, path=path, ref=ref, token=token)
    except Exception as e:
        status_code = 404
        if hasattr(e, "response") and hasattr(e.response, "status_code"):
            status_code = e.response.status_code
        raise HTTPException(status_code=status_code, detail=str(e)) from e

    return FileResponse(repo=repo, path=path, ref=ref, content=content)
