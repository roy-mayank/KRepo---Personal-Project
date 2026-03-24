from typing import Any, AsyncIterator

import httpx

from .base import BaseIntegration, Document
from .rate_limiter import AsyncRateLimiter

NOTION_API_VERSION = "2022-06-28"


class NotionIntegration(BaseIntegration):
    DESCRIPTION = "Notion pages, databases, and wiki content"

    def __init__(self, access_token: str):
        self.access_token = access_token
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Notion-Version": NOTION_API_VERSION,
            "Content-Type": "application/json",
        }
        self._limiter = AsyncRateLimiter(rate=3, period=1.0)

    async def fetch_documents(self) -> AsyncIterator[Document]:
        async with httpx.AsyncClient(timeout=30) as client:
            async for item in self._search_all(client):
                obj_type = item.get("object")
                if obj_type == "page":
                    doc = await self._process_page(client, item)
                    if doc:
                        yield doc
                elif obj_type == "database":
                    async for doc in self._process_database(client, item):
                        yield doc

    # ------------------------------------------------------------------
    # Search: paginated fetch of all accessible pages & databases
    # ------------------------------------------------------------------

    async def _search_all(self, client: httpx.AsyncClient) -> AsyncIterator[dict]:
        start_cursor: str | None = None
        while True:
            await self._limiter.acquire()
            body: dict[str, Any] = {"page_size": 100}
            if start_cursor:
                body["start_cursor"] = start_cursor
            resp = await client.post(
                "https://api.notion.com/v1/search",
                headers=self._headers,
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
            for result in data.get("results", []):
                yield result
            if not data.get("has_more"):
                break
            start_cursor = data.get("next_cursor")

    # ------------------------------------------------------------------
    # Pages
    # ------------------------------------------------------------------

    async def _process_page(self, client: httpx.AsyncClient, page: dict) -> Document | None:
        title = _extract_page_title(page)
        page_id = page["id"]
        url = page.get("url", "")

        content = await self._get_block_children_text(client, page_id)
        if not content.strip():
            return None

        return Document(
            source="notion",
            source_id=f"notion:page:{page_id}",
            title=title,
            content=content,
            url=url,
            metadata={
                "type": "page",
                "last_edited": page.get("last_edited_time", ""),
            },
        )

    # ------------------------------------------------------------------
    # Databases: ingest the DB description + each row as a document
    # ------------------------------------------------------------------

    async def _process_database(self, client: httpx.AsyncClient, db: dict) -> AsyncIterator[Document]:
        db_id = db["id"]
        db_title = _extract_title_from_rich_text(db.get("title", []))
        db_url = db.get("url", "")
        description = _extract_rich_text(db.get("description", []))

        if db_title or description:
            yield Document(
                source="notion",
                source_id=f"notion:db:{db_id}",
                title=db_title or "Untitled Database",
                content=f"# {db_title}\n\n{description}" if description else f"# {db_title}",
                url=db_url,
                metadata={"type": "database"},
            )

        # Query all rows
        start_cursor: str | None = None
        while True:
            await self._limiter.acquire()
            body: dict[str, Any] = {"page_size": 100}
            if start_cursor:
                body["start_cursor"] = start_cursor
            resp = await client.post(
                f"https://api.notion.com/v1/databases/{db_id}/query",
                headers=self._headers,
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

            for row in data.get("results", []):
                doc = self._process_database_row(row, db_title, db_url)
                if doc:
                    yield doc

            if not data.get("has_more"):
                break
            start_cursor = data.get("next_cursor")

    def _process_database_row(self, row: dict, db_title: str, db_url: str) -> Document | None:
        row_id = row["id"]
        props = row.get("properties", {})
        row_title = ""
        parts: list[str] = []

        for prop_name, prop_value in props.items():
            text = _extract_property_value(prop_value)
            if not text:
                continue
            # Use the title property as the document title
            if prop_value.get("type") == "title":
                row_title = text
            parts.append(f"{prop_name}: {text}")

        content = "\n".join(parts)
        if not content.strip():
            return None

        return Document(
            source="notion",
            source_id=f"notion:row:{row_id}",
            title=row_title or "Untitled Row",
            content=content,
            url=row.get("url", db_url),
            metadata={
                "type": "database_row",
                "database": db_title,
                "last_edited": row.get("last_edited_time", ""),
            },
        )

    # ------------------------------------------------------------------
    # Block tree → plain text
    # ------------------------------------------------------------------

    async def _get_block_children_text(self, client: httpx.AsyncClient, block_id: str, depth: int = 0) -> str:
        if depth > 5:
            return ""
        parts: list[str] = []
        start_cursor: str | None = None
        list_counter = 0

        while True:
            await self._limiter.acquire()
            params: dict[str, Any] = {"page_size": 100}
            if start_cursor:
                params["start_cursor"] = start_cursor
            resp = await client.get(
                f"https://api.notion.com/v1/blocks/{block_id}/children",
                headers=self._headers,
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()

            for block in data.get("results", []):
                block_type = block.get("type", "")

                # Track numbered list counter
                if block_type == "numbered_list_item":
                    list_counter += 1
                else:
                    list_counter = 0

                text = _block_to_text(block, list_counter)
                if text:
                    parts.append(text)

                # Recurse into children
                if block.get("has_children"):
                    child_text = await self._get_block_children_text(client, block["id"], depth + 1)
                    if child_text:
                        # Indent child content
                        indented = "\n".join(f"  {line}" for line in child_text.splitlines())
                        parts.append(indented)

            if not data.get("has_more"):
                break
            start_cursor = data.get("next_cursor")

        return "\n".join(parts)


# ======================================================================
# Pure functions: block/property → text conversion
# ======================================================================


def _extract_rich_text(rich_text_array: list[dict]) -> str:
    return "".join(item.get("plain_text", "") for item in rich_text_array)


def _extract_title_from_rich_text(rich_text_array: list[dict]) -> str:
    return _extract_rich_text(rich_text_array).strip()


def _extract_page_title(page: dict) -> str:
    props = page.get("properties", {})
    for prop in props.values():
        if prop.get("type") == "title":
            return _extract_rich_text(prop.get("title", []))
    return "Untitled"


def _block_to_text(block: dict, list_counter: int = 0) -> str:
    block_type = block.get("type", "")
    block_data = block.get(block_type, {})

    if block_type in ("paragraph", "callout", "quote", "toggle"):
        text = _extract_rich_text(block_data.get("rich_text", []))
        if block_type == "quote":
            return f"> {text}"
        if block_type == "callout":
            icon = block_data.get("icon", {}).get("emoji", "")
            return f"{icon} {text}" if icon else text
        return text

    if block_type == "heading_1":
        return f"# {_extract_rich_text(block_data.get('rich_text', []))}"
    if block_type == "heading_2":
        return f"## {_extract_rich_text(block_data.get('rich_text', []))}"
    if block_type == "heading_3":
        return f"### {_extract_rich_text(block_data.get('rich_text', []))}"

    if block_type == "bulleted_list_item":
        return f"- {_extract_rich_text(block_data.get('rich_text', []))}"
    if block_type == "numbered_list_item":
        return f"{list_counter}. {_extract_rich_text(block_data.get('rich_text', []))}"
    if block_type == "to_do":
        checked = "x" if block_data.get("checked") else " "
        return f"[{checked}] {_extract_rich_text(block_data.get('rich_text', []))}"

    if block_type == "code":
        lang = block_data.get("language", "")
        code = _extract_rich_text(block_data.get("rich_text", []))
        return f"```{lang}\n{code}\n```"

    if block_type == "equation":
        return block_data.get("expression", "")

    if block_type == "divider":
        return "---"

    if block_type == "image":
        caption = _extract_rich_text(block_data.get("caption", []))
        return f"[Image: {caption}]" if caption else "[Image]"

    if block_type in ("file", "pdf"):
        caption = _extract_rich_text(block_data.get("caption", []))
        return f"[File: {caption}]" if caption else "[File]"

    if block_type == "bookmark":
        url = block_data.get("url", "")
        return f"[Bookmark: {url}]"

    if block_type == "embed":
        url = block_data.get("url", "")
        return f"[Embed: {url}]"

    if block_type == "table_row":
        cells = block_data.get("cells", [])
        row_text = " | ".join(_extract_rich_text(cell) for cell in cells)
        return f"| {row_text} |"

    if block_type == "child_page":
        return f"[Page: {block_data.get('title', '')}]"
    if block_type == "child_database":
        return f"[Database: {block_data.get('title', '')}]"

    # Unsupported block types — skip silently
    return ""


def _extract_property_value(prop: dict) -> str:
    prop_type = prop.get("type", "")

    if prop_type == "title":
        return _extract_rich_text(prop.get("title", []))
    if prop_type == "rich_text":
        return _extract_rich_text(prop.get("rich_text", []))
    if prop_type == "number":
        val = prop.get("number")
        return str(val) if val is not None else ""
    if prop_type == "select":
        sel = prop.get("select")
        return sel.get("name", "") if sel else ""
    if prop_type == "multi_select":
        return ", ".join(s.get("name", "") for s in prop.get("multi_select", []))
    if prop_type == "date":
        date = prop.get("date")
        if not date:
            return ""
        start = date.get("start", "")
        end = date.get("end", "")
        return f"{start} to {end}" if end else start
    if prop_type == "checkbox":
        return "Yes" if prop.get("checkbox") else "No"
    if prop_type == "url":
        return prop.get("url", "") or ""
    if prop_type == "email":
        return prop.get("email", "") or ""
    if prop_type == "phone_number":
        return prop.get("phone_number", "") or ""
    if prop_type == "people":
        return ", ".join(p.get("name", "") for p in prop.get("people", []))
    if prop_type == "files":
        return ", ".join(f.get("name", "") for f in prop.get("files", []))
    if prop_type == "status":
        status = prop.get("status")
        return status.get("name", "") if status else ""
    if prop_type == "formula":
        formula = prop.get("formula", {})
        f_type = formula.get("type", "")
        return str(formula.get(f_type, ""))
    if prop_type == "relation":
        return ", ".join(r.get("id", "") for r in prop.get("relation", []))
    if prop_type == "rollup":
        rollup = prop.get("rollup", {})
        r_type = rollup.get("type", "")
        return str(rollup.get(r_type, ""))
    if prop_type == "created_time":
        return prop.get("created_time", "")
    if prop_type == "last_edited_time":
        return prop.get("last_edited_time", "")
    if prop_type == "created_by":
        return prop.get("created_by", {}).get("name", "")
    if prop_type == "last_edited_by":
        return prop.get("last_edited_by", {}).get("name", "")

    return ""
