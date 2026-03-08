import asyncio
from typing import Any

import httpx

from settings import settings


async def _request_with_retry(client: httpx.AsyncClient, url: str, headers: dict[str, str], max_retries: int = 4) -> httpx.Response:
    resp: httpx.Response | None = None
    for _attempt in range(max_retries):
        resp = await client.get(url, headers=headers)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("retry-after", "1"))
            await asyncio.sleep(retry_after)
            continue
        return resp
    if resp is None:
        raise RuntimeError("No response after retries")
    return resp


async def fetch_all_jira_issues(project_key: str, access_token: str) -> list[dict[str, Any]]:
    max_results = 5000
    all_issues: list[dict[str, Any]] = []
    next_page_token: str | None = None
    fields = ["summary", "description", "status", "assignee", "created", "updated"]
    expand = ["names", "schema", "operations", "changelog"]

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient() as client:
        while True:
            params: dict[str, str] = {
                "jql": f'project = "{project_key}" ORDER BY created DESC',
                "maxResults": str(max_results),
                "fields": ",".join(fields),
                "expand": ",".join(expand),
            }
            if next_page_token:
                params["nextPageToken"] = next_page_token

            url = f"https://{settings.JIRA_DOMAIN}/rest/api/3/search/jql"
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()

            data: dict[str, Any] = resp.json()
            issues: list[dict[str, Any]] = data.get("issues", [])

            for issue in issues:
                comment_resp = await _request_with_retry(
                    client,
                    f"https://{settings.JIRA_DOMAIN}/rest/api/3/issue/{issue['key']}/comment",
                    headers,
                )
                if comment_resp.status_code == 200:
                    comment_data: dict[str, Any] = comment_resp.json()
                    issue["comments"] = comment_data.get("comments", [])
                else:
                    issue["comments"] = []

            all_issues.extend(issues)

            next_page_token = data.get("nextPageToken")
            if not next_page_token:
                break

    return all_issues
