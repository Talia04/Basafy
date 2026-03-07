// Gmail API interaction functions

import type { GmailMessage } from './types.ts';
import { extractPlainText } from './utils.ts';
import { BATCH_SIZE, MAX_CONCURRENT_BATCHES } from './constants.ts';

import {
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRedirectUri,
} from '../_shared/secrets.ts';

const GOOGLE_CLIENT_ID = getGoogleClientId();
const GOOGLE_CLIENT_SECRET = getGoogleClientSecret();
const GOOGLE_REDIRECT_URI = getGoogleRedirectUri();
let loggedClientConfig = false;

function getClientConfigInfo() {
  const idPrefix = GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.slice(0, 10) : 'missing';
  const idSuffix = GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.slice(-6) : 'missing';
  return {
    client_id_prefix: idPrefix,
    client_id_suffix: idSuffix,
    has_client_secret: Boolean(GOOGLE_CLIENT_SECRET),
    redirect_uri_set: Boolean(GOOGLE_REDIRECT_URI),
  };
}

function logClientConfigOnce() {
  if (loggedClientConfig) return;
  loggedClientConfig = true;
  console.log('[gmail-sync-user] Google OAuth config', getClientConfigInfo());
}

// ============================================================================
// OAuth Token Management
// ============================================================================

export async function getAccessToken(refresh_token: string): Promise<string> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google client credentials missing on server');
  }
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Unable to refresh Google access token');
  }
  return data.access_token as string;
}

export async function exchangeAuthCodeForTokens(authCode: string): Promise<{
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}> {
  logClientConfigOnce();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google client credentials missing on server');
  }
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code: authCode,
      grant_type: 'authorization_code',
      ...(GOOGLE_REDIRECT_URI ? { redirect_uri: GOOGLE_REDIRECT_URI } : {}),
    }),
  });
  const raw = await resp.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }
  if (!resp.ok) {
    console.error('gmail-sync-user token exchange failed', {
      status: resp.status,
      body: data,
      client: getClientConfigInfo(),
    });
    throw new Error(
      (data as any).error_description || (data as any).error || 'Unable to exchange Google auth code',
    );
  }
  return data as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
}

// ============================================================================
// Gmail Message Listing
// ============================================================================

export async function listMessages(
  accessToken: string,
  query: string,
  maxResults = 100,
  pageToken?: string
): Promise<{
  messages: { id: string }[];
  nextPageToken: string | undefined;
  resultSizeEstimate: number | null;
}> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(maxResults));
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || 'Failed to list Gmail messages');
  }
  return {
    messages: (data.messages || []) as { id: string }[],
    nextPageToken: data.nextPageToken as string | undefined,
    resultSizeEstimate: typeof data.resultSizeEstimate === 'number' ? data.resultSizeEstimate : null,
  };
}

// ============================================================================
// Gmail Message Fetching
// ============================================================================

export async function fetchMessageMetadata(accessToken: string, id: string): Promise<GmailMessage> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set('format', 'metadata');
  url.searchParams.append('metadataHeaders', 'Subject');
  url.searchParams.append('metadataHeaders', 'From');
  url.searchParams.append('metadataHeaders', 'Message-ID');

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || 'Failed to fetch Gmail message');
  }

  const headers = (data.payload?.headers || []) as { name: string; value: string }[];
  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value;
  const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value;
  const internetMessageId = headers.find((h) => h.name?.toLowerCase() === 'message-id')?.value || null;
  const internalTimestamp = data.internalDate ? Number(data.internalDate) : undefined;
  return {
    id,
    threadId: data.threadId,
    subject,
    from,
    internetMessageId,
    internalDate: internalTimestamp ? new Date(internalTimestamp).toISOString() : data.internalDate,
    internalTimestamp,
    snippet: data.snippet,
    bodyText: null,
  };
}

