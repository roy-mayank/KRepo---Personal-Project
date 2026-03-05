# Temporarily using llamaparse with the idea of shifting to huggingface at some point later?
# This script now accepts a path to a single PDF and prints JSON to stdout.

import asyncio
import os
import sys
import json

from llama_cloud import AsyncLlamaCloud

# Initialize parser
llama_cloud_client = AsyncLlamaCloud(
    api_key=os.getenv("LLAMA_CLOUD_API_KEY"),
)

# Create semaphore to limit concurrent requests
semaphore = asyncio.Semaphore(2)

# A helper function to parse a single file with semaphore
async def parse_single_file(
    file_path,
    semaphore,
):
    async with semaphore:
        try:
            print(f"Starting parse: {file_path}")

            file_obj = await llama_cloud_client.files.create(
                file=str(file_path),
                purpose="parse",
                external_file_id=str(file_path),
            )

            result = await llama_cloud_client.parsing.parse(
                tier="cost_effective", # Change later to "agentic" or "fast"
                version="latest",
                file_id=file_obj.id,
                expand=["text", "metadata"],
            )

            pages = len(result.items.pages) if result.items.pages else 0
            output = {
                "file": os.path.basename(file_path),
                "status": "success",
                "pages": pages,
                "result": {
                    # include only text and metadata to keep size reasonable
                    "text": result.items.text if hasattr(result.items, "text") else None,
                    "metadata": result.items.metadata if hasattr(result.items, "metadata") else None,
                },
            }
            # print the JSON to stdout for the calling process
            print(json.dumps(output))
            return output
        except Exception as e:
            print(f"✗ Error parsing {file_path}: {str(e)}")
            err = {
                "file": os.path.basename(file_path),
                "status": "error",
                "error": str(e),
            }
            print(json.dumps(err))
            return err


async def main():
    # accept a single file path via CLI argument
    if len(sys.argv) < 2:
        print("Usage: python llamaparse.py <path-to-pdf>", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.path.isfile(file_path):
        print(f"PDF not found: {file_path}", file=sys.stderr)
        sys.exit(2)

    res = await parse_single_file(file_path, semaphore)
    # optionally write result to output directory so we have records of what was parsed
    output_dir = os.getenv("OUTPUT_DIR") or os.path.join(os.path.dirname(__file__), "..", "output")
    os.makedirs(output_dir, exist_ok=True)
    try:
        out_name = os.path.basename(file_path) + ".json"
        with open(os.path.join(output_dir, out_name), "w", encoding="utf8") as out:
            json.dump(res, out, indent=2, default=str)
    except Exception:
        pass


if __name__ == "__main__":
    # run the async main
    asyncio.run(main())