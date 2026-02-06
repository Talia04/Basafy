// Edge function: send push notifications on notification inserts (webhook)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import {
  validateWebhookPayload,
  normalizeSettings,
  type ValidatedWebhookPayload,
  type ValidatedUserSettings,
} from './validation.ts';

const SUPABASE_URL = Deno.env.get('PROJECT_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Type aliases for cleaner code (now using validated types from validation.ts)
type NotificationRecord = ValidatedWebhookPayload['record'];
type SettingsRow = ValidatedUserSettings;

serve(async (req: Request) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EXPO_ACCESS_TOKEN) {
      return jsonResponse({ error: 'Service misconfigured' }, 500);
    }

    // Parse and validate webhook payload
    const rawPayload = await req.json().catch(() => null);
    const validationResult = validateWebhookPayload(rawPayload);

    if (!validationResult.success) {
      console.warn('notifications-push invalid payload', { error: validationResult.error });
      return jsonResponse({ error: validationResult.error }, 400);
    }

    const payload = validationResult.data;
    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      return jsonResponse({ ok: true, skipped: true });
    }

    const record = payload.record;
    if (!record?.user_id || !record.id) {
      return jsonResponse({ ok: true, skipped: true });
    }

    if (record.channel !== 'push' && record.channel !== 'both') {
      return jsonResponse({ ok: true, skipped: true });
    }

    if (record.delivered_at) {
      return jsonResponse({ ok: true, skipped: true });
    }

    if (record.scheduled_for) {
      const scheduled = new Date(record.scheduled_for);
      if (!Number.isNaN(scheduled.getTime()) && scheduled.getTime() > Date.now()) {
        return jsonResponse({ ok: true, skipped: true });
      }
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: settings } = await admin
      .from('user_notification_settings')
      .select(
        'user_id, push_enabled, updates_enabled, reminders_enabled, event_reminder_24h, event_reminder_2h, event_reminder_15m, task_due_enabled, task_overdue_enabled'
      )
      .eq('user_id', record.user_id)
      .maybeSingle();

    const s = normalizeSettings(settings as Partial<SettingsRow> | null);
    if (!s || !s.push_enabled) {
      return jsonResponse({ ok: true, skipped: true });
    }

    if (record.type === 'reminder') {
      if (!s.reminders_enabled) return jsonResponse({ ok: true, skipped: true });
      if (record.subtype === 'event_reminder_24h' && !s.event_reminder_24h) return jsonResponse({ ok: true, skipped: true });
      if (record.subtype === 'event_reminder_2h' && !s.event_reminder_2h) return jsonResponse({ ok: true, skipped: true });
      if (record.subtype === 'event_reminder_15m' && !s.event_reminder_15m) return jsonResponse({ ok: true, skipped: true });
      if (record.subtype === 'task_due' && !s.task_due_enabled) return jsonResponse({ ok: true, skipped: true });
      if (record.subtype === 'task_overdue' && !s.task_overdue_enabled) return jsonResponse({ ok: true, skipped: true });
    }
    if (record.type === 'update' && !s.updates_enabled) {
      return jsonResponse({ ok: true, skipped: true });
    }

    if (record.type === 'update' && record.entity_type === 'application' && record.entity_id) {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const { data: deliveredUpdates, error: deliveredError } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', record.user_id)
        .eq('type', 'update')
        .eq('entity_type', 'application')
        .eq('entity_id', record.entity_id)
        .gte('delivered_at', dayStart.toISOString())
        .not('delivered_at', 'is', null)
        .limit(1);
      if (deliveredError) {
        console.error('notifications-push throttle lookup failed', deliveredError);
        return jsonResponse({ error: deliveredError.message }, 500);
      }
      if (deliveredUpdates && deliveredUpdates.length > 0) {
        await admin
          .from('notifications')
          .update({ delivered_at: new Date().toISOString() })
          .eq('id', record.id);
        return jsonResponse({ ok: true, skipped: true, throttled: true });
      }
    }

    const { data: devices, error: devicesError } = await admin
      .from('user_devices')
      .select('expo_push_token')
      .eq('user_id', record.user_id)
      .eq('notifications_enabled', true)
      .not('expo_push_token', 'is', null);
    if (devicesError) {
      console.error('notifications-push devicesError', devicesError);
      return jsonResponse({ error: devicesError.message }, 500);
    }

    const tokens = (devices || []).map((d: any) => d.expo_push_token).filter(Boolean);
    if (tokens.length === 0) {
      return jsonResponse({ ok: true, skipped: true });
    }

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: record.title,
      body: record.body || undefined,
      data: {
        notification_id: record.id,
        type: record.type,
        subtype: record.subtype,
        entity_type: record.entity_type,
        entity_id: record.entity_id,
      },
    }));

    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EXPO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(messages),
    });

    const responseText = await resp.text();
    console.log('notifications-push expo response', responseText);
    if (!resp.ok) {
      console.error('notifications-push send failed', responseText);
      return jsonResponse({ error: 'Push send failed', details: responseText }, 500);
    }

    await admin
      .from('notifications')
      .update({ delivered_at: new Date().toISOString() })
      .eq('id', record.id);

    return jsonResponse({ ok: true, sent: messages.length, expo: responseText });
  } catch (err: any) {
    console.error('notifications-push unhandled error', err);
    return jsonResponse({ error: err?.message || 'Unhandled error' }, 500);
  }
});
