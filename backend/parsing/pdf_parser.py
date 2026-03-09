import asyncio
from pathlib import Path
from typing import Any

from llama_cloud import AsyncLlamaCloud

from ..settings import settings

llama_cloud_client = AsyncLlamaCloud(
    api_key=settings.LLAMA_CLOUD_API_KEY,
)


async def parse_single_file(file_path: Path, semaphore: asyncio.Semaphore) -> dict[str, Any]:
    async with semaphore:
        try:
            file_obj = await llama_cloud_client.files.create(
                file=str(file_path),
                purpose="parse",
                external_file_id=str(file_path),
            )

            result = await llama_cloud_client.parsing.parse(
                tier="cost_effective",
                version="latest",
                file_id=file_obj.id,
                expand=["text", "metadata"],
            )

            return {
                "file": file_path.name,
                "status": "success",
                "result": result,
                "pages": len(result.items.pages) if result.items and result.items.pages else 0,
            }
        except Exception as e:
            return {
                "file": file_path.name,
                "status": "error",
                "error": str(e),
            }


async def parse_all_pdfs(input_dir: str | Path, max_concurrent: int = 2) -> list[dict[str, Any]]:
    input_path = Path(input_dir)
    pdf_files = list(input_path.glob("*.pdf"))
    semaphore = asyncio.Semaphore(max_concurrent)

    tasks = [parse_single_file(pdf, semaphore) for pdf in pdf_files]
    return list(await asyncio.gather(*tasks))
