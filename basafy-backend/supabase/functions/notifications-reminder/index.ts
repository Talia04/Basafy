// Edge function: scheduled reminders for events and tasks
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const SUPABASE_URL = Deno.env.get('PROJECT_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

type SettingsRow = {
  user_id: string;
  reminders_enabled: boolean;
  event_reminder_24h: boolean;
  event_reminder_2h: boolean;
  event_reminder_15m: boolean;
  task_due_enabled: boolean;
  task_overdue_enabled: boolean;
};

type EventRow = {
  id: string;
  user_id: string;
  application_id: string | null;
  title: string;
  start_at: string;
};

type TaskRow = {
  id: string;
  user_id: string;
  application_id: string | null;
  title: string;
  due_at: string | null;
  status: string;
};

serve(async () => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Service misconfigured' }, 500);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const windowMinutes = 15;
    const windowMs = windowMinutes * 60 * 1000;
    const cutoffIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: settingsRows, error: settingsError } = await admin
      .from('user_notification_settings')
      .select(
        'user_id, reminders_enabled, event_reminder_24h, event_reminder_2h, event_reminder_15m, task_due_enabled, task_overdue_enabled'
      )
      .eq('reminders_enabled', true);
    if (settingsError) {
      console.error('notifications-reminder settingsError', settingsError);
      return jsonResponse({ error: settingsError.message }, 500);
    }

    const settingsByUser = new Map<string, SettingsRow>();
    for (const row of (settingsRows as SettingsRow[]) || []) {
      settingsByUser.set(row.user_id, row);
    }
    const userIds = Array.from(settingsByUser.keys());
    if (userIds.length === 0) {
      return jsonResponse({ ok: true, created: 0 });
    }

    const eventWindows = [
      { key: 'event_reminder_24h', hours: 24, enabled: (s: SettingsRow) => s.event_reminder_24h },
      { key: 'event_reminder_2h', hours: 2, enabled: (s: SettingsRow) => s.event_reminder_2h },
      { key: 'event_reminder_15m', hours: 0.25, enabled: (s: SettingsRow) => s.event_reminder_15m },
    ];

    const notificationsToInsert: Record<string, unknown>[] = [];

    for (const window of eventWindows) {
      const target = new Date(now.getTime() + window.hours * 60 * 60 * 1000);
      const start = new Date(target.getTime() - windowMs).toISOString();
      const end = new Date(target.getTime() + windowMs).toISOString();

      const { data: events, error: eventsError } = await admin
        .from('events')
        .select('id, user_id, application_id, title, start_at')
        .in('user_id', userIds)
        .gte('start_at', start)
        .lte('start_at', end);
      if (eventsError) {
        console.error('notifications-reminder eventsError', eventsError);
        return jsonResponse({ error: eventsError.message }, 500);
      }

      const eventList = (events as EventRow[]) || [];
      if (eventList.length === 0) continue;

      const eventIds = eventList.map((event) => event.id);
      const { data: existingNotifications, error: existingError } = await admin
        .from('notifications')
        .select('entity_id')
        .eq('subtype', window.key)
        .in('entity_id', eventIds)
        .gte('created_at', cutoffIso);
      if (existingError) {
        console.error('notifications-reminder eventsExistingError', existingError);
        return jsonResponse({ error: existingError.message }, 500);
      }
      const existingSet = new Set((existingNotifications || []).map((row) => row.entity_id));

      for (const event of eventList) {
        const settings = settingsByUser.get(event.user_id);
        if (!settings || !settings.reminders_enabled || !window.enabled(settings)) continue;
        if (existingSet.has(event.id)) continue;
        notificationsToInsert.push({
          user_id: event.user_id,
          type: 'reminder',
          subtype: window.key,
          title: event.title || 'Upcoming event',
          body: `Starts at ${new Date(event.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
          entity_type: 'event',
          entity_id: event.id,
          metadata: {
            start_at: event.start_at,
            application_id: event.application_id,
            reminder_window_hours: window.hours,
          },
          channel: 'in_app',
          priority: 'normal',
          scheduled_for: now.toISOString(),
        });
      }
    }

    // Tasks due soon (next 2 hours)
    const dueSoonEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const { data: tasksDueSoon, error: tasksSoonError } = await admin
      .from('tasks')
      .select('id, user_id, application_id, title, due_at, status')
      .in('user_id', userIds)
      .eq('status', 'open')
      .not('due_at', 'is', null)
      .gte('due_at', now.toISOString())
      .lte('due_at', dueSoonEnd);
    if (tasksSoonError) {
      console.error('notifications-reminder tasksSoonError', tasksSoonError);
      return jsonResponse({ error: tasksSoonError.message }, 500);
    }
    const tasksSoon = (tasksDueSoon as TaskRow[]) || [];
    if (tasksSoon.length > 0) {
      const taskIds = tasksSoon.map((task) => task.id);
      const { data: existingTaskNotifs, error: existingTaskError } = await admin
        .from('notifications')
        .select('entity_id')
        .eq('subtype', 'task_due')
        .in('entity_id', taskIds)
        .gte('created_at', cutoffIso);
      if (existingTaskError) {
        console.error('notifications-reminder tasksExistingError', existingTaskError);
        return jsonResponse({ error: existingTaskError.message }, 500);
      }
      const existingTaskSet = new Set((existingTaskNotifs || []).map((row) => row.entity_id));
      for (const task of tasksSoon) {
        const settings = settingsByUser.get(task.user_id);
        if (!settings || !settings.reminders_enabled || !settings.task_due_enabled) continue;
        if (existingTaskSet.has(task.id)) continue;
        notificationsToInsert.push({
          user_id: task.user_id,
          type: 'reminder',
          subtype: 'task_due',
          title: `Task due soon: ${task.title}`,
          body: task.due_at
            ? `Due at ${new Date(task.due_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
            : null,
          entity_type: 'task',
          entity_id: task.id,
          metadata: {
            due_at: task.due_at,
            application_id: task.application_id,
          },
          channel: 'in_app',
          priority: 'normal',
          scheduled_for: now.toISOString(),
        });
      }
    }

    // Overdue tasks (once per 24h)
    const { data: tasksOverdue, error: tasksOverdueError } = await admin
      .from('tasks')
      .select('id, user_id, application_id, title, due_at, status')
      .in('user_id', userIds)
      .eq('status', 'open')
      .not('due_at', 'is', null)
      .lt('due_at', now.toISOString());
    if (tasksOverdueError) {
      console.error('notifications-reminder tasksOverdueError', tasksOverdueError);
      return jsonResponse({ error: tasksOverdueError.message }, 500);
    }
    const overdueTasks = (tasksOverdue as TaskRow[]) || [];
    if (overdueTasks.length > 0) {
      const taskIds = overdueTasks.map((task) => task.id);
      const { data: existingOverdueNotifs, error: existingOverdueError } = await admin
        .from('notifications')
        .select('entity_id')
        .eq('subtype', 'task_overdue')
        .in('entity_id', taskIds)
        .gte('created_at', cutoffIso);
      if (existingOverdueError) {
        console.error('notifications-reminder tasksOverdueExistingError', existingOverdueError);
        return jsonResponse({ error: existingOverdueError.message }, 500);
      }
      const existingOverdueSet = new Set((existingOverdueNotifs || []).map((row) => row.entity_id));
      for (const task of overdueTasks) {
        const settings = settingsByUser.get(task.user_id);
        if (!settings || !settings.reminders_enabled || !settings.task_overdue_enabled) continue;
        if (existingOverdueSet.has(task.id)) continue;
        notificationsToInsert.push({
          user_id: task.user_id,
          type: 'reminder',
          subtype: 'task_overdue',
          title: `Overdue: ${task.title}`,
          body: task.due_at ? `Was due ${new Date(task.due_at).toLocaleDateString('en-US')}` : null,
          entity_type: 'task',
          entity_id: task.id,
          metadata: {
            due_at: task.due_at,
            application_id: task.application_id,
          },
          channel: 'in_app',
          priority: 'normal',
          scheduled_for: now.toISOString(),
        });
      }
    }

    if (notificationsToInsert.length === 0) {
      return jsonResponse({ ok: true, created: 0 });
    }

    const { error: insertError } = await admin.from('notifications').insert(notificationsToInsert);
    if (insertError) {
      console.error('notifications-reminder insertError', insertError);
      return jsonResponse({ error: insertError.message }, 500);
    }

    return jsonResponse({ ok: true, created: notificationsToInsert.length });
  } catch (err: any) {
    console.error('notifications-reminder unhandled error', err);
    return jsonResponse({ error: err?.message || 'Unhandled error' }, 500);
  }
});
