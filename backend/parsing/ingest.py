from __future__ import annotations

import re
from pathlib import Path
from typing import List

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


def _chunk_by_sentences(text: str, sentences_per_chunk: int = 3) -> List[str]:
    if not text:
        return []

    sentences = [s for s in _SENTENCE_RE.split(text.strip()) if s]
    return [" ".join(sentences[i : i + sentences_per_chunk]) for i in range(0, len(sentences), sentences_per_chunk)]


async def ingest_audio_transcript(
    file_path: str | Path,
    tenant_id: str,
    sentences_per_chunk: int = 3,
    max_authorization_level: int | str | None = None,
) -> int:
    from db import _session_factory

    from ..integrations.base import Document
    from ..rag.ingest import ingest_document
    from .audio_transcriber import transcribe_audio

    text = transcribe_audio(file_path)
    if not text:
        return 0

    chunks = _chunk_by_sentences(text, sentences_per_chunk)
    if not chunks:
        return 0

    source = "audio"
    source_id = str(Path(file_path))
    title = Path(file_path).name
    url = ""
    metadata: dict[str, str] = {}
    if max_authorization_level is not None:
        metadata["max_authorization_level"] = str(max_authorization_level)

    total = 0
    async with _session_factory() as session:
        for chunk in chunks:
            doc = Document(
                source=source,
                source_id=source_id,
                title=title,
                content=chunk,
                url=url,
                metadata=metadata,
            )
            total += await ingest_document(session, doc, tenant_id)
    return total
