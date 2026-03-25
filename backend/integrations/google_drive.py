import csv
import io
from typing import AsyncIterator

import httpx

from .base import BaseIntegration, Document
from .rate_limiter import AsyncRateLimiter

DRIVE_API = "https://www.googleapis.com/drive/v3"

# Google Workspace MIME types → export format
_EXPORT_MIME: dict[str, str] = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
}

# Plain files we can download directly
_DOWNLOADABLE_MIME: set[str] = {
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "text/html",
}

# Human-readable type names
_TYPE_LABELS: dict[str, str] = {
    "application/vnd.google-apps.document": "Google Doc",
    "application/vnd.google-apps.spreadsheet": "Google Sheet",
    "application/vnd.google-apps.presentation": "Google Slides",
}

_ALL_SUPPORTED = set(_EXPORT_MIME.keys()) | _DOWNLOADABLE_MIME

# Drive query: only fetch files with supported MIME types
_MIME_QUERY = " or ".join(f"mimeType='{m}'" for m in _ALL_SUPPORTED)
_LIST_QUERY = f"trashed=false and ({_MIME_QUERY})"


class GoogleDriveIntegration(BaseIntegration):
    DESCRIPTION = "Google Drive documents, sheets, and presentations"

    def __init__(self, access_token: str):
        self.access_token = access_token
        self._headers = {"Authorization": f"Bearer {access_token}"}
        self._limiter = AsyncRateLimiter(rate=8, period=1.0)

    async def fetch_documents(self) -> AsyncIterator[Document]:
        async with httpx.AsyncClient(timeout=60) as client:
            async for file_meta in self._list_files(client):
                doc = await self._fetch_file_content(client, file_meta)
                if doc:
                    yield doc

    # ------------------------------------------------------------------
    # List all supported files via Drive API (paginated)
    # ------------------------------------------------------------------

    async def _list_files(self, client: httpx.AsyncClient) -> AsyncIterator[dict]:
        page_token: str | None = None
        while True:
            await self._limiter.acquire()
            params: dict[str, str] = {
                "q": _LIST_QUERY,
                "fields": "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)",
                "pageSize": "100",
                "includeItemsFromAllDrives": "true",
                "supportsAllDrives": "true",
            }
            if page_token:
                params["pageToken"] = page_token

            resp = await client.get(f"{DRIVE_API}/files", headers=self._headers, params=params)
            resp.raise_for_status()
            data = resp.json()

            for f in data.get("files", []):
                yield f

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    # ------------------------------------------------------------------
    # Fetch content of a single file
    # ------------------------------------------------------------------

    async def _fetch_file_content(self, client: httpx.AsyncClient, file_meta: dict) -> Document | None:
        file_id: str = file_meta["id"]
        name: str = file_meta.get("name", "Untitled")
        mime: str = file_meta.get("mimeType", "")
        url: str = file_meta.get("webViewLink", "")
        modified: str = file_meta.get("modifiedTime", "")
        doc_type: str = _TYPE_LABELS.get(mime, mime)

        content: str | None = None

        if mime in _EXPORT_MIME:
            content = await self._export_file(client, file_id, _EXPORT_MIME[mime], mime)
        elif mime in _DOWNLOADABLE_MIME:
            content = await self._download_file(client, file_id)

        if not content or not content.strip():
            return None

        # For CSV spreadsheets, convert to a more readable format
        if _EXPORT_MIME.get(mime) == "text/csv":
            content = _csv_to_text(content, name)

        return Document(
            source="google_drive",
            source_id=f"google_drive:{file_id}",
            title=name,
            content=content,
            url=url,
            metadata={
                "type": doc_type,
                "mime_type": mime,
                "last_modified": modified,
            },
        )

    async def _export_file(
        self, client: httpx.AsyncClient, file_id: str, export_mime: str, original_mime: str
    ) -> str | None:
        await self._limiter.acquire()
        resp = await client.get(
            f"{DRIVE_API}/files/{file_id}/export",
            headers=self._headers,
            params={"mimeType": export_mime},
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.text

    async def _download_file(self, client: httpx.AsyncClient, file_id: str) -> str | None:
        await self._limiter.acquire()
        resp = await client.get(
            f"{DRIVE_API}/files/{file_id}",
            headers=self._headers,
            params={"alt": "media"},
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.text


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def _csv_to_text(csv_content: str, sheet_name: str) -> str:
    """Convert CSV content to a readable markdown-style table."""
    try:
        reader = csv.reader(io.StringIO(csv_content))
        rows = list(reader)
    except Exception:
        return csv_content

    if not rows:
        return csv_content

    lines: list[str] = [f"# {sheet_name}", ""]
    header = rows[0]
    lines.append(" | ".join(header))
    lines.append(" | ".join(["---"] * len(header)))
    for row in rows[1:]:
        lines.append(" | ".join(row))

    return "\n".join(lines)
