# pyright: reportMissingImports=false
from fastembed import TextEmbedding  # type: ignore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from integrations.base import BaseIntegration, Document
from rag.models import DocumentChunk

EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
)

_embedder: TextEmbedding | None = None


def get_embedding_model() -> TextEmbedding:
    global _embedder
    if _embedder is None:
        _embedder = TextEmbedding(model_name=EMBEDDING_MODEL)
    return _embedder


async def ingest_integration(integration: BaseIntegration, tenant_id: str) -> int:
    from db import _session_factory

    count = 0
    async for doc in integration.fetch_documents():
        async with _session_factory() as session:
            count += await ingest_document(session, doc, tenant_id)
    return count


async def ingest_document(session: AsyncSession, doc: Document, tenant_id: str) -> int:
    if not doc.content.strip():
        return 0

    chunks = _splitter.split_text(doc.content)
    if not chunks:
        return 0

    embedder = get_embedding_model()
    embeddings = list(embedder.embed(chunks))

    # Upsert: delete existing chunks for this source_id + tenant, then insert
    await session.execute(
        delete(DocumentChunk).where(
            DocumentChunk.tenant_id == tenant_id,
            DocumentChunk.source_id == doc.source_id,
        )
    )

    for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
        session.add(
            DocumentChunk(
                tenant_id=tenant_id,
                source=doc.source,
                source_id=doc.source_id,
                title=doc.title,
                url=doc.url,
                chunk_index=i,
                content=chunk_text,
                embedding=embedding.tolist(),
                metadata_=doc.metadata,
            )
        )

    await session.commit()
    return len(chunks)
