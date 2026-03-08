from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client import QdrantClient, models
from fastembed import TextEmbedding

from integrations.base import BaseIntegration, Document
from settings import settings

COLLECTION_NAME = "krepo"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
)


def get_qdrant_client() -> QdrantClient:
    return QdrantClient(path=settings.QDRANT_PATH)


def get_embedding_model() -> TextEmbedding:
    return TextEmbedding(model_name=EMBEDDING_MODEL)


def ensure_collection(client: QdrantClient, embedding_dim: int = 384) -> None:
    collections = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=embedding_dim,
                distance=models.Distance.COSINE,
            ),
        )


async def ingest_integration(integration: BaseIntegration) -> int:
    client = get_qdrant_client()
    embedder = get_embedding_model()
    ensure_collection(client)

    count = 0
    async for doc in integration.fetch_documents():
        count += _ingest_document(client, embedder, doc)

    return count


def _ingest_document(client: QdrantClient, embedder: TextEmbedding, doc: Document) -> int:
    if not doc.content.strip():
        return 0

    chunks = _splitter.split_text(doc.content)
    if not chunks:
        return 0

    embeddings = list(embedder.embed(chunks))

    points = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        point_id = _make_point_id(doc.source, doc.source_id, i)
        points.append(
            models.PointStruct(
                id=point_id,
                vector=embedding.tolist(),
                payload={
                    "source": doc.source,
                    "source_id": doc.source_id,
                    "title": doc.title,
                    "url": doc.url,
                    "chunk_index": i,
                    "content": chunk,
                    **doc.metadata,
                },
            )
        )

    client.upsert(collection_name=COLLECTION_NAME, points=points)
    return len(points)


def _make_point_id(source: str, source_id: str, chunk_index: int) -> str:
    import hashlib
    raw = f"{source}:{source_id}:{chunk_index}"
    return hashlib.md5(raw.encode()).hexdigest()  # noqa: S324
