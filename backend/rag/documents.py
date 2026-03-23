import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from pypdf import PdfReader
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user, require_role
from auth.models import Role, User
from db import get_db
from integrations.base import Document
from rag.ingest import ingest_document

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
    db: AsyncSession = Depends(get_db),
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

    count = await ingest_document(db, doc, tenant_id)

    return UploadResponse(filename=filename, chunks_ingested=count, source_id=source_id)


@router.get("/")
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentListResponse:
    from rag.models import DocumentChunk

    tenant_id = str(current_user.tenant_id)

    result = await db.execute(
        select(
            DocumentChunk.source_id,
            DocumentChunk.title,
            DocumentChunk.source,
        )
        .where(DocumentChunk.tenant_id == tenant_id)
        .distinct(DocumentChunk.source_id)
    )

    return DocumentListResponse(
        documents=[
            DocumentListItem(source_id=row.source_id, title=row.title, source=row.source) for row in result.all()
        ]
    )


@router.delete("/{source_id:path}")
async def delete_document(
    source_id: str,
    current_user: User = Depends(require_role(Role.admin, Role.member)),
    db: AsyncSession = Depends(get_db),
) -> DeleteResponse:
    from rag.models import DocumentChunk

    tenant_id = str(current_user.tenant_id)

    await db.execute(
        delete(DocumentChunk).where(
            DocumentChunk.tenant_id == tenant_id,
            DocumentChunk.source_id == source_id,
        )
    )
    await db.commit()

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
