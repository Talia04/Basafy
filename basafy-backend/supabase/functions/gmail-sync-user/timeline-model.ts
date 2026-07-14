export type TimelineStatus = 'applied' | 'assessment' | 'interview' | 'offer' | 'rejected';

export interface TimelineEvent {
  id: string | number;
  application_id: string;
  event_type: string | null;
  parsed_status: string | null;
  confidence: number | null;
  received_at: string | null;
  llm_parsed_json: Record<string, unknown> | null;
  match_state?: string | null;
}

export interface TimelineEntry {
  event_id: string | number;
  event_type: string;
  status: TimelineStatus | null;
  occurred_at: string;
  confidence: number;
  action: string | null;
  deadline: string | null;
}

export interface ApplicationTimelineSummary {
  currentStatus: TimelineStatus;
  statusConfidence: number;
  lastMeaningfulEventId: string | number | null;
  nextAction: string | null;
  nextDeadline: string | null;
  timeline: TimelineEntry[];
}

export interface TimelineAction {
  title: string;
  due_at: string | null;
  created_at: string | null;
}

const STATUS_BY_EVENT: Record<string, TimelineStatus> = {
  application_received: 'applied',
  assessment: 'assessment',
  interview_invite: 'interview',
  offer: 'offer',
  rejection: 'rejected',
};
const MIN_MEANINGFUL_STATUS_CONFIDENCE = 0.5;

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 'true';
}

function dateValue(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw || Number.isNaN(Date.parse(raw))) return null;
  return new Date(raw).toISOString();
}

function eventTime(event: TimelineEvent): string | null {
  const explicit = dateValue(event.llm_parsed_json?.event_date);
  const value = explicit ?? event.received_at;
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function eventStatus(event: TimelineEvent): TimelineStatus | null {
  const byType = STATUS_BY_EVENT[(event.event_type ?? '').toLowerCase()];
  if (byType) return byType;
  const parsed = (event.parsed_status ?? '').toLowerCase();
  return ['applied', 'assessment', 'interview', 'offer', 'rejected'].includes(parsed)
    ? parsed as TimelineStatus
    : null;
}

function isReminder(event: TimelineEvent): boolean {
  const relevance = stringValue(event.llm_parsed_json?.relevance_type)?.toLowerCase() ?? '';
  const action = stringValue(event.llm_parsed_json?.action_summary)?.toLowerCase() ?? '';
  return relevance.includes('reminder') || action.includes('reminder');
}

export function buildApplicationTimeline(
  events: TimelineEvent[],
  openActions: TimelineAction[] = [],
): ApplicationTimelineSummary {
  const ordered = events
    .map((event) => ({ event, occurredAt: eventTime(event) }))
    .filter((item): item is { event: TimelineEvent; occurredAt: string } => Boolean(item.occurredAt))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

  const seen = new Set<string>();
  const timeline: TimelineEntry[] = [];
  let latestStatus: TimelineEntry | null = null;
  let nextAction: TimelineEntry | null = null;

  for (const { event, occurredAt } of ordered) {
    if (event.match_state && !['matched', 'match_existing', 'create_new'].includes(event.match_state)) continue;
    const status = eventStatus(event);
    const action = booleanValue(event.llm_parsed_json?.action_required)
      ? stringValue(event.llm_parsed_json?.action_summary) ?? 'Review this application update'
      : null;
    const deadline = dateValue(event.llm_parsed_json?.deadline);
    const fingerprint = [event.event_type, status, action, deadline].join('|').toLowerCase();
    if (isReminder(event) && seen.has(fingerprint)) continue;
    if (isReminder(event)) seen.add(fingerprint);

    const entry: TimelineEntry = {
      event_id: event.id,
      event_type: event.event_type ?? 'other',
      status,
      occurred_at: occurredAt,
      confidence: Math.max(0, Math.min(1, Number(event.confidence) || 0)),
      action,
      deadline,
    };
    timeline.push(entry);

    // Reminders and low-confidence parses can appear in the timeline, but cannot
    // rewrite the grounded stage.
    if (status && !isReminder(event) && entry.confidence >= MIN_MEANINGFUL_STATUS_CONFIDENCE) latestStatus = entry;
    if (action) nextAction = entry;
    if (status === 'rejected' || status === 'offer') nextAction = null;
  }

  const earliestOpenAction = [...openActions].sort((a, b) => {
    const aTime = Date.parse(a.due_at ?? a.created_at ?? '') || Number.MAX_SAFE_INTEGER;
    const bTime = Date.parse(b.due_at ?? b.created_at ?? '') || Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  })[0];
  const isClosed = latestStatus?.status === 'rejected' || latestStatus?.status === 'offer';

  return {
    currentStatus: latestStatus?.status ?? 'applied',
    statusConfidence: latestStatus?.confidence ?? 0.5,
    lastMeaningfulEventId: latestStatus?.event_id ?? null,
    nextAction: isClosed ? null : earliestOpenAction?.title ?? nextAction?.action ?? null,
    nextDeadline: isClosed ? null : earliestOpenAction?.due_at ?? nextAction?.deadline ?? null,
    timeline,
  };
}
