// Stage 1: Fetch Gmail messages in parallel batches
import { listMessages, fetchMessagesParallel, listHistoryMessages } from './gmail-api.ts';
import { GmailMessage } from './types.ts';

export interface FetchOpts {
    maxResults?: number;
    fetchFull?: boolean;
    batchSize?: number;
    maxConcurrent?: number;
    query: string;
    pageToken?: string | null;
}

/**
 * Fetch only new messages that arrived since a given Gmail history ID.
 * Used for push-notification-triggered incremental syncs.
 * Returns null latestHistoryId when the startHistoryId is too old (caller should fall back).
 */
export async function fetchEmailsSinceHistory(
    accessToken: string,
    startHistoryId: string,
): Promise<{
    messages: GmailMessage[];
    latestHistoryId: string | null;
}> {
    const { messageIds, latestHistoryId } = await listHistoryMessages(accessToken, startHistoryId);
    if (messageIds.length === 0) {
        return { messages: [], latestHistoryId };
    }
    const messages = await fetchMessagesParallel(
        accessToken,
        messageIds.map((id) => ({ id })),
        { batchSize: 15, maxConcurrent: 4, format: 'full' },
    );
    return { messages, latestHistoryId };
}

export async function fetchEmails(accessToken: string, opts: FetchOpts): Promise<{
    messages: GmailMessage[];
    nextPageToken: string | undefined;
    resultSizeEstimate: number | null;
}> {
    const maxTotal = opts.maxResults ?? 200;
    const allMessageIds: { id: string }[] = [];
    let pageToken: string | undefined = opts.pageToken ?? undefined;
    let lastResultSizeEstimate: number | null = null;
    let lastNextPageToken: string | undefined;

    // 1. Paginate through message IDs (lightweight — just IDs, no content)
    while (allMessageIds.length < maxTotal) {
        const perPage = Math.min(100, maxTotal - allMessageIds.length);
        const listResult = await listMessages(
            accessToken,
            opts.query,
            perPage,
            pageToken
        );

        if (lastResultSizeEstimate === null && typeof listResult.resultSizeEstimate === 'number') {
            lastResultSizeEstimate = listResult.resultSizeEstimate;
        }

        const newIds = listResult.messages ?? [];
        allMessageIds.push(...newIds);
        lastNextPageToken = listResult.nextPageToken;

        if (!listResult.nextPageToken || allMessageIds.length >= maxTotal || newIds.length === 0) {
            break;
        }
        pageToken = listResult.nextPageToken;
    }

    // 2. Fetch message content in parallel batches
    const messages = await fetchMessagesParallel(accessToken, allMessageIds, {
        batchSize: opts.batchSize ?? 15,
        maxConcurrent: opts.maxConcurrent ?? 4,
        format: opts.fetchFull ? "full" : "metadata",
    });

    return {
        messages,
        nextPageToken: lastNextPageToken,
        resultSizeEstimate: lastResultSizeEstimate,
    };
}
