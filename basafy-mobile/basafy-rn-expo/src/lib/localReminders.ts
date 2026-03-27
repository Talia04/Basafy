/**
 * Local reminder scheduling for events and tasks.
 *
 * scheduleAllReminders() should be called:
 *  - on app launch (when the user reaches the main flow)
 *  - after any Gmail sync (foreground auto-sync, manual sync from Profile)
 *  - after background sync completes with new data
 *
 * It cancels stale reminders stored in AsyncStorage, then queries the DB and
 * schedules fresh ones, respecting user_notification_settings.
 * Safe to call from background task context.
 */
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@backend/supabase/client';

const SCHEDULED_IDS_KEY = 'basafy:scheduled-reminder-ids';
// How far ahead to look for events
const EVENT_LOOKAHEAD_MS = 14 * 24 * 60 * 60 * 1000;

type ReminderSettings = {
  reminders_enabled: boolean;
  event_reminder_24h: boolean;
  event_reminder_2h: boolean;
  event_reminder_15m: boolean;
  task_due_enabled: boolean;
  task_overdue_enabled: boolean;
};

const DEFAULTS: ReminderSettings = {
  reminders_enabled: true,
  event_reminder_24h: true,
  event_reminder_2h: true,
  event_reminder_15m: false,
  task_due_enabled: true,
  task_overdue_enabled: false,
};

async function loadSettings(): Promise<ReminderSettings> {
  try {
    const { data } = await supabase
      .from('user_notification_settings')
      .select(
        'reminders_enabled,event_reminder_24h,event_reminder_2h,event_reminder_15m,task_due_enabled,task_overdue_enabled'
      )
      .maybeSingle();
    if (!data) return DEFAULTS;
    return {
      reminders_enabled: data.reminders_enabled ?? DEFAULTS.reminders_enabled,
      event_reminder_24h: data.event_reminder_24h ?? DEFAULTS.event_reminder_24h,
      event_reminder_2h: data.event_reminder_2h ?? DEFAULTS.event_reminder_2h,
      event_reminder_15m: data.event_reminder_15m ?? DEFAULTS.event_reminder_15m,
      task_due_enabled: data.task_due_enabled ?? DEFAULTS.task_due_enabled,
      task_overdue_enabled: data.task_overdue_enabled ?? DEFAULTS.task_overdue_enabled,
    };
  } catch {
    return DEFAULTS;
  }
}

async function cancelStored(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    await Promise.all(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
    );
  } catch {}
  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, '[]').catch(() => {});
}

async function scheduleOne(
  id: string,
  title: string,
  body: string,
  at: Date,
  data: Record<string, unknown>
): Promise<string | null> {
  if (at.getTime() <= Date.now()) return null;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, data, sound: true },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: at },
    });
    return id;
  } catch {
    return null;
  }
}

export async function scheduleAllReminders(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const settings = await loadSettings();
    // Always cancel stale reminders first, even if we're about to return early
    await cancelStored();
    if (!settings.reminders_enabled) return;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const cutoffIso = new Date(now + EVENT_LOOKAHEAD_MS).toISOString();
    const scheduled: string[] = [];

    // ── Events ────────────────────────────────────────────────────────────────
    const { data: events } = await supabase
      .from('events')
      .select('id, title, event_type, start_at, application_id')
      .gt('start_at', nowIso)
      .lte('start_at', cutoffIso)
      .order('start_at', { ascending: true });

    for (const ev of events ?? []) {
      const startMs = new Date(ev.start_at).getTime();
      const label =
        ev.event_type === 'interview'
          ? 'Interview'
          : ev.event_type === 'assessment'
          ? 'Assessment'
          : 'Event';
      const payload = {
        entity_type: 'event',
        entity_id: ev.id,
        application_id: ev.application_id ?? null,
      };

      if (settings.event_reminder_24h) {
        const id = await scheduleOne(
          `event-${ev.id}-24h`,
          `${label} tomorrow`,
          ev.title,
          new Date(startMs - 24 * 60 * 60 * 1000),
          payload
        );
        if (id) scheduled.push(id);
      }
      if (settings.event_reminder_2h) {
        const id = await scheduleOne(
          `event-${ev.id}-2h`,
          `${label} in 2 hours`,
          ev.title,
          new Date(startMs - 2 * 60 * 60 * 1000),
          payload
        );
        if (id) scheduled.push(id);
      }
      if (settings.event_reminder_15m) {
        const id = await scheduleOne(
          `event-${ev.id}-15m`,
          `${label} in 15 minutes`,
          ev.title,
          new Date(startMs - 15 * 60 * 1000),
          payload
        );
        if (id) scheduled.push(id);
      }
    }

    // ── Tasks ─────────────────────────────────────────────────────────────────
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, due_at, application_id')
      .eq('status', 'open')
      .not('due_at', 'is', null)
      .gt('due_at', nowIso)
      .order('due_at', { ascending: true });

    for (const task of tasks ?? []) {
      const dueMs = new Date(task.due_at as string).getTime();
      const payload = {
        entity_type: 'task',
        entity_id: task.id,
        application_id: task.application_id ?? null,
      };

      if (settings.task_due_enabled) {
        // Prefer 8am on the due date; fall back to 1h before due if 8am already passed
        const morning = new Date(task.due_at as string);
        morning.setHours(8, 0, 0, 0);
        const triggerAt = morning.getTime() > now ? morning : new Date(dueMs - 60 * 60 * 1000);
        const id = await scheduleOne(
          `task-due-${task.id}`,
          'Task due today',
          task.title,
          triggerAt,
          payload
        );
        if (id) scheduled.push(id);
      }
      if (settings.task_overdue_enabled) {
        // 9am the day after the due date
        const nextDay = new Date(task.due_at as string);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(9, 0, 0, 0);
        const id = await scheduleOne(
          `task-overdue-${task.id}`,
          'Task overdue',
          task.title,
          nextDay,
          payload
        );
        if (id) scheduled.push(id);
      }
    }

    await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(scheduled)).catch(() => {});
  } catch (err) {
    console.warn('[localReminders] scheduleAllReminders failed:', err);
  }
}

export async function cancelAllReminders(): Promise<void> {
  await cancelStored();
}
