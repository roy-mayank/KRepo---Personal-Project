import io
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel
from pypdf import PdfReader

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
async def upload_document(file: UploadFile) -> UploadResponse:
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
    count = _ingest_document(client, embedder, doc)

    return UploadResponse(filename=filename, chunks_ingested=count, source_id=source_id)


@router.get("/")
async def list_documents() -> DocumentListResponse:
    client = get_qdrant_client()
    ensure_collection(client)

    results = client.scroll(
        collection_name=COLLECTION_NAME,
        scroll_filter=None,
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
async def delete_document(source_id: str) -> DeleteResponse:
    from qdrant_client.models import FieldCondition, Filter, MatchValue

    client = get_qdrant_client()
    ensure_collection(client)

    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=Filter(must=[FieldCondition(key="source_id", match=MatchValue(value=source_id))]),
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
