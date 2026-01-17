// Edge function: deliver push notifications for scheduled notifications
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const SUPABASE_URL = Deno.env.get('PROJECT_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  subtype: string | null;
  entity_type: string | null;
  entity_id: string | null;
};

type DeviceRow = {
  user_id: string;
  expo_push_token: string;
  notifications_enabled: boolean;
};

type SettingsRow = {
  user_id: string;
  push_enabled: boolean;
  updates_enabled: boolean;
  reminders_enabled: boolean;
  event_reminder_24h: boolean;
  event_reminder_2h: boolean;
  event_reminder_15m: boolean;
  task_due_enabled: boolean;
  task_overdue_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

function normalizeSettings(raw: Partial<SettingsRow> | null): SettingsRow | null {
  if (!raw) return null;
  return {
    user_id: raw.user_id ?? '',
    push_enabled: raw.push_enabled ?? false,
    updates_enabled: raw.updates_enabled ?? true,
    reminders_enabled: raw.reminders_enabled ?? true,
    event_reminder_24h: raw.event_reminder_24h ?? true,
    event_reminder_2h: raw.event_reminder_2h ?? true,
    event_reminder_15m: raw.event_reminder_15m ?? false,
    task_due_enabled: raw.task_due_enabled ?? true,
    task_overdue_enabled: raw.task_overdue_enabled ?? false,
    quiet_hours_start: raw.quiet_hours_start ?? null,
    quiet_hours_end: raw.quiet_hours_end ?? null,
  };
}

serve(async () => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Service misconfigured' }, 500);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    const { data: notifications, error: notificationsError } = await admin
      .from('notifications')
      .select('id, user_id, title, body, type, subtype, entity_type, entity_id')
      .lte('scheduled_for', now.toISOString())
      .is('delivered_at', null)
      .in('channel', ['push', 'both'])
      .limit(200);
    if (notificationsError) {
      console.error('notifications-push-delivery notificationsError', notificationsError);
      return jsonResponse({ error: notificationsError.message }, 500);
    }

    const rows = (notifications as NotificationRow[]) || [];
    if (rows.length === 0) {
      return jsonResponse({ ok: true, sent: 0 });
    }

    const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
    const { data: settingsRows, error: settingsError } = await admin
      .from('user_notification_settings')
      .select(
        'user_id, push_enabled, updates_enabled, reminders_enabled, event_reminder_24h, event_reminder_2h, event_reminder_15m, task_due_enabled, task_overdue_enabled, quiet_hours_start, quiet_hours_end'
      )
      .in('user_id', userIds);
    if (settingsError) {
      console.error('notifications-push-delivery settingsError', settingsError);
      return jsonResponse({ error: settingsError.message }, 500);
    }
    const settingsByUser = new Map<string, SettingsRow>();
    for (const row of (settingsRows as SettingsRow[]) || []) {
      settingsByUser.set(row.user_id, row);
    }

    const { data: devices, error: devicesError } = await admin
      .from('user_devices')
      .select('user_id, expo_push_token, notifications_enabled')
      .in('user_id', userIds)
      .eq('notifications_enabled', true)
      .not('expo_push_token', 'is', null);
    if (devicesError) {
      console.error('notifications-push-delivery devicesError', devicesError);
      return jsonResponse({ error: devicesError.message }, 500);
    }

    const devicesByUser = new Map<string, DeviceRow[]>();
    for (const device of (devices as DeviceRow[]) || []) {
      const list = devicesByUser.get(device.user_id) || [];
      list.push(device);
      devicesByUser.set(device.user_id, list);
    }

    const updateEntityIds = rows
      .filter((row) => row.type === 'update' && row.entity_type === 'application' && row.entity_id)
      .map((row) => row.entity_id as string);
    const throttledEntityIds = new Set<string>();
    if (updateEntityIds.length > 0) {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const { data: deliveredUpdates, error: deliveredError } = await admin
        .from('notifications')
        .select('entity_id')
        .eq('type', 'update')
        .eq('entity_type', 'application')
        .in('entity_id', updateEntityIds)
        .gte('delivered_at', dayStart.toISOString())
        .not('delivered_at', 'is', null);
      if (deliveredError) {
        console.error('notifications-push-delivery throttle lookup failed', deliveredError);
        return jsonResponse({ error: deliveredError.message }, 500);
      }
      for (const row of deliveredUpdates || []) {
        if (row.entity_id) {
          throttledEntityIds.add(row.entity_id as string);
        }
      }
    }

    const messages: Array<Record<string, unknown>> = [];
    const notificationIdsToMark: string[] = [];
    const notificationIdsToSuppress: string[] = [];
    for (const row of rows) {
      const settings = normalizeSettings(settingsByUser.get(row.user_id) ?? null);
      if (!settings || !settings.push_enabled) continue;
      if (isWithinQuietHours(now, settings.quiet_hours_start, settings.quiet_hours_end)) continue;

      if (row.type === 'reminder') {
        if (!settings.reminders_enabled) continue;
        if (row.subtype === 'event_reminder_24h' && !settings.event_reminder_24h) continue;
        if (row.subtype === 'event_reminder_2h' && !settings.event_reminder_2h) continue;
        if (row.subtype === 'event_reminder_15m' && !settings.event_reminder_15m) continue;
        if (row.subtype === 'task_due' && !settings.task_due_enabled) continue;
        if (row.subtype === 'task_overdue' && !settings.task_overdue_enabled) continue;
      }

      if (row.type === 'update' && !settings.updates_enabled) continue;
      if (
        row.type === 'update' &&
        row.entity_type === 'application' &&
        row.entity_id &&
        throttledEntityIds.has(row.entity_id)
      ) {
        notificationIdsToSuppress.push(row.id);
        continue;
      }

      const deviceList = devicesByUser.get(row.user_id) || [];
      if (deviceList.length === 0) continue;

      for (const device of deviceList) {
        messages.push({
          to: device.expo_push_token,
          title: row.title,
          body: row.body || undefined,
          data: {
            notification_id: row.id,
            type: row.type,
            subtype: row.subtype,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
          },
          sound: 'default',
        });
      }
      notificationIdsToMark.push(row.id);
    }

    if (messages.length === 0) {
      return jsonResponse({ ok: true, sent: 0 });
    }

    const chunks = chunk(messages, 100);
    for (const payload of chunks) {
      const resp = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const body = await resp.text();
        console.error('notifications-push-delivery send failed', body);
      }
    }

    if (notificationIdsToMark.length > 0) {
      const { error: markError } = await admin
        .from('notifications')
        .update({ delivered_at: now.toISOString() })
        .in('id', notificationIdsToMark);
      if (markError) {
        console.error('notifications-push-delivery markError', markError);
      }
    }
    if (notificationIdsToSuppress.length > 0) {
      const { error: suppressError } = await admin
        .from('notifications')
        .update({ delivered_at: now.toISOString() })
        .in('id', notificationIdsToSuppress);
      if (suppressError) {
        console.error('notifications-push-delivery suppressError', suppressError);
      }
    }

    return jsonResponse({ ok: true, sent: messages.length });
  } catch (err: any) {
    console.error('notifications-push-delivery unhandled error', err);
    return jsonResponse({ error: err?.message || 'Unhandled error' }, 500);
  }
});

function chunk<T>(arr: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function isWithinQuietHours(now: Date, start: string | null, end: string | null) {
  if (!start || !end) return false;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  if (Number.isNaN(startH) || Number.isNaN(startM) || Number.isNaN(endH) || Number.isNaN(endM)) {
    return false;
  }
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}
