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

export interface BucketedFetchOpts {
    buckets: Array<{ name: string; query: string }>;
    maxResults?: number;
    maxPages?: number;
    maxSyncTimeMs?: number;
    fetchFull?: boolean;
    batchSize?: number;
    maxConcurrent?: number;
    listMessagesFn?: typeof listMessages;
    fetchMessagesFn?: typeof fetchMessagesParallel;
    initialPageTokens?: Record<string, string | null | undefined>;
    excludedMessageIds?: ReadonlySet<string>;
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

export async function fetchEmailsByBuckets(accessToken: string, opts: BucketedFetchOpts): Promise<{
    messages: GmailMessage[];
    pagesFetched: number;
    truncated: boolean;
    bucketQueries: Record<string, string>;
    pageTokens: Record<string, string | null>;
    exhaustedBuckets: string[];
}> {
    const maxResults = opts.maxResults ?? 250;
    const maxPages = opts.maxPages ?? 10;
    const deadline = Date.now() + (opts.maxSyncTimeMs ?? 25_000);
    const listFn = opts.listMessagesFn ?? listMessages;
    const fetchFn = opts.fetchMessagesFn ?? fetchMessagesParallel;
    const states = opts.buckets.map((bucket) => ({
        ...bucket,
        pageToken: opts.initialPageTokens?.[bucket.name] ?? undefined,
        active: true,
    }));
    const resultsPerBucketPage = Math.min(100, Math.max(10, Math.ceil(maxResults / Math.max(1, states.length))));
    const bucketsByMessageId = new Map<string, Set<string>>();
    let pagesFetched = 0;

    while (
        pagesFetched < maxPages &&
        bucketsByMessageId.size < maxResults &&
        Date.now() < deadline &&
        states.some((state) => state.active)
    ) {
        for (const state of states) {
            if (pagesFetched >= maxPages || bucketsByMessageId.size >= maxResults || Date.now() >= deadline) break;
            if (!state.active) continue;
            const result = await listFn(accessToken, state.query, resultsPerBucketPage, state.pageToken);
            pagesFetched += 1;
            for (const message of result.messages ?? []) {
                if (opts.excludedMessageIds?.has(message.id)) continue;
                if (!bucketsByMessageId.has(message.id)) bucketsByMessageId.set(message.id, new Set());
                bucketsByMessageId.get(message.id)!.add(state.name);
            }
            state.pageToken = result.nextPageToken;
            state.active = Boolean(result.nextPageToken && result.messages.length > 0);
        }
    }

    const ids = Array.from(bucketsByMessageId.keys()).slice(0, maxResults).map((id) => ({ id }));
    const messages = await fetchFn(accessToken, ids, {
        batchSize: opts.batchSize ?? 15,
        maxConcurrent: opts.maxConcurrent ?? 4,
        format: opts.fetchFull ? 'full' : 'metadata',
    });
    for (const message of messages) {
        message.matchedQueryBuckets = Array.from(bucketsByMessageId.get(message.id) ?? []).sort();
        message.platformEmailType = classifyPlatformEmail(message);
    }

    return {
        messages,
        pagesFetched,
        truncated:
            bucketsByMessageId.size >= maxResults ||
            Date.now() >= deadline ||
            (pagesFetched >= maxPages && states.some((state) => state.active)),
        bucketQueries: Object.fromEntries(opts.buckets.map((bucket) => [bucket.name, bucket.query])),
        pageTokens: Object.fromEntries(states.map((state) => [state.name, state.pageToken ?? null])),
        exhaustedBuckets: states.filter((state) => !state.active).map((state) => state.name),
    };
}

const JOB_ALERT_PATTERN = /job alert|jobs you may like|recommended jobs|new jobs for you|weekly job|similar jobs|saved search|job recommendations/;
const INTERVIEW_OR_ASSESSMENT_PATTERN = /interview (?:invitation|invite|request|scheduled|confirmed|availability)|invite you to (?:an? )?interview|schedule (?:an? )?(?:phone|video|technical|onsite )?interview|coding (?:assessment|challenge|test)|technical (?:assessment|screen)|complete (?:the|this|your|an?) assessment|online assessment|take-home/;
const RECRUITER_MESSAGE_PATTERN = /(?:recruiter|recruiting|talent acquisition|hiring team) (?:sent you|has sent you|reached out|messaged)|sent you a message about (?:a|an|the)? ?(?:role|position|job|opportunity)|new message from (?:a )?(?:recruiter|hiring team)/;
const APPLICATION_ACTIVITY_PATTERN = /thank you for applying|application (?:was |has been )?(?:received|submitted|reviewed)|we received your application|your application for|applied to|not moving forward with (?:your application|your candidacy|you)|after careful consideration|pleased to offer you|offer letter|congratulations(?:,|!| ) .*offer/;

function classifyPlatformEmail(message: GmailMessage): NonNullable<GmailMessage['platformEmailType']> {
    const text = `${message.subject ?? ''} ${message.snippet ?? ''}`.toLowerCase();
    if (JOB_ALERT_PATTERN.test(text)) return 'job_alert_noise';
    if (INTERVIEW_OR_ASSESSMENT_PATTERN.test(text)) return 'interview_or_assessment';
    if (RECRUITER_MESSAGE_PATTERN.test(text)) return 'recruiter_message';
    if (APPLICATION_ACTIVITY_PATTERN.test(text)) return 'application_activity';
    return 'unknown';
}
