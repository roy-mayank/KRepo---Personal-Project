from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from ..integrations.jira import JiraIntegration
from .ingest import ingest_integration

router = APIRouter()

_ingest_status: dict[str, str] = {}


class IngestResponse(BaseModel):
    message: str


class IngestStatusResponse(BaseModel):
    status: dict[str, str]


async def _run_ingestion(source: str) -> None:
    _ingest_status[source] = "running"
    try:
        if source == "jira":
            integration = JiraIntegration()
        else:
            _ingest_status[source] = f"error: unknown source '{source}'"
            return

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
