from dataclasses import dataclass

from qdrant_client import QdrantClient, models

from rag.ingest import get_qdrant_client, get_embedding_model, COLLECTION_NAME, ensure_collection


@dataclass
class RetrievedChunk:
    content: str
    source: str
    source_id: str
    title: str
    url: str
    score: float


def retrieve(query: str, top_k: int = 10, source_filter: str | None = None) -> list[RetrievedChunk]:
    client = get_qdrant_client()
    embedder = get_embedding_model()
    ensure_collection(client)

    query_embedding = list(embedder.embed([query]))[0].tolist()

    search_filter = None
    if source_filter:
        search_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="source",
                    match=models.MatchValue(value=source_filter),
                )
            ]
        )

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_embedding,
        query_filter=search_filter,
        limit=top_k,
    )

    chunks: list[RetrievedChunk] = []
    for point in results.points:
        payload = point.payload or {}
        chunks.append(
            RetrievedChunk(
                content=str(payload.get("content", "")),
                source=str(payload.get("source", "")),
                source_id=str(payload.get("source_id", "")),
                title=str(payload.get("title", "")),
                url=str(payload.get("url", "")),
                score=point.score if point.score is not None else 0.0,
            )
        )

    return chunks
