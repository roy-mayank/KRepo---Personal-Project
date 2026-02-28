const fetch = require("node-fetch");

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function fetchAllJiraIssues(
  projectKey: string, // Have to fetch all relevant proj keys?
  accessToken: string,
): Promise<any[]> {
  let nextPageToken: string | undefined = undefined;
  const maxResults = 5000;
  const allIssues: any[] = [];
  const fields = [
    "summary",
    "description",
    "status",
    "assignee",
    "created",
    "updated",
  ];
  const expand = ["names", "schema", "operations", "changelog"];

  while (true) {
    const queryParams = new URLSearchParams({
      jql: `project = "${projectKey}" ORDER BY created DESC`,
      maxResults: String(maxResults),
      fields: fields.join(","),
      expand: expand.join(","),
    });
    if (nextPageToken) queryParams.append("nextPageToken", nextPageToken);

    let resp: any;
    for (let attempt = 0; attempt < 4; attempt++) {
      resp = await fetch(
        `https://${process.env.JIRA_DOMAIN}/rest/api/3/search/jql?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );

      if (resp.status === 429) {
        await sleep(1000);
        continue;
      }

      break;
    }

    if (!resp || !resp.ok) {
      const status = resp ? `${resp.status} ${resp.statusText}` : "no response";
      throw new Error(`Failed to fetch issues: ${status}`);
    }

    const data = await resp.json();
    const issues = data.issues || [];

    // Fetch comments for each issue
    for (const issue of issues) {
      let issueResp: any;
      for (let attempt = 0; attempt < 4; attempt++) {
        issueResp = await fetch(
          `https://${process.env.JIRA_DOMAIN}/rest/api/3/issue/${issue.key}/comment`,
          {
            // Need to add expand query param
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          },
        );

        if (issueResp.status === 429) {
          const retryAfter =
            parseInt(issueResp.headers.get("retry-after") || "1", 10) * 1000;
          await sleep(retryAfter || 1000);
          continue;
        }

        break;
      }

      if (issueResp && issueResp.ok) {
        const commentData = await issueResp.json();
        issue.changelog = commentData.changelog;
        issue.comments = commentData.fields?.comment?.comments || [];
      } else {
        issue.changelog = issue.changelog || null;
        issue.comments = issue.comments || [];
      }
    }

    allIssues.push(...issues);

    if (data.nextPageToken) {
      nextPageToken = data.nextPageToken;
    } else {
      break;
    }
  }

  console.log(allIssues);

  return allIssues;
}
