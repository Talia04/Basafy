/* @ts-ignore */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
/* @ts-ignore */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
  getGmailPushSecret,
} from '../_shared/secrets.ts';

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const SUPABASE_SERVICE_ROLE_KEY = getSupabaseServiceRoleKey();
const GMAIL_PUSH_SECRET = getGmailPushSecret();

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-push-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: JSON_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !GMAIL_PUSH_SECRET) {
    return jsonResponse({ error: 'Service misconfigured' }, 500);
  }

  const pushSecret = req.headers.get('X-Push-Secret');
  if (pushSecret !== GMAIL_PUSH_SECRET) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  const rawBody = await req.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(Number((rawBody as any)?.limit ?? 25), 100));
  const concurrency = Math.max(1, Math.min(Number((rawBody as any)?.concurrency ?? 3), 10));
  const cutoffIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: connections, error } = await admin
    .from('gmail_connections')
    .select('user_id, email, last_synced_at, refresh_token')
    .eq('provider', 'google')
    .not('refresh_token', 'is', null)
    .neq('refresh_token', 'mock')
    .neq('email', 'reviewer@basafy.app')
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoffIso}`)
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error('[gmail-sync-cron] failed to load connections', error);
    return jsonResponse({ error: error.message }, 500);
  }

  const rows = connections ?? [];
  if (rows.length === 0) {
    return jsonResponse({ ok: true, scanned: 0, triggered: 0, results: [] });
  }

  const syncUrl = `${SUPABASE_URL}/functions/v1/gmail-sync-user`;
  const results: Array<Record<string, unknown>> = [];

  for (const batch of chunk(rows, concurrency)) {
    const batchResults = await Promise.all(
      batch.map(async (row: any) => {
        try {
          const resp = await fetch(syncUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              'X-Push-Secret': GMAIL_PUSH_SECRET,
            },
            body: JSON.stringify({
              user_id: row.user_id,
              mode: 'scheduled_poll',
            }),
          });
          const body = await resp.json().catch(() => ({}));
          return {
            user_id: row.user_id,
            email: row.email ?? null,
            status: resp.status,
            ok: resp.ok && body?.ok !== false,
            body,
          };
        } catch (err) {
          return {
            user_id: row.user_id,
            email: row.email ?? null,
            status: 0,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
    results.push(...batchResults);
  }

  const triggered = results.filter((r) => r.ok).length;
  const failed = results.length - triggered;

  console.info('[gmail-sync-cron] completed', {
    scanned: rows.length,
    triggered,
    failed,
  });

  return jsonResponse({
    ok: true,
    scanned: rows.length,
    triggered,
    failed,
    results,
  });
});
