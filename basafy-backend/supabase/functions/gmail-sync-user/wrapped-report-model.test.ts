import { buildWrappedReport } from './wrapped-report-model.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('Wrapped report counts grounded timeline stages and review uncertainty', () => {
  const report = buildWrappedReport({
    applications: [
      { id: 'a1', company: 'Acme', role: 'Engineer', status: 'rejected', applied_at: '2026-06-01T00:00:00Z', created_at: null, portal_domain: 'greenhouse.io' },
      { id: 'a2', company: 'Acme', role: 'Designer', status: 'offer', applied_at: '2026-06-08T00:00:00Z', created_at: null, portal_domain: 'lever.co' },
    ],
    summaries: [
      { application_id: 'a1', current_status: 'rejected', status_confidence: 0.9, next_action: null, next_deadline: null, timeline_summary: [{ status: 'applied' }, { status: 'interview' }, { status: 'rejected' }] },
      { application_id: 'a2', current_status: 'offer', status_confidence: 0.9, next_action: 'Review offer', next_deadline: null, timeline_summary: [{ status: 'applied' }, { status: 'offer' }] },
    ],
    parseAttempts: [{ final_decision: 'unknown_needs_review', confidence: 0.55 }],
    matchDecisions: [{ decision: 'match_existing', match_score: 0.9 }],
    syncRun: { messages_discarded: 3, messages_kept: 2 },
  });
  assert(report.totalApplications === 2, 'Applications must come from matched run entities.');
  assert(report.interviews === 1, 'Historical interview stages should be counted.');
  assert(report.rejections === 1 && report.offers === 1, 'Terminal statuses should be grounded in timelines.');
  assert(report.confidenceSummary.needs_review === 1, 'Uncertain parse results should be disclosed.');
  assert(report.confidenceSummary.messages.length === 3, 'Review and exclusion messages should be present.');
});

Deno.test('Wrapped report ignores weak historical stage entries', () => {
  const report = buildWrappedReport({
    applications: [
      { id: 'a1', company: 'Acme', role: 'Engineer', status: 'applied', applied_at: '2026-06-01T00:00:00Z', created_at: null, portal_domain: 'greenhouse.io' },
    ],
    summaries: [
      {
        application_id: 'a1',
        current_status: 'applied',
        status_confidence: 0.92,
        next_action: null,
        next_deadline: null,
        timeline_summary: [
          { status: 'applied', confidence: 0.92 },
          { status: 'offer', confidence: 0.32 },
          { status: 'interview', confidence: 0.87 },
        ],
      },
    ],
    parseAttempts: [],
    matchDecisions: [],
    syncRun: { messages_discarded: 0, messages_kept: 1 },
  });

  assert(report.offers === 0, 'Weak offer entries must not inflate Wrapped offer counts.');
  assert(report.interviews === 1, 'Confident historical stages should still count.');
});
