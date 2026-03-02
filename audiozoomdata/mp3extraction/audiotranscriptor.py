# Import audio from input directory and append to output. 
# idea is all of the audio content from zoom can be passed into this mega text file that basically just exists in the knowledge repo at all times

import os
import requests
from dotenv import load_dotenv

script_dir = os.path.dirname(__file__)
input_file = os.path.join(script_dir, "..", "input", "test.m4a")
load_dotenv()

if not os.path.isfile(input_file):
    raise FileNotFoundError(f"audio file not found: {input_file}")

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

output_dir = os.path.join(script_dir, "..", "output")
os.makedirs(output_dir, exist_ok=True)
output_file = os.path.join(output_dir, "alltranscriptions.txt")

if "text" in result:
    with open(output_file, "a", encoding="utf-8") as out:
        out.write(result["text"] + "\n")