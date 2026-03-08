import os
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

LEMONFOX_URL = "https://api.lemonfox.ai/v1/audio/transcriptions"


def transcribe_audio(file_path: str | Path) -> str:
    file_path = Path(file_path)
    if not file_path.is_file():
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    headers = {
        "Authorization": f"Bearer {os.getenv('LEMONFOX_API_KEY')}"
    }

    with open(file_path, "rb") as f:
        response = requests.post(
            LEMONFOX_URL,
            headers=headers,
            files={"file": f},
            data={"language": "english", "response_format": "json"},
        )

    result = response.json()
    return result.get("text", "")


def transcribe_and_append(file_path: str | Path, output_file: str | Path) -> str:
    text = transcribe_audio(file_path)
    if text:
        output_file = Path(output_file)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "a", encoding="utf-8") as out:
            out.write(text + "\n")
    return text
