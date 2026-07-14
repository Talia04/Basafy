import { buildApplicationTimeline, type TimelineEvent } from './timeline-model.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function event(id: string | number, type: string, date: string, overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id,
    application_id: 'app-1',
    event_type: type,
    parsed_status: null,
    confidence: 0.9,
    received_at: date,
    llm_parsed_json: null,
    match_state: 'match_existing',
    ...overrides,
  };
}

Deno.test('latest meaningful event determines status regardless of priority', () => {
  const summary = buildApplicationTimeline([
    event('interview', 'interview_invite', '2026-06-02T00:00:00Z'),
    event('applied', 'application_received', '2026-06-01T00:00:00Z'),
    event('rejected', 'rejection', '2026-06-03T00:00:00Z'),
  ]);
  assert(summary.currentStatus === 'rejected', 'A later rejection should close the interview stage.');
  assert(summary.lastMeaningfulEventId === 'rejected', 'The rejection should ground the status.');
});

Deno.test('assessment reminders do not replace the meaningful assessment event', () => {
  const summary = buildApplicationTimeline([
    event('invite', 'assessment', '2026-06-01T00:00:00Z'),
    event('reminder', 'assessment', '2026-06-03T00:00:00Z', {
      llm_parsed_json: { relevance_type: 'assessment_reminder', action_required: true, action_summary: 'Complete assessment' },
    }),
  ]);
  assert(summary.currentStatus === 'assessment', 'The application should remain in assessment.');
  assert(summary.lastMeaningfulEventId === 'invite', 'The invite should remain the grounding status event.');
  assert(summary.nextAction === 'Complete assessment', 'The reminder should still update the next action.');
});

Deno.test('non-status recruiter follow-up creates an action without changing stage', () => {
  const summary = buildApplicationTimeline([
    event('applied', 'application_received', '2026-06-01T00:00:00Z'),
    event('followup', 'other', '2026-06-02T00:00:00Z', {
      parsed_status: 'Other',
      llm_parsed_json: { action_required: true, action_summary: 'Reply to recruiter', deadline: '2026-06-04T00:00:00Z' },
    }),
  ]);
  assert(summary.currentStatus === 'applied', 'A recruiter follow-up must not invent a new stage.');
  assert(summary.nextAction === 'Reply to recruiter', 'The follow-up action should be surfaced.');
});

Deno.test('unmatched events cannot affect an application timeline', () => {
  const summary = buildApplicationTimeline([
    event('applied', 'application_received', '2026-06-01T00:00:00Z'),
    event('offer', 'offer', '2026-06-02T00:00:00Z', { match_state: 'needs_review' }),
  ]);
  assert(summary.currentStatus === 'applied', 'An uncertain offer must not change application status.');
});

Deno.test('low-confidence status events remain visible but do not become current status', () => {
  const summary = buildApplicationTimeline([
    event('applied', 'application_received', '2026-06-01T00:00:00Z', { confidence: 0.92 }),
    event('weak-offer', 'offer', '2026-06-02T00:00:00Z', { confidence: 0.32 }),
  ]);
  assert(summary.currentStatus === 'applied', 'A low-confidence offer must not override the grounded status.');
  assert(summary.lastMeaningfulEventId === 'applied', 'The confident application event should remain grounding.');
  assert(summary.timeline.some((entry) => entry.event_id === 'weak-offer'), 'The weak event should still be auditable in the timeline.');
});

Deno.test('event_date takes precedence over email received order', () => {
  const summary = buildApplicationTimeline([
    event('rejected', 'rejection', '2026-06-04T00:00:00Z', { llm_parsed_json: { event_date: '2026-06-02T00:00:00Z' } }),
    event('interview', 'interview_invite', '2026-06-03T00:00:00Z'),
  ]);
  assert(summary.currentStatus === 'interview', 'Explicit event dates should determine chronology.');
});
