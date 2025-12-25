// Edge function: placeholder Gmail sync entry point
// @ts-nocheck
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
    subject,
    from,
    internalDate: internalTimestamp ? new Date(internalTimestamp).toISOString() : data.internalDate,
    internalTimestamp,
    snippet: data.snippet,
  };
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

    const { data: connectionData, error: connError } = await admin
      .from('gmail_connections')
      .select('user_id,email,refresh_token,provider')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle();
    const connection = connectionData as GmailConnection | null;

    if (connError) {
      return jsonResponse({ error: connError.message }, 500);
    }

    if (!connection) {
      return jsonResponse({ error: 'No Gmail connection found for user' }, 404);
    }

    const gmail = connection as GmailConnection;
    console.log('gmail-sync-user start', {
      user_id: user.id,
      email: gmail.email,
      provider: gmail.provider,
      has_refresh_token: !!gmail.refresh_token,
    });

    if (!gmail.refresh_token) {
      return jsonResponse({ error: 'Missing refresh token for Gmail connection' }, 400);
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken(gmail.refresh_token);
    } catch (err: any) {
      return jsonResponse({ error: err?.message || 'Unable to get Gmail access token' }, 500);
    }

    // Basic job-search query with keywords and common ATS senders
    const query =
      '(subject:application OR subject:interview OR subject:"job offer" OR from:@lever.co OR from:@greenhouse.io OR from:@ashbyhq.com OR from:@workday.com OR from:@myworkday.com)';

    try {
      const ids = await listMessages(accessToken, query, 10);
      const messages: GmailMessage[] = [];
      for (const { id } of ids) {
        try {
          const msg = await fetchMessage(accessToken, id);
          messages.push(msg);
          console.log('gmail-sync-user fetched', {
            id: msg.id,
            subject: msg.subject,
            from: msg.from,
            internalDate: msg.internalDate,
          });
        } catch (msgErr) {
          console.error('Failed to fetch message', id, msgErr);
        }
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
        },
      });
    } catch (err: any) {
      return jsonResponse({ error: err?.message || 'Gmail sync failed' }, 500);
    }
  } catch (err: any) {
    console.error('gmail-sync-user unhandled error', err);
    return jsonResponse({ error: err?.message || 'Unhandled error' }, 500);
  }
});
