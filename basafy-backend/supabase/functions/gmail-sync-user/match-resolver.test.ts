import { resolveApplicationMatches } from './match-resolver.ts';
import type { ParsedEmailResult } from './types.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function email(overrides: Partial<ParsedEmailResult>): ParsedEmailResult {
  return {
    company: null,
    role: null,
    status: 'Other',
    eventType: 'other',
    confidence: 0.8,
    companyConfidence: null,
    roleConfidence: null,
    portalDomain: null,
    jobId: null,
    requisitionId: null,
    canonicalKey: null,
    gmailMessageId: 'message',
    gmailThreadId: null,
    receivedAt: '2026-07-01T12:00:00.000Z',
    ...overrides,
  };
}

Deno.test('same Gmail thread alone does not force an application match', async () => {
  const result = await resolveApplicationMatches({
    emails: [email({ gmailThreadId: 'thread-1' })],
    applications: [{ id: 'app-1', company: 'Acme', role: 'Engineer', status: 'applied', gmail_thread_id: 'thread-1' }],
    adjudicator: async () => ({ decision: 'needs_review', matchedApplicationId: null, confidence: 0, reason: 'not called' }),
  });
  const resolution = result.get('message')!;
  assert(resolution.application === null, 'Thread-only evidence must not attach an application.');
  assert(resolution.evidence.matchScore < 0.65, 'Thread-only evidence must remain below the match threshold.');
});

Deno.test('uncertain company-role match uses adjudication', async () => {
  const result = await resolveApplicationMatches({
    emails: [email({ company: 'Meta Platforms', role: 'New Grad Software Engineer', eventType: 'interview_invite', status: 'Interview' })],
    applications: [{ id: 'app-meta', company: 'Meta', role: 'Software Engineer, University Grad', status: 'applied', applied_at: '2026-06-01T12:00:00.000Z' }],
    adjudicator: async () => ({ decision: 'match_existing', matchedApplicationId: 'app-meta', confidence: 0.92, reason: 'Same normalized company and entry-level role.' }),
  });
  const resolution = result.get('message')!;
  assert(resolution.application?.id === 'app-meta', 'Expected the adjudicated candidate match.');
  assert(resolution.evidence.matchType === 'llm_adjudicated', 'Expected adjudication evidence.');
});

Deno.test('ambiguous company-only event is held as a possible duplicate', async () => {
  const result = await resolveApplicationMatches({
    emails: [email({ company: 'Acme', role: null })],
    applications: [
      { id: 'app-1', company: 'Acme', role: 'Designer', status: 'applied' },
      { id: 'app-2', company: 'Acme', role: 'Engineer', status: 'interview' },
    ],
  });
  const resolution = result.get('message')!;
  assert(resolution.application === null, 'Ambiguous company-only events must remain unlinked.');
  assert(resolution.evidence.decision === 'possible_duplicate', 'Expected the possible duplicate bucket.');
});

Deno.test('conflicting role levels do not auto-merge', async () => {
  const result = await resolveApplicationMatches({
    emails: [email({ company: 'Acme', role: 'Entry-Level Software Engineer' })],
    applications: [{ id: 'senior-app', company: 'Acme', role: 'Senior Software Engineer', status: 'applied' }],
  });
  const resolution = result.get('message')!;
  assert(resolution.application === null, 'Entry and senior roles must not auto-match.');
  assert(resolution.evidence.decision === 'create_new', 'Expected a distinct application for a conflicting role level.');
});
