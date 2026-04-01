/* @ts-ignore – Deno remote imports */
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
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function ok(body: unknown = { ok: true }) {
    return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
}

function err(msg: string, status = 400) {
    return new Response(JSON.stringify({ error: msg }), { status, headers: JSON_HEADERS });
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: JSON_HEADERS });
    if (req.method !== 'POST') return err('Method not allowed', 405);

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('[gmail-push-handler] Service misconfigured — missing Supabase env vars');
        return ok(); // Return 200 so PubSub doesn't retry infinitely
    }

    // ── 1. Decode PubSub notification ──────────────────────────────────────────
    let notification: any;
    try {
        notification = await req.json();
    } catch {
        return ok(); // Malformed body — ack to prevent PubSub retries
    }

    const rawData = notification?.message?.data;
    if (!rawData) {
        console.warn('[gmail-push-handler] Missing message.data in PubSub notification');
        return ok();
    }

    let payload: { emailAddress?: string; historyId?: string | number };
    try {
        // PubSub data is base64url-encoded JSON
        const decoded = atob(rawData.replace(/-/g, '+').replace(/_/g, '/'));
        payload = JSON.parse(decoded);
    } catch (e) {
        console.warn('[gmail-push-handler] Failed to decode PubSub payload', e);
        return ok();
    }

    const emailAddress = payload.emailAddress?.toLowerCase();
    const historyId = payload.historyId ? String(payload.historyId) : null;

    if (!emailAddress || !historyId) {
        console.warn('[gmail-push-handler] Missing emailAddress or historyId', { payload });
        return ok();
    }

    console.info('[gmail-push-handler] received', { emailAddress, historyId });

    // ── 2. Look up the user by email ───────────────────────────────────────────
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conn } = await admin
        .from('gmail_connections')
        .select('user_id, last_history_id, watch_expiry')
        .eq('email', emailAddress)
        .maybeSingle();

    if (!conn?.user_id) {
        console.warn('[gmail-push-handler] No connection found for email', { emailAddress });
        return ok(); // Ack — we don't know this user
    }

    // ── 3. Dedup: skip if we've already processed this or a later historyId ────
    if (conn.last_history_id && BigInt(historyId) <= BigInt(conn.last_history_id)) {
        console.info('[gmail-push-handler] skipping duplicate historyId', {
            incoming: historyId,
            stored: conn.last_history_id,
        });
        return ok();
    }

    // ── 4. Check watch is still valid ─────────────────────────────────────────
    if (conn.watch_expiry && Date.now() > conn.watch_expiry) {
        console.warn('[gmail-push-handler] watch expired for user', { user_id: conn.user_id });
        // Still process — but client should renew soon
    }

    // ── 5. Fire-and-forget: call gmail-sync-user with internal secret ──────────
    // Respond to PubSub immediately so it doesn't retry, then do the sync async.
    if (!GMAIL_PUSH_SECRET) {
        console.error('[gmail-push-handler] GMAIL_PUSH_SECRET not set — cannot trigger sync');
        return ok();
    }

    const syncUrl = `${SUPABASE_URL}/functions/v1/gmail-sync-user`;

    // @ts-ignore – Deno EdgeRuntime.waitUntil available in Supabase edge runtime
    const waitUntil = (typeof EdgeRuntime !== 'undefined')
        ? (p: Promise<unknown>) => EdgeRuntime.waitUntil(p)
        : (p: Promise<unknown>) => p; // fallback: await synchronously

    const syncPromise = fetch(syncUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'X-Push-Secret': GMAIL_PUSH_SECRET,
        },
        body: JSON.stringify({
            user_id: conn.user_id,
            since_history_id: historyId,
        }),
    }).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        console.info('[gmail-push-handler] sync triggered', {
            user_id: conn.user_id,
            status: r.status,
            result: body,
        });
    }).catch((e) => {
        console.error('[gmail-push-handler] sync call failed', { user_id: conn.user_id, error: String(e) });
    });

    waitUntil(syncPromise);

    return ok({ ok: true, user_id: conn.user_id, history_id: historyId });
});
