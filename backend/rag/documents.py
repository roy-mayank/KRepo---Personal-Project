import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from pypdf import PdfReader
from qdrant_client.models import FieldCondition, Filter, MatchValue

from auth.dependencies import get_current_user, require_role
from auth.models import Role, User
from integrations.base import Document
from rag.ingest import COLLECTION_NAME, _ingest_document, ensure_collection, get_embedding_model, get_qdrant_client

router = APIRouter(prefix="/documents")


class UploadResponse(BaseModel):
    filename: str
    chunks_ingested: int
    source_id: str


class DocumentListItem(BaseModel):
    source_id: str
    title: str
    source: str


class DocumentListResponse(BaseModel):
    documents: list[DocumentListItem]


class DeleteResponse(BaseModel):
    deleted: bool
    source_id: str


SUPPORTED_EXTENSIONS = {".txt", ".md", ".pdf", ".csv", ".json"}


@router.post("/upload")
async def upload_document(
    file: UploadFile,
    current_user: User = Depends(require_role(Role.admin, Role.member)),
) -> UploadResponse:
    filename = file.filename or "untitled"
    ext = _get_extension(filename)

    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
        )

    content_bytes = await file.read()

    if ext == ".pdf":
        text = _extract_pdf_text(content_bytes)
    else:
        text = content_bytes.decode("utf-8", errors="replace")

    if not text.strip():
        raise HTTPException(status_code=400, detail="File is empty or could not be parsed.")

    source_id = f"upload:{filename}:{datetime.now(timezone.utc).isoformat()}"
    tenant_id = str(current_user.tenant_id)

    doc = Document(
        source="upload",
        source_id=source_id,
        title=filename,
        content=text,
        url="",
        metadata={"filename": filename, "file_type": ext},
    )

    client = get_qdrant_client()
    embedder = get_embedding_model()
    ensure_collection(client)
    count = _ingest_document(client, embedder, doc, tenant_id)

    return UploadResponse(filename=filename, chunks_ingested=count, source_id=source_id)


@router.get("/")
async def list_documents(
    current_user: User = Depends(get_current_user),
) -> DocumentListResponse:
    tenant_id = str(current_user.tenant_id)
    client = get_qdrant_client()
    ensure_collection(client)

    results = client.scroll(
        collection_name=COLLECTION_NAME,
        scroll_filter=Filter(must=[FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))]),
        limit=1000,
        with_payload=True,
        with_vectors=False,
    )

    seen: dict[str, DocumentListItem] = {}
    for point in results[0]:
        payload = point.payload or {}
        sid = str(payload.get("source_id", ""))
        if sid and sid not in seen:
            seen[sid] = DocumentListItem(
                source_id=sid,
                title=str(payload.get("title", "")),
                source=str(payload.get("source", "")),
            )

    return DocumentListResponse(documents=list(seen.values()))


@router.delete("/{source_id:path}")
async def delete_document(
    source_id: str,
    current_user: User = Depends(require_role(Role.admin, Role.member)),
) -> DeleteResponse:
    tenant_id = str(current_user.tenant_id)
    client = get_qdrant_client()
    ensure_collection(client)

    # Require both tenant_id and source_id to match — prevents cross-tenant deletion
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=Filter(
            must=[
                FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id)),
                FieldCondition(key="source_id", match=MatchValue(value=source_id)),
            ]
        ),
    )

    return DeleteResponse(deleted=True, source_id=source_id)


def _get_extension(filename: str) -> str:
    dot_idx = filename.rfind(".")
    if dot_idx == -1:
        return ""
    return filename[dot_idx:].lower()


def _extract_pdf_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages)
