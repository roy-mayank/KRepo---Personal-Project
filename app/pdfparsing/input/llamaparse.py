# Temporarily using llamaparse with the idea of shifting to huggingface at some point later?
# Not tested!!!

import asyncio
import os

from llama_cloud import AsyncLlamaCloud

# Not tested!!!
pdf_files = list(os.path.join(os.path.dirname(__file__), "..", "input").glob("*.pdf"))

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
            print(f"Starting parse: {file_path.name}")

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

            print(f"✓ Completed: {file_path.name} ({len(result.items.pages)} pages)")

            return {
                "file": file_path.name,
                "status": "success",
                "result": result,
                "pages": len(result.items.pages) if result.items.pages else 0,
            }
        except Exception as e:
            print(f"✗ Error parsing {file_path.name}: {str(e)}")
            return {
                "file": file_path.name,
                "status": "error",
                "error": str(e),
            }

# Create tasks for all files
tasks = [
    parse_single_file(pdf_file, semaphore)
    for pdf_file in pdf_files
]

results = await asyncio.gather(*tasks)