from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from pydantic import BaseModel

from auth.dependencies import get_current_user, require_role
from auth.models import Role, User
from integrations import available, get_integration
from rag.ingest import ingest_integration

router = APIRouter()

# Keyed as "{tenant_id}:{source}" to isolate status per tenant
_ingest_status: dict[str, str] = {}


class IngestResponse(BaseModel):
    message: str


class IngestStatusResponse(BaseModel):
    status: dict[str, str]


async def _run_ingestion(source: str, tenant_id: str) -> None:
    key = f"{tenant_id}:{source}"
    _ingest_status[key] = "running"
    try:
        cls = get_integration(source)
        if cls is None:
            _ingest_status[key] = f"error: unknown source '{source}'"
            return
        integration = cls()
        count = await ingest_integration(integration, tenant_id)
        _ingest_status[key] = f"completed: {count} chunks ingested"
    except Exception as e:
        _ingest_status[key] = f"error: {e}"


@router.post("/ingest/{source}")
async def ingest(
    source: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(Role.admin, Role.member)),
) -> IngestResponse:
    tenant_id = str(current_user.tenant_id)
    background_tasks.add_task(_run_ingestion, source, tenant_id)
    _ingest_status[f"{tenant_id}:{source}"] = "started"
    return IngestResponse(message=f"Ingestion started for {source}")


@router.get("/ingest/status")
async def ingest_status(
    current_user: User = Depends(get_current_user),
) -> IngestStatusResponse:
    tenant_id = str(current_user.tenant_id)
    tenant_status = {
        key.split(":", 1)[1]: val for key, val in _ingest_status.items() if key.startswith(f"{tenant_id}:")
    }
    return IngestStatusResponse(status=tenant_status)


@router.get("/integrations")
async def list_integrations(
    _: User = Depends(get_current_user),
) -> dict[str, str]:
    return available()


@router.post("/ingest/audio")
async def ingest_audio(
    file: UploadFile = File(...),
    max_authorization_level: int | None = Form(None),
    current_user: User = Depends(require_role(Role.admin, Role.member)),
) -> IngestResponse:
    from ..parsing.ingest import ingest_audio_transcript

    try:
        contents = await file.read()
        import tempfile
        from pathlib import Path

        filename = file.filename or "temp_audio"
        tmp = Path(tempfile.gettempdir()) / filename
        tmp.write_bytes(contents)
        count = ingest_audio_transcript(tmp, max_authorization_level=max_authorization_level)
        return IngestResponse(message=f"audio ingested: {count} chunks")
    except Exception as e:
        return IngestResponse(message=f"error: {e}")
