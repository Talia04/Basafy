import { prefilterDeepSyncMessages } from './deep-prefilter.ts';
import { isRetryableOpenAIStatus, rawToLLMResult, validateStructuredEmailParse } from './llm.ts';
import { prepareEmailBodyForLlm } from './utils.ts';
import { validateSyncRequest } from './validation.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('wrapped deep mode enables its explicit bounded configuration', () => {
  const result = validateSyncRequest({ sync_mode: 'wrapped_deep_sync' }, 'person@example.com');
  assert(result.success, 'Expected wrapped_deep_sync to validate.');
  assert(result.data.syncMode === 'wrapped_deep_sync', 'Expected explicit mode preservation.');
  assert(result.data.bucketedRetrieval, 'Expected bucketed retrieval.');
  assert(!result.data.lightSync, 'Wrapped deep sync must not resolve to light preview.');
  assert(result.data.maxMessages === 40, 'Expected the CPU-safe Wrapped candidate limit.');
});

Deno.test('wrapped deep mode clamps oversized client requests', () => {
  const result = validateSyncRequest({ sync_mode: 'wrapped_deep_sync', max_messages: 250 }, 'person@example.com');
  assert(result.success, 'Expected wrapped_deep_sync to validate.');
  assert(result.data.maxMessages === 40, 'Wrapped must enforce its server-side CPU cap.');
});

Deno.test('deep prefilter removes obvious noise but preserves ambiguous candidates', () => {
  const result = prefilterDeepSyncMessages([
    { id: 'alert', subject: 'Weekly job alert', snippet: '10 new jobs for you', platformEmailType: 'job_alert_noise' },
    { id: 'candidate', subject: 'An update from the hiring team', snippet: 'Please review the next step.' },
    { id: 'assessment-verification', subject: 'Verify your account for the coding assessment', snippet: 'Complete your candidate assessment.' },
  ]);
  assert(result.candidates.length === 2, 'Expected ambiguous and assessment-related verification candidates to remain.');
  assert(result.decisions.length === 1 && result.decisions[0].message.id === 'alert', 'Expected an audited noise decision.');
});

Deno.test('body cleaning removes quoted content and signatures while preserving links', () => {
  const cleaned = prepareEmailBodyForLlm(`Complete your assessment by Friday.\nhttps://codesignal.com/test/123\n\nBest regards,\nRecruiting Team\n> old quoted reply`);
  assert(cleaned.includes('Complete your assessment by Friday'), 'Expected deadline language to remain.');
  assert(cleaned.includes('https://codesignal.com/test/123'), 'Expected assessment links to remain.');
  assert(!cleaned.includes('old quoted reply'), 'Expected quoted replies to be removed.');
});

Deno.test('invalid LLM output becomes unknown needs review', () => {
  const invalid = { is_job_related: true, company_name: 'Acme' };
  assert(!validateStructuredEmailParse(invalid).valid, 'Expected missing required fields to fail validation.');
  const parsed = rawToLLMResult(invalid);
  assert(parsed.is_job_related === undefined, 'Invalid output must not default to job-related.');
  assert(parsed.diagnostics?.unknownNeedsReview === true, 'Expected unknown review diagnostics.');
});

Deno.test('OpenAI retry policy is limited to transient failures', () => {
  assert(isRetryableOpenAIStatus(429), 'Rate limits should retry.');
  assert(isRetryableOpenAIStatus(500), 'Server failures should retry.');
  assert(isRetryableOpenAIStatus(503), 'Unavailable responses should retry.');
  assert(!isRetryableOpenAIStatus(400), 'Invalid requests should fail immediately.');
  assert(!isRetryableOpenAIStatus(401), 'Authentication failures should fail immediately.');
});

Deno.test('complete structured LLM output validates', () => {
  const valid = {
    is_job_related: true,
    relevance_type: 'assessment',
    event_type: 'assessment',
    company_name: 'Acme',
    role_title: 'Software Engineer',
    deadline: '2026-07-10T17:00:00-05:00',
    event_date: null,
    recruiter_name: null,
    recruiter_email: null,
    action_required: true,
    action_summary: 'Complete the coding assessment.',
    confidence: 0.94,
    evidence: ['Complete your assessment by July 10.'],
  };
  assert(validateStructuredEmailParse(valid).valid, 'Expected the complete structure to validate.');
  const parsed = rawToLLMResult(valid);
  assert(parsed.status === 'Assessment', 'Expected event-to-status compatibility mapping.');
  assert(parsed.job_title === 'Software Engineer', 'Expected role_title compatibility mapping.');
});
