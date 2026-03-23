from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rag.ingest import get_embedding_model
from rag.models import DocumentChunk


@dataclass
class RetrievedChunk:
    content: str
    source: str
    source_id: str
    title: str
    url: str
    score: float


async def retrieve(
    session: AsyncSession,
    query: str,
    tenant_id: str,
    top_k: int = 10,
    source_filter: str | None = None,
) -> list[RetrievedChunk]:
    embedder = get_embedding_model()
    query_embedding = list(embedder.embed([query]))[0].tolist()

    filters = [DocumentChunk.tenant_id == tenant_id]
    if source_filter:
        filters.append(DocumentChunk.source == source_filter)

    # Cosine distance: lower = more similar. Score = 1 - distance.
    distance = DocumentChunk.embedding.cosine_distance(query_embedding)

    stmt = (
        select(
            DocumentChunk.content,
            DocumentChunk.source,
            DocumentChunk.source_id,
            DocumentChunk.title,
            DocumentChunk.url,
            (1 - distance).label("score"),
        )
        .where(*filters)
        .order_by(distance)
        .limit(top_k)
    )

    result = await session.execute(stmt)
    rows = result.all()

    return [
        RetrievedChunk(
            content=row.content,
            source=row.source,
            source_id=row.source_id,
            title=row.title,
            url=row.url,
            score=float(row.score),
        )
        for row in rows
    ]
