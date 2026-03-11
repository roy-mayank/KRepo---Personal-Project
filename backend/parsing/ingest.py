from __future__ import annotations

import re
from pathlib import Path
from typing import List

from ..rag.ingest import (
    _ingest_document,
    ensure_collection,
    get_embedding_model,
    get_qdrant_client,
)

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


def _chunk_by_sentences(text: str, sentences_per_chunk: int = 3) -> List[str]:
    if not text:
        return []

    sentences = [s for s in _SENTENCE_RE.split(text.strip()) if s]
    return [" ".join(sentences[i : i + sentences_per_chunk]) for i in range(0, len(sentences), sentences_per_chunk)]


def ingest_audio_transcript(
    file_path: str | Path,
    sentences_per_chunk: int = 3,
    max_authorization_level: int | str | None = None,
) -> int:
    from ..integrations.base import Document
    from .audio_transcriber import transcribe_audio  # avoid circular import

    text = transcribe_audio(file_path)
    if not text:
        return 0

    chunks = _chunk_by_sentences(text, sentences_per_chunk)
    if not chunks:
        return 0

    client = get_qdrant_client()
    embedder = get_embedding_model()
    ensure_collection(client)

    source = "audio"
    source_id = str(Path(file_path))
    title = Path(file_path).name
    url = ""
    metadata: dict[str, str] = {}
    if max_authorization_level is not None:
        metadata["max_authorization_level"] = str(max_authorization_level)

    total = 0
    for chunk in chunks:
        doc = Document(
            source=source,
            source_id=source_id,
            title=title,
            content=chunk,
            url=url,
            metadata=metadata,
        )
        total += _ingest_document(client, embedder, doc)
    return total
