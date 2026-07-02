// @ts-ignore
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { buildApplicationTimeline, type TimelineAction, type TimelineEvent } from './timeline-model.ts';

export async function refreshApplicationTimelines(
  admin: SupabaseClient,
  userId: string,
  applicationIds: string[],
): Promise<number> {
  const ids = Array.from(new Set(applicationIds.filter(Boolean)));
  if (!ids.length) return 0;

  const [{ data: events, error: eventsError }, { data: tasks, error: tasksError }] = await Promise.all([
    admin
      .from('job_email_events')
      .select('id, application_id, event_type, parsed_status, confidence, received_at, llm_parsed_json, match_state')
      .eq('user_id', userId)
      .in('application_id', ids),
    admin
      .from('tasks')
      .select('application_id, title, due_at, created_at')
      .in('application_id', ids)
      .eq('status', 'open'),
  ]);
  if (eventsError) throw eventsError;
  if (tasksError) throw tasksError;

  const eventsByApplication = new Map<string, TimelineEvent[]>();
  for (const event of events ?? []) {
    if (!event.application_id) continue;
    const list = eventsByApplication.get(event.application_id) ?? [];
    list.push(event as TimelineEvent);
    eventsByApplication.set(event.application_id, list);
  }
  const actionsByApplication = new Map<string, TimelineAction[]>();
  for (const task of tasks ?? []) {
    if (!task.application_id) continue;
    const list = actionsByApplication.get(task.application_id) ?? [];
    list.push(task as TimelineAction);
    actionsByApplication.set(task.application_id, list);
  }

  const now = new Date().toISOString();
  const summaries = ids
    .map((applicationId) => {
      const linkedEvents = eventsByApplication.get(applicationId) ?? [];
      if (!linkedEvents.length) return null;
      const summary = buildApplicationTimeline(
        linkedEvents,
        actionsByApplication.get(applicationId) ?? [],
      );
      return {
        application_id: applicationId,
        user_id: userId,
        current_status: summary.currentStatus,
        status_confidence: summary.statusConfidence,
        last_meaningful_event_id: summary.lastMeaningfulEventId,
        next_action: summary.nextAction,
        next_deadline: summary.nextDeadline,
        timeline_summary: summary.timeline,
        updated_at: now,
      };
    })
    .filter(Boolean);

  if (!summaries.length) return 0;
  const { error: summaryError } = await admin
    .from('application_timeline_summaries')
    .upsert(summaries, { onConflict: 'application_id' });
  if (summaryError) throw summaryError;

  for (const summary of summaries) {
    const { error } = await admin
      .from('applications')
      .update({ status: summary!.current_status, last_synced_at: now })
      .eq('id', summary!.application_id)
      .eq('user_id', userId);
    if (error) throw error;
  }
  return summaries.length;
}
