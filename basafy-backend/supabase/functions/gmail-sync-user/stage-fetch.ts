// Stage 1: Fetch Gmail messages in parallel batches
import { listMessages, fetchMessagesParallel } from './gmail-api.ts';
import { GmailMessage } from './types.ts';

export interface FetchOpts {
    maxResults?: number;
    fetchFull?: boolean;
    batchSize?: number;
    maxConcurrent?: number;
    query: string;
    pageToken?: string | null;
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
