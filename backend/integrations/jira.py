import asyncio
from typing import Any, AsyncIterator

import httpx

from integrations.base import BaseIntegration, Document
from settings import settings


class JiraIntegration(BaseIntegration):
    def __init__(self, project_keys: list[str] | None = None, access_token: str | None = None):
        self.project_keys = project_keys or [k.strip() for k in settings.JIRA_PROJECT_KEYS.split(",") if k.strip()]
        self.access_token = access_token or settings.JIRA_ACCESS_TOKEN
        self.domain = settings.JIRA_DOMAIN
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    async def _request_with_retry(
        self,
        client: httpx.AsyncClient,
        url: str,
        params: dict[str, str] | None = None,
        max_retries: int = 4,
    ) -> httpx.Response:
        resp: httpx.Response | None = None
        for _attempt in range(max_retries):
            resp = await client.get(url, headers=self.headers, params=params)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("retry-after", "1"))
                await asyncio.sleep(retry_after)
                continue
            return resp
        if resp is None:
            raise RuntimeError("No response after retries")
        return resp

    async def fetch_documents(self) -> AsyncIterator[Document]:
        fields = ["summary", "description", "status", "assignee", "created", "updated"]
        expand = ["names", "schema", "operations", "changelog"]

        async with httpx.AsyncClient() as client:
            for project_key in self.project_keys:
                next_page_token: str | None = None

                while True:
                    params: dict[str, str] = {
                        "jql": f'project = "{project_key}" ORDER BY created DESC',
                        "maxResults": "100",
                        "fields": ",".join(fields),
                        "expand": ",".join(expand),
                    }
                    if next_page_token:
                        params["nextPageToken"] = next_page_token

                    resp = await self._request_with_retry(
                        client,
                        f"https://{self.domain}/rest/api/3/search/jql",
                        params=params,
                    )
                    resp.raise_for_status()

                    data: dict[str, Any] = resp.json()
                    issues: list[dict[str, Any]] = data.get("issues", [])

                    for issue in issues:
                        # Fetch comments
                        comment_resp = await self._request_with_retry(
                            client,
                            f"https://{self.domain}/rest/api/3/issue/{issue['key']}/comment",
                        )
                        comments: list[dict[str, Any]] = []
                        if comment_resp.status_code == 200:
                            comment_data: dict[str, Any] = comment_resp.json()
                            comments = comment_data.get("comments", [])

                        # Build content
                        description = self._extract_text(issue.get("fields", {}).get("description"))
                        comment_texts = [self._extract_text(c.get("body")) for c in comments]
                        content_parts = [description] + [t for t in comment_texts if t]
                        content = "\n\n".join(content_parts)

                        status = issue.get("fields", {}).get("status", {}).get("name", "")
                        assignee = issue.get("fields", {}).get("assignee", {})
                        assignee_name = assignee.get("displayName", "") if assignee else ""

                        yield Document(
                            source="jira",
                            source_id=issue["key"],
                            title=issue.get("fields", {}).get("summary", ""),
                            content=content,
                            url=f"https://{self.domain}/browse/{issue['key']}",
                            metadata={
                                "project": project_key,
                                "status": status,
                                "assignee": assignee_name,
                                "created": issue.get("fields", {}).get("created", ""),
                                "updated": issue.get("fields", {}).get("updated", ""),
                            },
                        )

                    next_page_token = data.get("nextPageToken")
                    if not next_page_token:
                        break

    def _extract_text(self, adf: Any) -> str:
        """Extract plain text from Atlassian Document Format."""
        if not adf or not isinstance(adf, dict):
            return ""
        parts: list[str] = []
        for node in adf.get("content", []):
            self._walk_adf(node, parts)
        return " ".join(parts)

    def _walk_adf(self, node: Any, parts: list[str]) -> None:
        if not isinstance(node, dict):
            return
        if node.get("type") == "text":
            text = node.get("text", "")
            if text:
                parts.append(text)
        for child in node.get("content", []):
            self._walk_adf(child, parts)
