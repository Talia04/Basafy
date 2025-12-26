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

async function listMessages(accessToken: string, query: string, maxResults = 10) {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(maxResults));
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || 'Failed to list Gmail messages');
  }
  return (data.messages || []) as { id: string }[];
}

async function fetchMessage(accessToken: string, id: string): Promise<GmailMessage> {
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
    const incomingRefresh = (requestBody as any)?.refresh_token || null;
    const incomingEmail = (requestBody as any)?.email || user.email || null;

    const { data: connectionData, error: connError } = await admin
      .from('gmail_connections')
      .select('user_id,email,refresh_token,provider,last_synced_at')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle();
    let connection = connectionData as (GmailConnection & { last_synced_at?: string | null }) | null;

    if (connError) {
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
      console.warn('gmail-sync-user no connection found', { user_id: user.id });
      return jsonResponse({ error: 'No Gmail connection found for user' }, 404);
    }

    const gmail = connection as GmailConnection;
    console.log('gmail-sync-user start', {
      user_id: user.id,
      email: gmail.email,
      provider: gmail.provider,
      has_refresh_token: !!gmail.refresh_token,
      incoming_refresh: !!incomingRefresh,
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

    if (!gmail.refresh_token) {
      console.warn('gmail-sync-user missing refresh token', { user_id: user.id, provider: gmail.provider });
      return jsonResponse({ error: 'Missing refresh token for Gmail connection' }, 400);
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken(gmail.refresh_token);
    } catch (err: any) {
      return jsonResponse({ error: err?.message || 'Unable to get Gmail access token' }, 500);
    }

    // Build Gmail query based on last_synced_at
    let query =
      '(subject:application OR subject:interview OR subject:"job offer" OR from:@lever.co OR from:@greenhouse.io OR from:@ashbyhq.com OR from:@workday.com OR from:@myworkday.com)';
    if (connection?.last_synced_at) {
      // Only fetch messages newer than last_synced_at
      const afterDate = new Date(connection.last_synced_at).toISOString().split('T')[0].replace(/-/g, '/');
      query += ` after:${afterDate}`;
    }

    let syncLogId: number | null = null;

    try {
      // create sync log entry
      const { data: syncLog, error: logError } = await admin
        .from('gmail_sync_logs')
        .insert([{ user_id: user.id, status: 'running' }])
        .select('id')
        .maybeSingle();
      if (logError) {
        console.error('gmail-sync-user failed to create sync log', logError);
      } else {
        syncLogId = (syncLog as any)?.id ?? null;
      }

      const ids = await listMessages(accessToken, query, 10);
      const messages: GmailMessage[] = [];
      let inserted = 0;
      let updated = 0;
      const appResults: Array<{ gmail_message_id: string; action: 'inserted' | 'updated' | 'error'; error?: string }> =
        [];
      let eventInserted = 0;
      let eventUpdated = 0;
      let latestMessageTime: string | null = null;
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
            .select('id, company, role, source_type')
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

          const payload = {
            user_id: user.id,
            company: existing?.company || companyGuess,
            role: existing?.role || roleGuess,
            source_type: 'gmail',
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId ?? null,
            email_snippet: msg.snippet ?? null,
          };

          if (existing?.id) {
            const { error: updateError } = await admin.from('applications').update(payload).eq('id', existing.id);
            if (updateError) {
              console.error('gmail-sync-user failed to update application', { id: existing.id, error: updateError });
              appResults.push({ gmail_message_id: msg.id, action: 'error', error: updateError.message });
            } else {
              updated += 1;
              appResults.push({ gmail_message_id: msg.id, action: 'updated' });
            }
          } else {
            const { error: insertError } = await admin.from('applications').insert([payload]);
            if (insertError) {
              console.error('gmail-sync-user failed to insert application', { message_id: msg.id, error: insertError });
              appResults.push({ gmail_message_id: msg.id, action: 'error', error: insertError.message });
            } else {
              inserted += 1;
              appResults.push({ gmail_message_id: msg.id, action: 'inserted' });
            }
          }

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

            // Try OpenAI LLM first
            try {
              const apiKey = Deno.env.get('OPENAI_API_KEY');
              const prompt = `Extract the company and role from this email subject and sender. If not clear, return null. Respond as JSON: {"company": "...", "role": "..."}\nSubject: ${subject}\nFrom: ${from}`;
              const resp = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                  model: "gpt-3.5-turbo",
                  messages: [{ role: "user", content: prompt }],
                  max_tokens: 50,
                  temperature: 0,
                }),
              });
              const data = await resp.json();
              if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                const json = JSON.parse(data.choices[0].message.content.trim());
                if (json.company) {
                  parsed_company = json.company;
                  confidence = 0.99;
                }
                if (json.role) {
                  parsed_role = json.role;
                  confidence = 0.99;
                }
              }
            } catch (e) {
              // Ignore LLM errors, fallback to heuristics
            }

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

          const classification = classifyJobEmailEvent(msg.subject, msg.from);
          const parsing = await parseCompanyAndRole(msg.subject, msg.from);

          const eventPayload = {
            user_id: user.id,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId ?? null,
            raw_subject: msg.subject ?? null,
            raw_from: msg.from ?? null,
            raw_snippet: msg.snippet ?? null,
            received_at: receivedAt,
            event_type: classification.event_type,
            confidence: Math.max(classification.confidence, parsing.confidence),
            parsed_company: parsing.parsed_company,
            parsed_role: parsing.parsed_role,
          };

          const { data: existingEvent, error: existingEventError } = await admin
            .from('job_email_events')
            .select('id')
            .eq('user_id', user.id)
            .eq('gmail_message_id', msg.id)
            .maybeSingle();
          if (existingEventError) {
            console.error('gmail-sync-user failed to read job_email_event', {
              message_id: msg.id,
              error: existingEventError,
            });
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
          let foundAppId: number | null = null;

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
                .update({ status: newStatus })
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
                  source_type: 'gmail',
                  gmail_message_id: msg.id,
                  gmail_thread_id: msg.threadId ?? null,
                  email_snippet: msg.snippet ?? null,
                  status: 'Applied'
                }])
                .select('id')
                .maybeSingle();
              if (newApp?.id) {
                await admin
                  .from('job_email_events')
                  .update({ application_id: newApp.id })
                  .eq('id', eventRow.id);
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
        messages,
        debug: {
          had_connection: !!connection,
          inserted,
          updated,
          eventInserted,
          eventUpdated,
          app_results: appResults,
        },
      });
    } catch (err: any) {
      if (syncLogId) {
        const { error: finishError } = await admin
          .from('gmail_sync_logs')
          .update({
            status: 'error',
            finished_at: new Date().toISOString(),
            error_message: err?.message || 'Gmail sync failed',
          })
          .eq('id', syncLogId);
        if (finishError) {
          console.error('gmail-sync-user failed to mark sync error', finishError);
        }
      }
      return jsonResponse({ error: err?.message || 'Gmail sync failed' }, 500);
    }
  } catch (err: any) {
    console.error('gmail-sync-user unhandled error', err);
    return jsonResponse({ error: err?.message || 'Unhandled error' }, 500);
  }
});
