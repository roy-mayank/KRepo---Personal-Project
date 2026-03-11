from pathlib import Path
from typing import Any, List

# regex used for sentence splitting moved to parsing.ingest
import requests

from ..settings import settings
from .ingest import _chunk_by_sentences

LEMONFOX_URL = "https://api.lemonfox.ai/v1/audio/transcriptions"


def transcribe_audio(file_path: str | Path) -> str:
    file_path = Path(file_path)
    if not file_path.is_file():
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    headers = {"Authorization": f"Bearer {settings.LEMONFOX_API_KEY}"}

    with open(file_path, "rb") as f:
        response = requests.post(
            LEMONFOX_URL,
            headers=headers,
            files={"file": f},
            data={"language": "english", "response_format": "json"},
        )

    result: dict[str, Any] = response.json()
    return result.get("text", "")


def transcribe_audio_chunks(file_path: str | Path, sentences_per_chunk: int = 3) -> List[str]:

    text = transcribe_audio(file_path)
    if not text:
        return []
    return _chunk_by_sentences(text, sentences_per_chunk)


def transcribe_and_append_chunks(
    file_path: str | Path, output_file: str | Path, sentences_per_chunk: int = 3
) -> List[str]:
    chunks = transcribe_audio_chunks(file_path, sentences_per_chunk)
    if chunks:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "a", encoding="utf-8") as out:
            out.write("\n".join(chunks) + "\n")
    return chunks