export async function fetchMessageFull(accessToken: string, id: string): Promise<GmailMessage> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set('format', 'full');
  url.searchParams.append('metadataHeaders', 'Subject');
  url.searchParams.append('metadataHeaders', 'From');
  url.searchParams.append('metadataHeaders', 'Message-ID');

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || 'Failed to fetch Gmail message');
  }

  const headers = (data.payload?.headers || []) as { name: string; value: string }[];
  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value;
  const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value;
  const internetMessageId = headers.find((h) => h.name?.toLowerCase() === 'message-id')?.value || null;
  const internalTimestamp = data.internalDate ? Number(data.internalDate) : undefined;
  const bodyText = extractPlainText(data.payload) || null;

  return {
    id,
    threadId: data.threadId,
    subject,
    from,
    internetMessageId,
    internalDate: internalTimestamp ? new Date(internalTimestamp).toISOString() : data.internalDate,
    internalTimestamp,
    snippet: data.snippet,
    bodyText,
  };
}

// ============================================================================
// Batch Fetching Utilities
// ============================================================================

async function fetchMessagesBatch(
  accessToken: string,
  ids: string[],
  format: 'metadata' | 'full' = 'metadata'
): Promise<GmailMessage[]> {
  const results: GmailMessage[] = [];
  
  for (const id of ids) {
    try {
      if (format === 'full') {
        results.push(await fetchMessageFull(accessToken, id));
      } else {
        results.push(await fetchMessageMetadata(accessToken, id));
      }
    } catch (err) {
      console.error(`Failed to fetch message ${id}:`, err);
    }
  }
  
  return results;
}

export async function fetchMessagesParallel(
  accessToken: string,
  ids: { id: string }[],
  options: {
    batchSize?: number;
    maxConcurrent?: number;
    format?: 'metadata' | 'full';
  } = {}
): Promise<GmailMessage[]> {
  const { 
    batchSize = BATCH_SIZE, 
    maxConcurrent = MAX_CONCURRENT_BATCHES,
    format = 'metadata'
  } = options;
  
  const allMessages: GmailMessage[] = [];
  const batches: string[][] = [];
  
  // Split into batches
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize).map(item => item.id));
  }
  
  // Process batches with limited concurrency
  for (let i = 0; i < batches.length; i += maxConcurrent) {
    const currentBatches = batches.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      currentBatches.map(batch => fetchMessagesBatch(accessToken, batch, format))
    );
    allMessages.push(...batchResults.flat());
  }
  
  return allMessages;
}

// ============================================================================
// Gmail Push Watch
// ============================================================================

/**
 * Register a Gmail push watch for the authenticated user.
 * @param topicName Full PubSub topic name e.g. "projects/my-project/topics/gmail-notifications"
 */
export async function setupGmailWatch(
  accessToken: string,
  topicName: string,
): Promise<{ historyId: string; expiration: string }> {
  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicName,
      labelIds: ['INBOX'],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || `Gmail watch setup failed: ${resp.status}`);
  }
  return { historyId: String(data.historyId), expiration: String(data.expiration) };
}

/**
 * Stop a Gmail push watch for the authenticated user.
 */
export async function stopGmailWatch(accessToken: string): Promise<void> {
  await fetch('https://gmail.googleapis.com/gmail/v1/users/me/stop', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * List message IDs added to INBOX since a given history ID.
 * Returns deduplicated message IDs for fetch + parse.
 */
export async function listHistoryMessages(
  accessToken: string,
  startHistoryId: string,
  maxResults = 500,
): Promise<{ messageIds: string[]; latestHistoryId: string | null }> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
  url.searchParams.set('startHistoryId', startHistoryId);
  url.searchParams.set('historyTypes', 'messageAdded');
  url.searchParams.set('labelId', 'INBOX');
  url.searchParams.set('maxResults', String(Math.min(maxResults, 500)));

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();

  // 404 means the historyId is too old — caller should fall back to a light full sync
  if (resp.status === 404) {
    return { messageIds: [], latestHistoryId: null };
  }
  if (!resp.ok) {
    throw new Error(data.error?.message || `Gmail history list failed: ${resp.status}`);
  }

  const seen = new Set<string>();
  for (const record of (data.history || [])) {
    for (const added of (record.messagesAdded || [])) {
      const id = added.message?.id;
      if (id) seen.add(id);
    }
  }

  return {
    messageIds: Array.from(seen),
    latestHistoryId: data.historyId ? String(data.historyId) : null,
  };
}
