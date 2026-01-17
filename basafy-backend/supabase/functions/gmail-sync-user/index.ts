/* @ts-ignore
   VSCode/TypeScript may show errors for remote imports and Deno global.
   These are expected for Deno edge functions and do not affect runtime.
*/
// Edge function: Gmail sync entry point
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

// Use non-SUPABASE_ prefixes because Supabase CLI blocks them in secrets
const SUPABASE_URL = Deno.env.get('PROJECT_URL');
const SUPABASE_ANON_KEY = Deno.env.get('ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI');

type GmailConnection = {
  id?: string | null;
  user_id: string;
  email: string | null;
  refresh_token: string | null;
  provider: string | null;
  backfill_page_token?: string | null;
  backfill_started_at?: string | null;
  backfill_completed_at?: string | null;
  backfill_total_estimate?: number | null;
  backfill_processed_count?: number | null;
};

type GmailMessage = {
  id: string;
  threadId?: string;
  subject?: string;
  from?: string;
  internalDate?: string;
  internalTimestamp?: number;
  snippet?: string;
  bodyText?: string | null;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function getAccessToken(refresh_token: string) {
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

async function exchangeAuthCodeForTokens(authCode: string) {
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

async function listMessages(
  accessToken: string,
  query: string,
  maxResults = 100,
  pageToken?: string
) {
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

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractPlainText(payload: any): string | null {
  if (!payload) return null;
  const mimeType = payload.mimeType || '';
  const bodyData = payload.body?.data;
  if (mimeType.startsWith('text/plain') && bodyData) {
    return decodeBase64Url(bodyData);
  }
  if (mimeType.startsWith('text/html') && bodyData) {
    return stripHtml(decodeBase64Url(bodyData));
  }
  const parts = payload.parts || [];
  for (const part of parts) {
    const text = extractPlainText(part);
    if (text) return text;
  }
  return null;
}

async function fetchMessageMetadata(accessToken: string, id: string): Promise<GmailMessage> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set('format', 'metadata');
  url.searchParams.append('metadataHeaders', 'Subject');
  url.searchParams.append('metadataHeaders', 'From');

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
  const internalTimestamp = data.internalDate ? Number(data.internalDate) : undefined;
  return {
    id,
    threadId: data.threadId,
    subject,
    from,
    internalDate: internalTimestamp ? new Date(internalTimestamp).toISOString() : data.internalDate,
    internalTimestamp,
    snippet: data.snippet,
    bodyText: null,
  };
}

async function fetchMessageFull(accessToken: string, id: string): Promise<GmailMessage> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set('format', 'full');
  url.searchParams.append('metadataHeaders', 'Subject');
  url.searchParams.append('metadataHeaders', 'From');

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
  const internalTimestamp = data.internalDate ? Number(data.internalDate) : undefined;
  const bodyText = extractPlainText(data.payload) || null;

  return {
    id,
    threadId: data.threadId,
    subject,
    from,
    internalDate: internalTimestamp ? new Date(internalTimestamp).toISOString() : data.internalDate,
    internalTimestamp,
    snippet: data.snippet,
    bodyText,
  };
}

function deriveCompany(from?: string | null, subject?: string | null): string | null {
  if (from) {
    const namePart = from.split('<')[0].trim().replace(/(^"|"$)/g, '');
    if (namePart) return namePart;
  }
  if (subject) {
    const tokens = subject.split('-').map((t) => t.trim()).filter(Boolean);
    if (tokens.length > 0) return tokens[0];
  }
  return null;
}

function deriveRole(subject?: string | null): string | null {
  if (!subject) return null;
  const cleaned = subject.replace(/^re:\s*/i, '').replace(/^fwd:\s*/i, '');
  const parts = cleaned.split('-').map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts.slice(1).join(' - ');
  }
  const colonSplit = cleaned.split(':').map((p) => p.trim()).filter(Boolean);
  if (colonSplit.length > 1) {
    return colonSplit.slice(1).join(': ');
  }
  return cleaned;
}

serve(async (req: Request) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Service misconfigured' }, 500);
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return jsonResponse({ error: 'Service misconfigured' }, 500);
    }

    const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const requestBody = await req.json().catch(() => ({}));
    let incomingRefresh = (requestBody as any)?.refresh_token || null;
    const incomingEmail = (requestBody as any)?.email || user.email || null;
    const incomingServerAuthCode = (requestBody as any)?.server_auth_code || null;
    const hardSync = Boolean((requestBody as any)?.hard_sync);
    const lightSync = Boolean((requestBody as any)?.light_sync);
    const maxMessagesRaw = Number((requestBody as any)?.max_messages);
    const maxMessagesOverride =
      Number.isFinite(maxMessagesRaw) && maxMessagesRaw > 0 ? Math.min(Math.floor(maxMessagesRaw), 200) : null;
    const enrichOnly = Boolean((requestBody as any)?.enrich_only);
    const pageTokenFromClient = (requestBody as any)?.page_token || null;
    const seedOnly = Boolean((requestBody as any)?.seed_only);
    const rawMaxMessages = Number((requestBody as any)?.max_messages);
    const defaultMaxMessages = hardSync ? 200 : 100;
    const maxMessages = Number.isFinite(rawMaxMessages) && rawMaxMessages > 0
      ? Math.min(500, Math.floor(rawMaxMessages))
      : defaultMaxMessages;
    const syncStartMs = Date.now();
    const TIME_BUDGET_MS = 110_000;
    const LLM_MAX_PER_SYNC = enrichOnly ? 15 : hardSync ? 6 : 8;
    const LLM_MIN_TIME_REMAINING_MS = 15_000;
    const PHASE1_LOOKBACK_DAYS = 60;
    const DEEP_SYNC_MAX_MESSAGES_PER_RUN = 800;
    const DEEP_SYNC_TOTAL_LIMIT = DEEP_SYNC_MAX_MESSAGES_PER_RUN * 20;
    let llmCalls = 0;
    let syncType: "full" | "incremental" | "enrich" = hardSync ? 'full' : 'full';

    const writeSyncLogError = async (message: string) => {
      if (seedOnly) return;
      const payload: Record<string, unknown> = {
        user_id: user.id,
        status: 'error',
        error_message: message,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        sync_type: syncType,
        messages_processed: 0,
      };
      const { error: logError } = await admin.from('gmail_sync_logs').insert([payload]);
      if (logError) {
        console.error('gmail-sync-user failed to write error sync log', logError);
      }
    };

    if (!incomingRefresh && incomingServerAuthCode) {
      try {
        const tokenData = await exchangeAuthCodeForTokens(incomingServerAuthCode);
        incomingRefresh = tokenData.refresh_token || null;
      } catch (exchangeErr: any) {
        console.error('gmail-sync-user failed to exchange auth code', exchangeErr);
        await writeSyncLogError(exchangeErr?.message || 'Unable to exchange Google auth code');
        return jsonResponse({ error: exchangeErr?.message || 'Unable to exchange Google auth code' }, 500);
      }
    }

    const { data: connectionData, error: connError } = await admin
      .from('gmail_connections')
      .select('id,user_id,email,refresh_token,provider,last_synced_at,backfill_page_token,backfill_started_at,backfill_completed_at,backfill_total_estimate,backfill_processed_count')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle();
    let connection = connectionData as (GmailConnection & { last_synced_at?: string | null }) | null;

    if (connError) {
      await writeSyncLogError(connError.message || 'Unable to read Gmail connection');
      return jsonResponse({ error: connError.message }, 500);
    }

    if (!connection) {
      // Fallback: any provider row for this user (in case provider value differs)
      const { data: anyConn, error: anyErr } = await admin
        .from('gmail_connections')
        .select('id,user_id,email,refresh_token,provider,backfill_page_token,backfill_started_at,backfill_completed_at,backfill_total_estimate,backfill_processed_count')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!anyErr && anyConn) {
        connection = anyConn as GmailConnection;
        console.warn('gmail-sync-user provider mismatch, using available connection', {
          user_id: user.id,
          provider: connection?.provider,
        });
      }
    }

    // If still no connection but we received a refresh token from the client, seed it once.
    if (!connection && incomingRefresh) {
      const { error: seedError } = await admin.from('gmail_connections').insert({
        user_id: user.id,
        provider: 'google',
        email: incomingEmail,
        refresh_token: incomingRefresh,
      });
      if (seedError) {
        console.error('gmail-sync-user failed to seed connection', seedError);
      } else {
        const { data: seeded } = await admin
          .from('gmail_connections')
          .select('user_id,email,refresh_token,provider')
          .eq('user_id', user.id)
          .maybeSingle();
        connection = seeded as GmailConnection | null;
        console.log('gmail-sync-user seeded connection from request body', {
          user_id: user.id,
          provider: connection?.provider,
          has_refresh_token: !!connection?.refresh_token,
        });
      }
    }

    if (!connection) {
      if (seedOnly && !incomingRefresh) {
        return jsonResponse({
          ok: true,
          seed_only: true,
          has_refresh_token: false,
          provider: 'google',
          email: incomingEmail ?? user.email,
        });
      }
      console.warn('gmail-sync-user no connection found', { user_id: user.id });
      await writeSyncLogError('No Gmail connection found for user');
      return jsonResponse({ error: 'No Gmail connection found for user' }, 404);
    }

    const gmail = connection as GmailConnection;
    const isInitialImport = !enrichOnly && !hardSync && !connection?.last_synced_at;
    const isDeepSync = !enrichOnly && hardSync;
    syncType = enrichOnly ? 'enrich' : (hardSync ? 'full' : (connection?.last_synced_at ? 'incremental' : 'full'));
    console.log('gmail-sync-user start', {
      user_id: user.id,
      email: gmail.email,
      provider: gmail.provider,
      has_refresh_token: !!gmail.refresh_token,
      incoming_refresh: !!incomingRefresh,
      seed_only: seedOnly,
    });

    if (!gmail.refresh_token && incomingRefresh) {
      const { error: updateError } = await admin
        .from('gmail_connections')
        .update({ refresh_token: incomingRefresh, email: gmail.email ?? incomingEmail })
        .eq('user_id', user.id)
        .eq('provider', gmail.provider || 'google');
      if (!updateError) {
        gmail.refresh_token = incomingRefresh;
      } else {
        console.error('gmail-sync-user failed to backfill refresh token', updateError);
      }
    }

    if (seedOnly) {
      return jsonResponse({
        ok: true,
        seed_only: true,
        has_refresh_token: !!gmail.refresh_token,
        provider: gmail.provider ?? 'google',
        email: gmail.email ?? incomingEmail ?? user.email,
      });
    }

    if (!gmail.refresh_token) {
      console.warn('gmail-sync-user missing refresh token', { user_id: user.id, provider: gmail.provider });
      await writeSyncLogError('Missing refresh token for Gmail connection');
      return jsonResponse({ error: 'Missing refresh token for Gmail connection' }, 400);
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken(gmail.refresh_token);
    } catch (err: any) {
      await writeSyncLogError(err?.message || 'Unable to get Gmail access token');
      return jsonResponse({ error: err?.message || 'Unable to get Gmail access token' }, 500);
    }

    const updateSyncState = async (updates: Record<string, unknown>) => {
      if (enrichOnly) return;
      await admin.from('gmail_sync_state').upsert({
        user_id: user.id,
        connection_id: gmail.id ?? null,
        ...updates,
      }, { onConflict: 'user_id' });
    };

    // Build Gmail query based on last_synced_at
    const baseQuery = hardSync
      ? 'in:anywhere '
      : 'in:inbox -category:promotions -category:social -category:forums ';
    const domainFilters = [
      'lever.co',
      'greenhouse.io',
      'grnh.se',
      'ashbyhq.com',
      'workday.com',
      'myworkday.com',
      'successfactors.com',
      'workable.com',
      'smartrecruiters.com',
      'icims.com',
      'jobvite.com',
      'taleo.net',
      'oracle.com',
      'adp.com',
      'bamboohr.com',
      'recruitee.com',
      'breezy.hr',
      'rippling.com',
      'codesignal.com',
      'hackerrank.com',
      'hirevue.com',
      'myinterview.com',
      'interviewing.io',
      'hire.lever.co',
      'jobs.lever.co',
      'boards.greenhouse.io',
      'applytojob.com',
      'myworkdayjobs.com',
      'jobs.workable.com',
      'smartrecruiters.com',
      'job-boards.greenhouse.io',
      'ashbyhq.com',
      'hire.com',
    ];
    const recruiterKeywords = [
      'recruiter',
      '"talent acquisition"',
      '"hiring team"',
      '"hiring manager"',
      '"sourcer"',
      '"people team"',
    ];
    const subjectKeywords = [
      'application',
      'interview',
      '"job offer"',
      'offer',
      '"career opportunity"',
      '"thank you for applying"',
      '"application received"',
      '"your application"',
      'assessment',
      '"online assessment"',
      '"coding challenge"',
      '"take-home"',
      '"next steps"',
      '"phone screen"',
      'onsite',
      '"background check"',
      '"reference check"',
      '"schedule"',
      '"availability"',
      '"recruiting"',
      '"interview request"',
      '"interview invite"',
    ];
    const labelHints = '(label:jobs OR label:job OR label:recruiting OR label:recruitment)';
    let query = '';
    if (!enrichOnly) {
      query =
        baseQuery +
        `(${labelHints} OR from:(${domainFilters.join(' OR ')}) ` +
        `OR subject:(${recruiterKeywords.join(' OR ')}) OR (${recruiterKeywords.join(' OR ')})) ` +
        `(subject:(${subjectKeywords.join(' OR ')}) OR (${subjectKeywords.join(' OR ')}))`;
      if (hardSync) {
        // hard sync pulls all matching mail, no time cutoff
      } else if (isInitialImport) {
        const afterDate = new Date(Date.now() - PHASE1_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]
          .replace(/-/g, '/');
        query += ` after:${afterDate}`;
      } else if (connection?.last_synced_at) {
        // Only fetch messages newer than last_synced_at
        const afterDate = new Date(connection.last_synced_at).toISOString().split('T')[0].replace(/-/g, '/');
        query += ` after:${afterDate}`;
      }
    }

    let syncLogId: number | null = null;
    let resolvedSyncType: "full" | "incremental" | "enrich" = syncType;
    let totalMessagesFetched = 0;
    let nextPageTokenFromSync: string | undefined;
    let eventInserted = 0;
    let eventUpdated = 0;
    let appInserted = 0;
    let appUpdated = 0;

    try {
      // create sync log entry
      const { data: syncLog, error: logError } = await admin
        .from('gmail_sync_logs')
        .insert([{
          user_id: user.id,
          status: 'running',
          sync_type: resolvedSyncType,
          started_at: new Date().toISOString()
        }])
        .select('id')
        .maybeSingle();
      if (logError) {
        console.error('gmail-sync-user failed to create sync log', logError);
      } else {
        syncLogId = (syncLog as any)?.id ?? null;
      }

      const ids: { id: string }[] = [];
      let estimateFromSync: number | null = null;
      let lastProgressPercent: number | null = null;
      let backfillProcessedCount: number | null = null;
      if (isInitialImport) {
        await updateSyncState({
          initial_import_status: 'phase1_running',
          initial_import_progress: 0,
          last_sync_summary: 'Phase 1 sync started.',
        });
      }
      if (isDeepSync) {
        await updateSyncState({
          initial_import_status: 'deep_running',
          last_sync_summary: 'Deep sync started.',
        });
      }
      if (enrichOnly) {
        const { data: enrichRows } = await admin
          .from('job_email_events')
          .select('gmail_message_id')
          .eq('user_id', user.id)
          .is('llm_parsed_json', null)
          .order('received_at', { ascending: false })
          .limit(maxMessages);
        ids.push(
          ...(enrichRows || [])
            .map((row: any) => ({ id: row.gmail_message_id }))
            .filter((row: any) => !!row.id)
        );
        totalMessagesFetched = ids.length;
        nextPageTokenFromSync = undefined;
      } else {
        let pageToken: string | undefined =
          pageTokenFromClient || (hardSync ? connection?.backfill_page_token || undefined : undefined);
        const maxTotalMessages = hardSync ? DEEP_SYNC_MAX_MESSAGES_PER_RUN : isInitialImport ? 250 : 500;
        while (true) {
          const { messages: messageIds, nextPageToken, resultSizeEstimate } = await listMessages(
            accessToken,
            query,
            maxMessages,
            pageToken
          );
          if (estimateFromSync === null && typeof resultSizeEstimate === 'number') {
            estimateFromSync = resultSizeEstimate;
          }
          ids.push(...messageIds);
          totalMessagesFetched = ids.length;
          nextPageTokenFromSync = nextPageToken;
          if (estimateFromSync && (isInitialImport || isDeepSync)) {
            const percent = Math.min(100, Math.round((totalMessagesFetched / estimateFromSync) * 100));
            if (lastProgressPercent === null || percent >= lastProgressPercent + 5) {
              lastProgressPercent = percent;
              await updateSyncState({ initial_import_progress: percent });
            }
          }
          const timeRemaining = TIME_BUDGET_MS - (Date.now() - syncStartMs);
          if (!nextPageToken) break;
          if (totalMessagesFetched >= maxTotalMessages) break;
          if (timeRemaining < 10_000) break;
          pageToken = nextPageToken;
        }
        if (hardSync) {
          const isFreshBackfill =
            !pageTokenFromClient &&
            !connection?.backfill_page_token &&
            !connection?.backfill_started_at;
          const nextProcessedCount =
            (isFreshBackfill ? 0 : (connection?.backfill_processed_count || 0)) + ids.length;
          backfillProcessedCount = nextProcessedCount;
          if (nextPageTokenFromSync) {
            await admin
              .from('gmail_connections')
              .update({
                backfill_page_token: nextPageTokenFromSync,
                backfill_started_at: connection?.backfill_started_at || new Date().toISOString(),
                backfill_completed_at: null,
                backfill_total_estimate: estimateFromSync ?? connection?.backfill_total_estimate ?? null,
                backfill_processed_count: nextProcessedCount,
              })
              .eq('user_id', user.id)
              .eq('provider', connection.provider || 'google');
            if (isDeepSync) {
              const deepEstimate = estimateFromSync ?? connection?.backfill_total_estimate ?? null;
              const deepProgress = deepEstimate
                ? Math.min(99, Math.round((nextProcessedCount / deepEstimate) * 100))
                : null;
              await updateSyncState({
                initial_import_progress: deepProgress,
              });
            }
          } else {
            await admin
              .from('gmail_connections')
              .update({
                backfill_page_token: null,
                backfill_started_at: connection?.backfill_started_at || new Date().toISOString(),
                backfill_completed_at: new Date().toISOString(),
                backfill_total_estimate: estimateFromSync ?? connection?.backfill_total_estimate ?? null,
                backfill_processed_count: nextProcessedCount,
              })
              .eq('user_id', user.id)
              .eq('provider', connection.provider || 'google');
            if (isDeepSync) {
              await updateSyncState({
                initial_import_progress: 100,
              });
            }
          }
        }
      }
      totalMessagesFetched = ids.length;
    const messages: GmailMessage[] = [];
    const appResults: Array<{ gmail_message_id: string; action: 'inserted' | 'updated' | 'error'; error?: string }> =
      [];
    const notificationDedup = new Set<string>();
    const notificationCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const appCache = new Map<string, { status: string | null; company: string | null; role: string | null }>();

    async function createNotificationOnce(
      dedupKey: string,
      payload: Record<string, unknown>,
      options?: { statusTo?: string }
    ) {
      if (notificationDedup.has(dedupKey)) return;
      notificationDedup.add(dedupKey);
      let query = admin
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('subtype', payload.subtype as string)
        .gte('created_at', notificationCutoff)
        .limit(1);
      if (payload.entity_id) {
        query = query.eq('entity_id', payload.entity_id as string);
      }
      if (options?.statusTo) {
        query = query.eq('metadata->>status_to', options.statusTo);
      }
      const { data: existingNotification, error: existingError } = await query;
      if (existingError) {
        console.warn('gmail-sync-user failed to check notification dedup', existingError);
        return;
      }
      if (existingNotification && existingNotification.length > 0) return;
      const { error: insertError } = await admin.from('notifications').insert([payload]);
      if (insertError) {
        console.error('gmail-sync-user failed to insert notification', insertError);
      }
    }

    const messageIds = ids.map((item) => item.id);
    const existingAppsByMessage = new Map<string, any>();
    const existingEventsByMessage = new Map<string, any>();
    const pendingEventUpserts: Array<Record<string, unknown>> = [];
    const pendingTaskUpserts: Array<Record<string, unknown>> = [];
    if (messageIds.length > 0) {
      const { data: existingApps } = await admin
        .from('applications')
        .select('id, company, role, role_title, status, source_type, gmail_message_id')
        .eq('user_id', user.id)
        .in('gmail_message_id', messageIds);
      (existingApps || []).forEach((app: any) => {
        if (app.gmail_message_id) {
          existingAppsByMessage.set(app.gmail_message_id, app);
        }
      });

      const { data: existingEvents } = await admin
        .from('job_email_events')
        .select('id, application_id, user_id, gmail_message_id, gmail_thread_id, parsed_company, parsed_role, parsed_status, event_type, llm_parsed_json')
        .eq('user_id', user.id)
        .in('gmail_message_id', messageIds);
      (existingEvents || []).forEach((event: any) => {
        if (event.gmail_message_id) {
          existingEventsByMessage.set(event.gmail_message_id, event);
        }
      });
    }

    let latestMessageTime: string | null = null;
    const syncTimestamp = new Date().toISOString();
    for (const { id } of ids) {
      try {
        const msg = await fetchMessageMetadata(accessToken, id);
        messages.push(msg);
        if (msg.internalDate && (!latestMessageTime || msg.internalDate > latestMessageTime)) {
          latestMessageTime = msg.internalDate;
        }
        console.log('gmail-sync-user fetched', {
          id: msg.id,
          subject: msg.subject,
          from: msg.from,
          internalDate: msg.internalDate,
        });

        const existing = existingAppsByMessage.get(msg.id) || null;
        if (existing?.id) {
          appCache.set(existing.id, {
            status: (existing as any).status ?? null,
            company: (existing as any).company ?? null,
            role: (existing as any).role ?? null,
          });
        }

        const companyGuess = deriveCompany(msg.from, msg.subject) || 'Unknown company';
        const roleGuess = deriveRole(msg.subject) || 'Job application';

        const receivedAt =
          (msg.internalTimestamp && new Date(msg.internalTimestamp).toISOString()) ||
          msg.internalDate ||
          new Date().toISOString();

        function classifyJobEmailEvent(subject: string | null | undefined, from: string | null | undefined) {
          const s = (subject || '').toLowerCase();
          const f = (from || '').toLowerCase();
          if (s.includes('received your application') || s.includes('application submitted')) {
            return { event_type: 'application_received', confidence: 0.95 };
          }
          if (s.includes('interview') || s.includes('schedule a call')) {
            return { event_type: 'interview_invite', confidence: 0.95 };
          }
          if (s.includes('will not be moving forward') || s.includes('unfortunately')) {
            return { event_type: 'rejection', confidence: 0.95 };
          }
          if (s.includes('offer')) {
            return { event_type: 'offer', confidence: 0.95 };
          }
          return { event_type: 'other', confidence: 0.5 };
        }

        async function parseCompanyAndRole(subject: string | null | undefined, from: string | null | undefined) {
          let parsed_company: string | null = null;
          let parsed_role: string | null = null;
          let confidence = 0.5;

          if (!parsed_company || !parsed_role) {
            const subjectMatch = subject?.match(/Your application to (.+?) for (.+)/i);
            if (subjectMatch) {
              parsed_company = parsed_company || subjectMatch[1];
              parsed_role = parsed_role || subjectMatch[2];
              confidence = Math.max(confidence, 0.98);
            } else if (subject && subject.toLowerCase().includes('application to')) {
              const fallbackMatch = subject.match(/application to ([^ ]+)/i);
              if (fallbackMatch) {
                parsed_company = parsed_company || fallbackMatch[1];
                confidence = Math.max(confidence, 0.9);
              }
            }

            if (!parsed_company && from) {
              const domainMatch = from.match(/@([a-zA-Z0-9.-]+)\./);
              if (domainMatch) {
                parsed_company = domainMatch[1];
                confidence = Math.max(confidence, 0.8);
              }
            }

            if (!parsed_role && subject) {
              const roleMatch = subject.match(/for (.+)/i);
              if (roleMatch) {
                parsed_role = roleMatch[1];
                confidence = Math.max(confidence, 0.8);
              }
            }
          }

          return { parsed_company, parsed_role, confidence };
        }

        async function parseWithLlm(input: {
          subject?: string | null;
          from?: string | null;
          snippet?: string | null;
          body?: string | null;
        }) {
          const apiKey = Deno.env.get('OPENAI_API_KEY');
          if (!apiKey) return null;
          const prompt = `You are extracting structured info from a job-related email. Return JSON ONLY with keys:
company, role_title, stage, event_type, event_title, event_start_iso, event_end_iso, meeting_provider, meeting_link, location, task_title, task_description, task_due_iso, task_completed, confidence.
Stage must be one of: applied, assessment, interview, offer, rejected, archived, other.
Event_type must be one of: interview, assessment, deadline, follow_up, none.
Meeting_provider: zoom, google_meet, teams, phone, onsite, none.
If unknown, use null. task_completed must be true/false when a task is mentioned. Confidence is 0-1.
Subject: ${input.subject || ''}
From: ${input.from || ''}
Snippet: ${input.snippet || ''}
Body: ${input.body || ''}`;

          try {
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 300,
                temperature: 0,
              }),
            });
            const data = await resp.json();
            const content = data?.choices?.[0]?.message?.content?.trim();
            if (!content) return null;
            const parsed = JSON.parse(content);
            return parsed ?? null;
          } catch {
            return null;
          }
        }

        const existingEvent = existingEventsByMessage.get(msg.id) || null;

        const classification = classifyJobEmailEvent(msg.subject, msg.from);
        const parsing = await parseCompanyAndRole(msg.subject, msg.from);
        const timeRemaining = TIME_BUDGET_MS - (Date.now() - syncStartMs);
        const heuristicConfidence = Math.max(classification.confidence, parsing.confidence);
        const allowLlmByHeuristic = enrichOnly ? true : heuristicConfidence < 0.9;
        const shouldUseLlm =
          !lightSync &&
          llmCalls < LLM_MAX_PER_SYNC &&
          timeRemaining > LLM_MIN_TIME_REMAINING_MS &&
          allowLlmByHeuristic &&
          !existingEvent?.llm_parsed_json;
        let llmParsed = null;
          if (shouldUseLlm) {
            const fullMsg = await fetchMessageFull(accessToken, id);
            msg.bodyText = fullMsg.bodyText;
            msg.snippet = fullMsg.snippet ?? msg.snippet;
            llmParsed = await parseWithLlm({
              subject: fullMsg.subject ?? msg.subject,
              from: fullMsg.from ?? msg.from,
              snippet: fullMsg.snippet ?? null,
              body: fullMsg.bodyText ?? null,
            });
          }
          if (shouldUseLlm) {
            llmCalls += 1;
          }

          const allowedStages = new Set([
            'applied',
            'assessment',
            'interview',
            'offer',
            'rejected',
            'archived',
            'other',
          ]);
          const allowedEventTypes = new Set(['interview', 'assessment', 'deadline', 'follow_up', 'none']);

          const llmConfidence = typeof llmParsed?.confidence === 'number' ? llmParsed.confidence : null;
          const llmStage =
            llmConfidence !== null && llmConfidence >= 0.5 && allowedStages.has(llmParsed?.stage)
              ? llmParsed.stage
              : null;
          const llmEventType =
            llmConfidence !== null && llmConfidence >= 0.5 && allowedEventTypes.has(llmParsed?.event_type)
              ? llmParsed.event_type
              : null;
          const llmHasTrustedEvent = llmConfidence !== null && llmConfidence >= 0.5 && llmEventType && llmEventType !== 'none';

          const parsedCompany =
            llmParsed?.company || parsing.parsed_company || (existingEvent as any)?.parsed_company || null;
          const parsedRole =
            llmParsed?.role_title || parsing.parsed_role || (existingEvent as any)?.parsed_role || null;
          const parsedStatus = llmStage || (existingEvent as any)?.parsed_status || null;

          const payload = {
            user_id: user.id,
            company: existing?.company || parsedCompany || companyGuess,
            role: existing?.role || parsedRole || roleGuess,
            role_title: existing?.role_title || parsedRole || existing?.role || roleGuess,
            source_type: 'gmail',
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId ?? null,
            email_snippet: msg.snippet ?? null,
            last_synced_at: syncTimestamp,
            status: parsedStatus || existing?.status || null,
          };

          if (existing?.id) {
            const { error: updateError } = await admin.from('applications').update(payload).eq('id', existing.id);
            if (updateError) {
              console.error('gmail-sync-user failed to update application', { id: existing.id, error: updateError });
              appResults.push({ gmail_message_id: msg.id, action: 'error', error: updateError.message });
            } else {
              appUpdated += 1;
              appResults.push({ gmail_message_id: msg.id, action: 'updated' });
              const nextStatus = payload.status ? String(payload.status) : null;
              const prevStatus = existing.status ? String(existing.status) : null;
              if (nextStatus && prevStatus && nextStatus !== prevStatus) {
                await createNotificationOnce(`status:${existing.id}:${nextStatus}`, {
                  user_id: user.id,
                  type: 'update',
                  subtype: 'status_change',
                  title: `Update: ${nextStatus} for ${payload.company || existing.company || 'Application'}`,
                  body: payload.role || existing.role || null,
                  entity_type: 'application',
                  entity_id: existing.id,
                  metadata: {
                    status_from: prevStatus,
                    status_to: nextStatus,
                    company: payload.company || existing.company || null,
                    role: payload.role || existing.role || null,
                  },
                  channel: 'both',
                  priority: 'normal',
                  scheduled_for: syncTimestamp,
                }, { statusTo: nextStatus });
              }
            }
          } else {
            const { data: newApp, error: insertError } = await admin
              .from('applications')
              .insert([payload])
              .select('id, company, role, status')
              .maybeSingle();
            if (insertError) {
              console.error('gmail-sync-user failed to insert application', { message_id: msg.id, error: insertError });
              appResults.push({ gmail_message_id: msg.id, action: 'error', error: insertError.message });
            } else {
              appInserted += 1;
              appResults.push({ gmail_message_id: msg.id, action: 'inserted' });
              if (newApp?.id) {
                appCache.set(newApp.id, {
                  status: (newApp as any).status ?? null,
                  company: (newApp as any).company ?? null,
                  role: (newApp as any).role ?? null,
                });
                await createNotificationOnce(`new_app:${newApp.id}`, {
                  user_id: user.id,
                  type: 'update',
                  subtype: 'new_application',
                  title: `New job detected: ${(newApp as any).company || payload.company || 'Application'}`,
                  body: (newApp as any).role || payload.role || null,
                  entity_type: 'application',
                  entity_id: newApp.id,
                  metadata: {
                    company: (newApp as any).company || payload.company || null,
                    role: (newApp as any).role || payload.role || null,
                  },
                  channel: 'both',
                  priority: 'normal',
                  scheduled_for: syncTimestamp,
                });
              }
            }
          }

          const eventPayload: Record<string, unknown> = {
            user_id: user.id,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId ?? null,
            raw_subject: msg.subject ?? null,
            raw_from: msg.from ?? null,
            raw_snippet: msg.snippet ?? null,
            received_at: receivedAt,
            event_type: llmEventType && llmEventType !== 'none' ? llmEventType : classification.event_type,
            confidence: Math.max(classification.confidence, parsing.confidence, llmConfidence || 0),
            parsed_company: parsedCompany,
            parsed_role: parsedRole,
          };
          if (parsedStatus) {
            eventPayload.parsed_status = parsedStatus;
          }
          if (llmParsed) {
            eventPayload.llm_parsed_json = llmParsed;
          }

          const { data: upsertedEvent, error: eventUpsertError } = await admin
            .from('job_email_events')
            .upsert([eventPayload], { onConflict: 'user_id,gmail_message_id' })
            .select('id, application_id, user_id, gmail_thread_id, parsed_company, parsed_role, event_type');
          if (eventUpsertError) {
            console.error('gmail-sync-user failed to upsert job_email_event', {
              message_id: msg.id,
              error: eventUpsertError,
            });
          } else if (existingEvent?.id) {
            eventUpdated += 1;
          } else {
            eventInserted += 1;
          }

          // --- Application mapping logic ---
          // Use upsertedEvent if available, otherwise fallback to eventPayload
          const eventRow = (upsertedEvent && upsertedEvent[0]) || eventPayload;
          let foundAppId: string | null = null;

          // 1. Try to find application by user_id and gmail_thread_id
          if (eventRow.gmail_thread_id) {
            const { data: threadApp } = await admin
              .from('applications')
              .select('id, status, company, role')
              .eq('user_id', user.id)
              .eq('gmail_thread_id', eventRow.gmail_thread_id)
              .maybeSingle();
            if (threadApp?.id) {
              foundAppId = threadApp.id;
              appCache.set(threadApp.id, {
                status: (threadApp as any).status ?? null,
                company: (threadApp as any).company ?? null,
                role: (threadApp as any).role ?? null,
              });
            }
          }

          // 2. Try to find by source_type and similar company/role
          if (!foundAppId && eventRow.parsed_company && eventRow.parsed_role) {
            const { data: similarApp } = await admin
              .from('applications')
              .select('id, status, company, role')
              .eq('user_id', user.id)
              .eq('source_type', 'gmail')
              .ilike('company', `%${eventRow.parsed_company}%`)
              .ilike('role', `%${eventRow.parsed_role}%`)
              .maybeSingle();
            if (similarApp?.id) {
              foundAppId = similarApp.id;
              appCache.set(similarApp.id, {
                status: (similarApp as any).status ?? null,
                company: (similarApp as any).company ?? null,
                role: (similarApp as any).role ?? null,
              });
            }
          }

          // 3. If found, update event.application_id and application status if needed
          if (foundAppId) {
            await admin
              .from('job_email_events')
              .update({ application_id: foundAppId })
              .eq('id', eventRow.id);

            // Optionally update application status based on event_type
            let newStatus = null;
            if (eventRow.event_type === 'interview_invite') newStatus = 'Interview';
            if (eventRow.event_type === 'rejection') newStatus = 'Rejected';
            if (eventRow.event_type === 'offer') newStatus = 'Offer';
            if (newStatus) {
              let cachedApp = appCache.get(foundAppId);
              if (!cachedApp) {
                const { data: appRow } = await admin
                  .from('applications')
                  .select('status, company, role')
                  .eq('id', foundAppId)
                  .maybeSingle();
                if (appRow) {
                  cachedApp = {
                    status: (appRow as any).status ?? null,
                    company: (appRow as any).company ?? null,
                    role: (appRow as any).role ?? null,
                  };
                  appCache.set(foundAppId, cachedApp);
                }
              }
              await admin
                .from('applications')
                .update({ status: newStatus, last_synced_at: syncTimestamp })
                .eq('id', foundAppId);
              if (cachedApp?.status && cachedApp.status !== newStatus) {
                await createNotificationOnce(`status:${foundAppId}:${newStatus}`, {
                  user_id: user.id,
                  type: 'update',
                  subtype: 'status_change',
                  title: `Update: ${newStatus} for ${cachedApp.company || 'Application'}`,
                  body: cachedApp.role || null,
                  entity_type: 'application',
                  entity_id: foundAppId,
                  metadata: {
                    status_from: cachedApp.status,
                    status_to: newStatus,
                    company: cachedApp.company || null,
                    role: cachedApp.role || null,
                  },
                  channel: 'both',
                  priority: 'normal',
                  scheduled_for: syncTimestamp,
                }, { statusTo: newStatus });
              }
            }
          }

          // 4. If not found and event_type is application_received, create new application and link
          if (!foundAppId && eventRow.event_type === 'application_received') {
            // Check for existing application for this message (idempotency)
            const { data: alreadyApp } = await admin
              .from('applications')
              .select('id')
              .eq('user_id', user.id)
              .eq('gmail_message_id', msg.id)
              .maybeSingle();
            if (!alreadyApp) {
              const { data: newApp, error: newAppErr } = await admin
                .from('applications')
                .insert([{
                  user_id: user.id,
                  company: eventRow.parsed_company || eventRow.raw_subject || 'Unknown',
                  role: eventRow.parsed_role || eventRow.raw_subject || 'Unknown',
                  role_title: eventRow.parsed_role || eventRow.raw_subject || 'Unknown',
                  source_type: 'gmail',
                  gmail_message_id: msg.id,
                  gmail_thread_id: msg.threadId ?? null,
                  email_snippet: msg.snippet ?? null,
                  status: 'Applied',
                  last_synced_at: syncTimestamp,
                }])
                .select('id, company, role, status')
                .maybeSingle();
              if (newApp?.id) {
                await admin
                  .from('job_email_events')
                  .update({ application_id: newApp.id })
                  .eq('id', eventRow.id);
                foundAppId = newApp.id;
                appCache.set(newApp.id, {
                  status: (newApp as any).status ?? null,
                  company: (newApp as any).company ?? null,
                  role: (newApp as any).role ?? null,
                });
                await createNotificationOnce(`new_app:${newApp.id}`, {
                  user_id: user.id,
                  type: 'update',
                  subtype: 'new_application',
                  title: `New job detected: ${(newApp as any).company || 'Application'}`,
                  body: (newApp as any).role || null,
                  entity_type: 'application',
                  entity_id: newApp.id,
                  metadata: {
                    company: (newApp as any).company || null,
                    role: (newApp as any).role || null,
                  },
                  channel: 'both',
                  priority: 'normal',
                  scheduled_for: syncTimestamp,
                });
              }
            }
          }

          if (foundAppId && parsedStatus && llmConfidence !== null && llmConfidence >= 0.5) {
            let cachedApp = appCache.get(foundAppId);
            if (!cachedApp) {
              const { data: appRow } = await admin
                .from('applications')
                .select('status, company, role')
                .eq('id', foundAppId)
                .maybeSingle();
              if (appRow) {
                cachedApp = {
                  status: (appRow as any).status ?? null,
                  company: (appRow as any).company ?? null,
                  role: (appRow as any).role ?? null,
                };
                appCache.set(foundAppId, cachedApp);
              }
            }
            await admin
              .from('applications')
              .update({ status: parsedStatus, last_synced_at: syncTimestamp })
              .eq('id', foundAppId);
            if (cachedApp?.status && cachedApp.status !== parsedStatus) {
              await createNotificationOnce(`status:${foundAppId}:${parsedStatus}`, {
                user_id: user.id,
                type: 'update',
                subtype: 'status_change',
                title: `Update: ${parsedStatus} for ${cachedApp.company || 'Application'}`,
                body: cachedApp.role || null,
                entity_type: 'application',
                entity_id: foundAppId,
                metadata: {
                  status_from: cachedApp.status,
                  status_to: parsedStatus,
                  company: cachedApp.company || null,
                  role: cachedApp.role || null,
                },
                channel: 'both',
                priority: 'normal',
                scheduled_for: syncTimestamp,
              }, { statusTo: parsedStatus });
            }
          }

          if (foundAppId && llmHasTrustedEvent) {
            const eventTitle =
              llmParsed?.event_title ||
              `${parsedCompany || 'Application'} ${llmEventType.replace(/_/g, ' ')}`;
            const startAt = llmParsed?.event_start_iso || null;
            const endAt = llmParsed?.event_end_iso || null;
            const meetingProvider =
              llmParsed?.meeting_provider && llmParsed.meeting_provider !== 'none'
                ? llmParsed.meeting_provider
                : null;
            const meetingLink = llmParsed?.meeting_link || null;
            if (startAt) {
              const { data: existingEventMatch } = await admin
                .from('events')
                .select('id, start_at, meeting_link')
                .eq('user_id', user.id)
                .eq('application_id', foundAppId)
                .eq('event_type', llmEventType)
                .order('start_at', { ascending: false })
                .limit(1);
              const existingEvent = existingEventMatch?.[0];
              const existingId = existingEvent?.id ?? null;
              const sameMeetingLink =
                meetingLink && existingEvent?.meeting_link && meetingLink === existingEvent.meeting_link;
              const withinRescheduleWindow = existingEvent?.start_at
                ? Math.abs(new Date(existingEvent.start_at).getTime() - new Date(startAt).getTime()) <
                  1000 * 60 * 60 * 72
                : false;
              if (existingId && (sameMeetingLink || withinRescheduleWindow)) {
                await admin
                  .from('events')
                  .update({
                    title: eventTitle,
                    provider: meetingProvider,
                    meeting_link: meetingLink,
                    start_at: startAt,
                    end_at: endAt,
                    location: llmParsed?.location || null,
                    source_type: 'gmail',
                  })
                  .eq('id', existingId);
              } else {
                const { data: newEvent } = await admin
                  .from('events')
                  .upsert(
                    [{
                      user_id: user.id,
                      application_id: foundAppId,
                      event_type: llmEventType,
                      title: eventTitle,
                      provider: meetingProvider,
                      meeting_link: meetingLink,
                      start_at: startAt,
                      end_at: endAt,
                      location: llmParsed?.location || null,
                      source_type: 'gmail',
                    }],
                    { onConflict: 'user_id,application_id,event_type,start_at' }
                  )
                  .select('id');
                const createdEvent = newEvent?.[0];
                if (createdEvent?.id) {
                  await createNotificationOnce(`event:${createdEvent.id}`, {
                    user_id: user.id,
                    type: 'update',
                    subtype: 'event_created',
                    title: `New event: ${eventTitle}`,
                    body: parsedCompany || null,
                    entity_type: 'event',
                    entity_id: createdEvent.id,
                    metadata: {
                      company: parsedCompany || null,
                      role: parsedRole || null,
                      start_at: startAt,
                    },
                    channel: 'both',
                    priority: 'normal',
                    scheduled_for: syncTimestamp,
                  });
                }
              }
            }
          }

          if (foundAppId && llmConfidence !== null && llmConfidence >= 0.5 && llmParsed?.task_title) {
            const { data: existingTask } = await admin
              .from('tasks')
              .select('id')
              .eq('user_id', user.id)
              .eq('application_id', foundAppId)
              .eq('title', llmParsed.task_title)
              .eq('due_at', llmParsed?.task_due_iso || null)
              .maybeSingle();
            const { data: newTask } = await admin
              .from('tasks')
              .upsert(
                [{
                  user_id: user.id,
                  application_id: foundAppId,
                  title: llmParsed.task_title,
                  due_at: llmParsed?.task_due_iso || null,
                  status: 'open',
                  origin: 'gmail',
                }],
                { onConflict: 'user_id,application_id,title,due_at' }
              )
              .select('id');
            const createdTask = !existingTask ? newTask?.[0] : null;
            if (createdTask?.id) {
              await createNotificationOnce(`task:${createdTask.id}`, {
                user_id: user.id,
                type: 'update',
                subtype: 'task_created',
                title: `New task: ${llmParsed.task_title}`,
                body: parsedCompany || null,
                entity_type: 'task',
                entity_id: createdTask.id,
                metadata: {
                  company: parsedCompany || null,
                  role: parsedRole || null,
                  due_at: llmParsed?.task_due_iso || null,
                },
                channel: 'both',
                priority: 'normal',
                scheduled_for: syncTimestamp,
              });
            }
          }

          if (
            foundAppId &&
            llmConfidence !== null &&
            llmConfidence >= 0.5 &&
            llmParsed?.task_title &&
            llmParsed.task_title.trim().length > 3
          ) {
            const taskTitle = llmParsed.task_title.trim();
            const taskDescription =
              typeof llmParsed?.task_description === 'string' && llmParsed.task_description.trim().length > 3
                ? llmParsed.task_description.trim()
                : null;
            const taskCompleted = typeof llmParsed?.task_completed === 'boolean' ? llmParsed.task_completed : false;
            const { data: taskMatches } = await admin
              .from('tasks')
              .select('id, due_at, title, status, description')
              .eq('user_id', user.id)
              .eq('application_id', foundAppId)
              .ilike('title', taskTitle)
              .order('created_at', { ascending: false })
              .limit(3);
            const dueAt = llmParsed?.task_due_iso || null;
            const existingTask = (taskMatches || []).find((match: {
              id: string;
              due_at: string | null;
              title: string;
              status: string | null;
              description: string | null;
            }) => {
              if (dueAt) {
                return match.due_at === dueAt || !match.due_at;
              }
              return !match.due_at;
            });
            if (existingTask?.id) {
              const nextStatus = taskCompleted ? 'done' : existingTask.status || 'open';
              const updates: Record<string, unknown> = { status: nextStatus };
              if (dueAt && existingTask.due_at !== dueAt) {
                updates.due_at = dueAt;
              }
              if (taskDescription && !existingTask.description) {
                updates.description = taskDescription;
              }
              if (taskCompleted) {
                updates.completed_at = new Date().toISOString();
              }
              await admin.from('tasks').update(updates).eq('id', existingTask.id);
            } else {
              pendingTaskUpserts.push({
                user_id: user.id,
                application_id: foundAppId,
                title: taskTitle,
                description: taskDescription,
                due_at: dueAt,
                status: taskCompleted ? 'done' : 'open',
                completed_at: taskCompleted ? new Date().toISOString() : null,
                origin: 'gmail',
                source_message_id: msg.id,
              });
            }
          }
        } catch (msgErr) {
          console.error('Failed to fetch message', id, msgErr);
        }
      }
      if (pendingEventUpserts.length > 0) {
        await admin
          .from('events')
          .upsert(pendingEventUpserts, { onConflict: 'user_id,application_id,event_type,start_at' });
      }
      if (pendingTaskUpserts.length > 0) {
        await admin
          .from('tasks')
          .upsert(pendingTaskUpserts, { onConflict: 'user_id,application_id,title,due_at' });
      }

      if (syncLogId) {
        const { error: finishError } = await admin
          .from('gmail_sync_logs')
          .update({
            status: 'success',
            finished_at: new Date().toISOString(),
            sync_type: resolvedSyncType,
            total_messages_fetched: totalMessagesFetched,
            job_email_events_created: eventInserted,
            job_email_events_updated: eventUpdated,
            applications_created: appInserted,
            applications_updated: appUpdated,
            messages_processed: messages.length,
          })
          .eq('id', syncLogId);
        if (finishError) {
          console.error('gmail-sync-user failed to finalize sync log', finishError);
        }
      }
      // Update last_synced_at to now or latest message time
      if (connection && !nextPageTokenFromSync && !enrichOnly) {
        const newSyncTime = latestMessageTime || new Date().toISOString();
        await admin
          .from('gmail_connections')
          .update({ last_synced_at: newSyncTime })
          .eq('user_id', user.id)
          .eq('provider', connection.provider || 'google');
      }

      if (isInitialImport) {
        await updateSyncState({
          initial_import_status: 'phase1_done',
          initial_import_progress: 100,
          last_phase1_result_count: appInserted,
          last_sync_summary: `Phase 1 imported ${appInserted} applications.`,
        });
        const enqueueUrl = `${SUPABASE_URL}/functions/v1/gmail-sync-user`;
        try {
          await fetch(enqueueUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ hard_sync: true }),
          });
          await updateSyncState({
            initial_import_status: 'deep_running',
            last_sync_summary: 'Deep sync queued.',
          });
        } catch (enqueueErr) {
          console.error('gmail-sync-user failed to enqueue deep sync', enqueueErr);
        }
      }

      if (isDeepSync && nextPageTokenFromSync) {
        await updateSyncState({
          initial_import_status: 'deep_running',
          last_deep_result_count: appInserted,
          last_sync_summary: 'Deep sync continuing.',
        });
        if ((backfillProcessedCount ?? 0) < DEEP_SYNC_TOTAL_LIMIT) {
          const enqueueUrl = `${SUPABASE_URL}/functions/v1/gmail-sync-user`;
          try {
            await fetch(enqueueUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                hard_sync: true,
                page_token: nextPageTokenFromSync,
                max_messages: maxMessages,
              }),
            });
          } catch (enqueueErr) {
            console.error('gmail-sync-user failed to enqueue deep sync continuation', enqueueErr);
          }
        } else {
          await updateSyncState({
            initial_import_status: 'deep_done',
            last_sync_summary: 'Deep sync stopped at safety limit.',
          });
        }
      }

      if (isDeepSync && !nextPageTokenFromSync) {
        await updateSyncState({
          initial_import_status: 'deep_done',
          last_deep_result_count: appInserted,
          last_sync_summary: `Deep sync added ${appInserted} applications.`,
        });
      }

      return jsonResponse({
        ok: true,
        user_id: user.id,
        email: gmail.email ?? user.email,
        provider: gmail.provider ?? 'google',
        processed: messages.length,
        next_page_token: nextPageTokenFromSync ?? null,
        debug: {
          had_connection: !!connection,
          inserted: appInserted,
          updated: appUpdated,
          eventInserted,
          eventUpdated,
          llm_used: llmCalls,
          max_messages: maxMessages,
          app_results: appResults.slice(0, 10),
        },
      });
    } catch (err: any) {
      if (isInitialImport || isDeepSync) {
        await updateSyncState({
          initial_import_status: 'failed',
          last_sync_summary: err?.message || 'Gmail sync failed',
        });
      }
      if (syncLogId) {
        const { error: finishError } = await admin
          .from('gmail_sync_logs')
          .update({
            status: 'error',
            finished_at: new Date().toISOString(),
            sync_type: resolvedSyncType,
            total_messages_fetched: totalMessagesFetched,
            job_email_events_created: eventInserted,
            job_email_events_updated: eventUpdated,
            applications_created: appInserted,
            applications_updated: appUpdated,
            error_message: err?.message || 'Gmail sync failed',
          })
          .eq('id', syncLogId);
        if (finishError) {
          console.error('gmail-sync-user failed to mark sync error', finishError);
        }
      } else {
        await writeSyncLogError(err?.message || 'Gmail sync failed');
      }
      return jsonResponse({ error: err?.message || 'Gmail sync failed' }, 500);
    }
  } catch (err: any) {
    console.error('gmail-sync-user unhandled error', err);
    return jsonResponse({ error: err?.message || 'Unhandled error' }, 500);
  }
});
