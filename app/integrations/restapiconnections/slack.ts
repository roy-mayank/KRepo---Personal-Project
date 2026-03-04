const fetch = require("node-fetch");

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function safeFetch(url: string, opts: any, maxAttempts = 4) {
  let resp: any;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    resp = await fetch(url, opts);

    if (resp.status === 429) {
      const retryAfter =
        parseInt(resp.headers.get("retry-after") || "1", 10) * 1000;
      await sleep(retryAfter || 1000);
      continue;
    }

    // Slack may return 200 but with ok: false in body; handle after parsing
    break;
  }

  return resp;
}

export async function fetchThreadReplies(
  channelId: string,
  threadTs: string,
  accessToken: string,
): Promise<any[]> {
  const allReplies: any[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const params = new URLSearchParams({
      channel: channelId,
      ts: threadTs,
      limit: "1000",
    });
    if (cursor) params.append("cursor", cursor);

    const resp = await safeFetch(
      `https://slack.com/api/conversations.replies?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (!resp) throw new Error("No response from Slack replies endpoint");

    const data = await resp.json();
    if (!data.ok) {
      const err = data.error || `${resp.status} ${resp.statusText}`;
      throw new Error(`Slack replies error: ${err}`);
    }

    const msgs = data.messages || [];
    allReplies.push(...msgs);

    const nextCursor = data.response_metadata?.next_cursor;
    if (nextCursor) {
      cursor = nextCursor;
    } else {
      break;
    }
  }

  return allReplies;
}

export async function fetchSlackMessages(
  channelId: string,
  accessToken: string,
  options?: {
    limit?: number; // per-page limit when listing channel messages
    fetchThreads?: boolean; // whether to fetch thread replies for messages that have them
    threadTsList?: string[]; // if provided, only fetch these thread timestamps
  },
): Promise<any[]> {
  const allMessages: any[] = [];

  // If specific thread timestamps were provided, fetch those threads only
  if (options?.threadTsList && options.threadTsList.length > 0) {
    for (const t of options.threadTsList) {
      const replies = await fetchThreadReplies(channelId, t, accessToken);
      // The replies array includes the root message as first element; attach as a single thread
      allMessages.push({ thread_ts: t, replies });
    }

    console.log(allMessages);
    return allMessages;
  }

  // Otherwise list channel history and optionally fetch thread replies per message
  const perPage = String(options?.limit || 1000);
  let cursor: string | undefined = undefined;

  while (true) {
    const params = new URLSearchParams({
      channel: channelId,
      limit: perPage,
    });
    if (cursor) params.append("cursor", cursor);

    const resp = await safeFetch(
      `https://slack.com/api/conversations.history?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (!resp)
      throw new Error("No response from Slack channel history endpoint");

    const data = await resp.json();
    if (!data.ok) {
      const err = data.error || `${resp.status} ${resp.statusText}`;
      throw new Error(`Slack history error: ${err}`);
    }

    const messages = data.messages || [];

    for (const msg of messages) {
      // Attach basic message data
      const entry: any = { message: msg };

      // If requested, fetch full thread replies
      if (options?.fetchThreads && msg.thread_ts) {
        try {
          const replies = await fetchThreadReplies(
            channelId,
            msg.thread_ts,
            accessToken,
          );
          entry.replies = replies;
        } catch (e) {
          entry.replies = [];
        }
      }

      allMessages.push(entry);
    }

    const nextCursor = data.response_metadata?.next_cursor;
    if (nextCursor) {
      cursor = nextCursor;
    } else {
      break;
    }
  }

  console.log(allMessages);
  return allMessages;
}
