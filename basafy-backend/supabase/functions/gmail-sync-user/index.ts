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
  user_id: string;
  email: string | null;
  refresh_token: string | null;
  provider: string | null;
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

async function fetchMessage(accessToken: string, id: string): Promise<GmailMessage> {
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
    const pageTokenFromClient = (requestBody as any)?.page_token || null;
    const seedOnly = Boolean((requestBody as any)?.seed_only);
    const rawMaxMessages = Number((requestBody as any)?.max_messages);
    const defaultMaxMessages = hardSync ? 20 : 25;
    const maxMessages = Number.isFinite(rawMaxMessages) && rawMaxMessages > 0
      ? Math.min(50, Math.floor(rawMaxMessages))
      : defaultMaxMessages;
    const syncStartMs = Date.now();
    const TIME_BUDGET_MS = 110_000;
    const LLM_MAX_PER_SYNC = hardSync ? 0 : 5;
    const LLM_MIN_TIME_REMAINING_MS = 15_000;
    let llmCalls = 0;
    let syncType: "full" | "incremental" = hardSync ? 'full' : 'full';

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
      .select('user_id,email,refresh_token,provider,last_synced_at')
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
        .select('user_id,email,refresh_token,provider')
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
    syncType = hardSync ? 'full' : (connection?.last_synced_at ? 'incremental' : 'full');
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

    // Build Gmail query based on last_synced_at
    let query =
      'in:inbox -category:promotions -category:social -category:forums (is:important OR is:starred) ' +
      '(from:(lever.co OR greenhouse.io OR grnh.se OR ashbyhq.com OR workday.com OR myworkday.com OR successfactors.com OR workable.com OR smartrecruiters.com OR icims.com OR jobvite.com OR taleo.net OR oracle.com OR adp.com OR bamboohr.com OR recruitee.com OR breezy.hr OR rippling.com OR codesignal.com OR hackerrank.com) ' +
      'OR subject:(recruiter OR "talent acquisition" OR "hiring team" OR "hiring manager") ' +
      'OR ("recruiter" OR "talent acquisition" OR "hiring team" OR "hiring manager")) ' +
      '(subject:(application OR interview OR "job offer" OR offer OR "career opportunity" OR "thank you for applying" OR "application received" OR "your application" OR assessment OR "online assessment" OR "coding challenge" OR "take-home" OR "next steps" OR "phone screen" OR onsite OR "background check" OR "reference check") ' +
      'OR ("job application" OR "application received" OR interview OR "career opportunity"))';
    if (hardSync) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 4);
      const afterDate = sixMonthsAgo.toISOString().split('T')[0].replace(/-/g, '/');
      query += ` after:${afterDate}`;
    } else if (connection?.last_synced_at) {
      // Only fetch messages newer than last_synced_at
      const afterDate = new Date(connection.last_synced_at).toISOString().split('T')[0].replace(/-/g, '/');
      query += ` after:${afterDate}`;
    }

    let syncLogId: number | null = null;
    let resolvedSyncType: "full" | "incremental" = syncType;
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
      const pageToken: string | undefined = pageTokenFromClient || undefined;
      const { messages: messageIds, nextPageToken } = await listMessages(accessToken, query, maxMessages, pageToken);
      ids.push(...messageIds);
      nextPageTokenFromSync = nextPageToken;
      totalMessagesFetched = ids.length;
      const messages: GmailMessage[] = [];
      const appResults: Array<{ gmail_message_id: string; action: 'inserted' | 'updated' | 'error'; error?: string }> =
        [];
      let latestMessageTime: string | null = null;
      const syncTimestamp = new Date().toISOString();
      for (const { id } of ids) {
        try {
          const msg = await fetchMessage(accessToken, id);
          messages.push(msg);
          // Track latest message time
          if (msg.internalDate && (!latestMessageTime || msg.internalDate > latestMessageTime)) {
            latestMessageTime = msg.internalDate;
          }
          console.log('gmail-sync-user fetched', {
            id: msg.id,
            subject: msg.subject,
            from: msg.from,
            internalDate: msg.internalDate,
          });

          // prevent duplicates by checking existing application for this message
          const { data: existing, error: existingError } = await admin
            .from('applications')
            .select('id, company, role, role_title, status, source_type')
            .eq('user_id', user.id)
            .eq('gmail_message_id', msg.id)
            .maybeSingle();
          if (existingError) {
            console.error('gmail-sync-user failed to read application', { message_id: msg.id, error: existingError });
            appResults.push({ gmail_message_id: msg.id, action: 'error', error: existingError.message });
            continue;
          }

          const companyGuess = deriveCompany(msg.from, msg.subject) || 'Unknown company';
          const roleGuess = deriveRole(msg.subject) || 'Job application';

          // upsert job_email_events
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

            // Heuristic fallback
            if (!parsed_company || !parsed_role) {
              // Example: "Your application to X for Y"
              const subjectMatch = subject?.match(/Your application to (.+?) for (.+)/i);
              if (subjectMatch) {
                parsed_company = parsed_company || subjectMatch[1];
                parsed_role = parsed_role || subjectMatch[2];
                confidence = Math.max(confidence, 0.98);
              } else if (subject && subject.toLowerCase().includes('application to')) {
                // Fallback: "application to X"
                const fallbackMatch = subject.match(/application to ([^ ]+)/i);
                if (fallbackMatch) {
                  parsed_company = parsed_company || fallbackMatch[1];
                  confidence = Math.max(confidence, 0.9);
                }
              }

              // Domain hint from raw_from
              if (!parsed_company && from) {
                const domainMatch = from.match(/@([a-zA-Z0-9.-]+)\./);
                if (domainMatch) {
                  parsed_company = domainMatch[1];
                  confidence = Math.max(confidence, 0.8);
                }
              }

              // If role still missing, try from subject
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
company, role_title, stage, event_type, event_title, event_start_iso, event_end_iso, meeting_provider, meeting_link, location, task_title, task_due_iso, confidence.
Stage must be one of: applied, assessment, interview, offer, rejected, archived, other.
Event_type must be one of: interview, assessment, deadline, follow_up, none.
Meeting_provider: zoom, google_meet, teams, phone, onsite, none.
If unknown, use null. Confidence is 0-1.
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

          const { data: existingEvent, error: existingEventError } = await admin
            .from('job_email_events')
            .select('id, parsed_company, parsed_role, parsed_status')
            .eq('user_id', user.id)
            .eq('gmail_message_id', msg.id)
            .maybeSingle();
          if (existingEventError) {
            console.error('gmail-sync-user failed to read job_email_event', {
              message_id: msg.id,
              error: existingEventError,
            });
          }

          const classification = classifyJobEmailEvent(msg.subject, msg.from);
          const parsing = await parseCompanyAndRole(msg.subject, msg.from);
          const timeRemaining = TIME_BUDGET_MS - (Date.now() - syncStartMs);
          const shouldUseLlm =
            llmCalls < LLM_MAX_PER_SYNC && timeRemaining > LLM_MIN_TIME_REMAINING_MS;
          const llmParsed = shouldUseLlm
            ? await parseWithLlm({
              subject: msg.subject,
              from: msg.from,
              snippet: msg.snippet ?? null,
              body: msg.bodyText ?? null,
            })
            : null;
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
            }
          } else {
            const { error: insertError } = await admin.from('applications').insert([payload]);
            if (insertError) {
              console.error('gmail-sync-user failed to insert application', { message_id: msg.id, error: insertError });
              appResults.push({ gmail_message_id: msg.id, action: 'error', error: insertError.message });
            } else {
              appInserted += 1;
              appResults.push({ gmail_message_id: msg.id, action: 'inserted' });
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
              .select('id')
              .eq('user_id', user.id)
              .eq('gmail_thread_id', eventRow.gmail_thread_id)
              .maybeSingle();
            if (threadApp?.id) foundAppId = threadApp.id;
          }

          // 2. Try to find by source_type and similar company/role
          if (!foundAppId && eventRow.parsed_company && eventRow.parsed_role) {
            const { data: similarApp } = await admin
              .from('applications')
              .select('id')
              .eq('user_id', user.id)
              .eq('source_type', 'gmail')
              .ilike('company', `%${eventRow.parsed_company}%`)
              .ilike('role', `%${eventRow.parsed_role}%`)
              .maybeSingle();
            if (similarApp?.id) foundAppId = similarApp.id;
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
              await admin
                .from('applications')
                .update({ status: newStatus, last_synced_at: syncTimestamp })
                .eq('id', foundAppId);
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
                .select('id')
                .maybeSingle();
              if (newApp?.id) {
                await admin
                  .from('job_email_events')
                  .update({ application_id: newApp.id })
                  .eq('id', eventRow.id);
                foundAppId = newApp.id;
              }
            }
          }

          if (foundAppId && parsedStatus && llmConfidence !== null && llmConfidence >= 0.5) {
            await admin
              .from('applications')
              .update({ status: parsedStatus, last_synced_at: syncTimestamp })
              .eq('id', foundAppId);
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
                await admin
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
                  );
              }
            }
          }

          if (foundAppId && llmConfidence !== null && llmConfidence >= 0.5 && llmParsed?.task_title) {
            const taskTitle = llmParsed.task_title.trim();
            if (taskTitle) {
              const { data: taskMatches } = await admin
                .from('tasks')
                .select('id, due_at, title')
                .eq('user_id', user.id)
                .eq('application_id', foundAppId)
                .eq('status', 'open')
                .ilike('title', taskTitle)
                .order('created_at', { ascending: false })
                .limit(3);
              const dueAt = llmParsed?.task_due_iso || null;
              const existingTask = (taskMatches || []).find((match) => {
                if (dueAt) {
                  return match.due_at === dueAt || !match.due_at;
                }
                return !match.due_at;
              });
              if (existingTask?.id) {
                if (dueAt && existingTask.due_at !== dueAt) {
                  await admin.from('tasks').update({ due_at: dueAt }).eq('id', existingTask.id);
                }
              } else {
                await admin
                  .from('tasks')
                  .upsert(
                    [{
                      user_id: user.id,
                      application_id: foundAppId,
                      title: taskTitle,
                      due_at: dueAt,
                      status: 'open',
                      origin: 'gmail',
                    }],
                    { onConflict: 'user_id,application_id,title,due_at' }
                  );
              }
            }
          }
        } catch (msgErr) {
          console.error('Failed to fetch message', id, msgErr);
        }
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
      if (connection) {
        const newSyncTime = latestMessageTime || new Date().toISOString();
        await admin
          .from('gmail_connections')
          .update({ last_synced_at: newSyncTime })
          .eq('user_id', user.id)
          .eq('provider', connection.provider || 'google');
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
