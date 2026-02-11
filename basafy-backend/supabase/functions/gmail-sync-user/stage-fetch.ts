// Stage 1: Fetch Gmail messages in parallel batches
import { listMessages, fetchMessagesParallel } from './gmail-api';
import { GmailMessage } from './types';

export interface FetchOpts {
    maxResults?: number;
    fetchFull?: boolean;
    batchSize?: number;
    maxConcurrent?: number;
    query: string;
}

export async function fetchEmails(accessToken: string, opts: FetchOpts): Promise<GmailMessage[]> {
    // 1. List message IDs
    const messageIds = await listMessages(accessToken, opts.query, opts.maxResults ?? 200);

    // 2. Fetch messages in parallel batches
    const messages = await fetchMessagesParallel(accessToken, messageIds, {
        batchSize: opts.batchSize ?? 10,
        maxConcurrent: opts.maxConcurrent ?? 3,
        fetchFull: opts.fetchFull ?? false,
    });

    return messages;
}
