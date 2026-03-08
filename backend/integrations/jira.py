import asyncio
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

JIRA_DOMAIN = os.getenv("JIRA_DOMAIN")


async def _request_with_retry(client: httpx.AsyncClient, url: str, headers: dict, max_retries: int = 4) -> httpx.Response:
    for attempt in range(max_retries):
        resp = await client.get(url, headers=headers)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("retry-after", "1"))
            await asyncio.sleep(retry_after)
            continue
        return resp
    return resp


async def fetch_all_jira_issues(project_key: str, access_token: str) -> list[dict]:
    max_results = 5000
    all_issues = []
    next_page_token = None
    fields = ["summary", "description", "status", "assignee", "created", "updated"]
    expand = ["names", "schema", "operations", "changelog"]

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient() as client:
        while True:
            params = {
                "jql": f'project = "{project_key}" ORDER BY created DESC',
                "maxResults": str(max_results),
                "fields": ",".join(fields),
                "expand": ",".join(expand),
            }
            if next_page_token:
                params["nextPageToken"] = next_page_token

            resp = await _request_with_retry(
                client,
                f"https://{JIRA_DOMAIN}/rest/api/3/search/jql",
                headers,
            )
            # httpx passes params differently; build URL manually
            url = f"https://{JIRA_DOMAIN}/rest/api/3/search/jql"
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()

            data = resp.json()
            issues = data.get("issues", [])

            for issue in issues:
                comment_resp = await _request_with_retry(
                    client,
                    f"https://{JIRA_DOMAIN}/rest/api/3/issue/{issue['key']}/comment",
                    headers,
                )
                if comment_resp.status_code == 200:
                    comment_data = comment_resp.json()
                    issue["comments"] = comment_data.get("comments", [])
                else:
                    issue["comments"] = []

            all_issues.extend(issues)

            next_page_token = data.get("nextPageToken")
            if not next_page_token:
                break

    return all_issues
