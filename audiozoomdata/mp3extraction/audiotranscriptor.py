# Import audio from input directory and append to output.
# This script now accepts a file path on the command line and prints the transcription JSON or text to stdout.

import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python audiotranscriptor.py <audio-file>", file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]
    if not os.path.isfile(input_file):
        print(f"audio file not found: {input_file}", file=sys.stderr)
        sys.exit(2)

    url = "https://api.lemonfox.ai/v1/audio/transcriptions"
    headers = {
        "Authorization": f"Bearer {os.getenv('LEMONFOX_API_KEY')}"
    }

    with open(input_file, "rb") as f:
        files = {"file": f}
        data = {
            "language": "english",
            "response_format": "json"
        }
        response = requests.post(url, headers=headers, files=files, data=data)

    result = response.json()

    # print full JSON result for callers; also echo text if present
    print(result)
    if "text" in result:
        print(result["text"])

    # optionally write to output dir
    output_dir = os.getenv("OUTPUT_DIR") or os.path.join(os.path.dirname(__file__), "..", "output")
    os.makedirs(output_dir, exist_ok=True)
    try:
        base = os.path.basename(input_file)
        name = os.path.splitext(base)[0] + ".json"
        with open(os.path.join(output_dir, name), "w", encoding="utf8") as out:
            import json

            json.dump(result, out, indent=2)
    except Exception:
        pass
