from fastapi import APIRouter, BackgroundTasks, File, Form, UploadFile
from pydantic import BaseModel

from integrations import available, get_integration
from rag.ingest import ingest_integration

router = APIRouter()

_ingest_status: dict[str, str] = {}


class IngestResponse(BaseModel):
    message: str


class IngestStatusResponse(BaseModel):
    status: dict[str, str]


async def _run_ingestion(source: str) -> None:
    _ingest_status[source] = "running"
    try:
        cls = get_integration(source)
        if cls is None:
            _ingest_status[source] = f"error: unknown source '{source}'"
            return

        integration = cls()
        count = await ingest_integration(integration)
        _ingest_status[source] = f"completed: {count} chunks ingested"
    except Exception as e:
        _ingest_status[source] = f"error: {e}"


@router.post("/ingest/{source}")
async def ingest(source: str, background_tasks: BackgroundTasks) -> IngestResponse:
    background_tasks.add_task(_run_ingestion, source)
    _ingest_status[source] = "started"
    return IngestResponse(message=f"Ingestion started for {source}")


@router.get("/ingest/status")
async def ingest_status() -> IngestStatusResponse:
    return IngestStatusResponse(status=_ingest_status)


@router.get("/integrations")
async def list_integrations() -> dict[str, str]:
    return available()


@router.post("/ingest/audio")
async def ingest_audio(
    file: UploadFile = File(...),
    max_authorization_level: int | None = Form(None),
) -> IngestResponse:

    from ..parsing.ingest import ingest_audio_transcript

    try:
        contents = await file.read()
        # write to temp file on disk to satisfy the existing helper
        import tempfile
        from pathlib import Path

        filename = file.filename or "temp_audio"
        tmp = Path(tempfile.gettempdir()) / filename
        tmp.write_bytes(contents)
        count = ingest_audio_transcript(tmp, max_authorization_level=max_authorization_level)
        return IngestResponse(message=f"audio ingested: {count} chunks")
    except Exception as e:
        return IngestResponse(message=f"error: {e}")
