import { prefilterDeepSyncMessages } from './deep-prefilter.ts';
import {
  isRetryableOpenAIStatus,
  parseEmailCombinedWithLLM,
  rawToLLMResult,
  validateStructuredEmailParse,
} from './llm.ts';
import { extractPlainText, prepareEmailBodyForLlm } from './utils.ts';
import { validateSyncRequest } from './validation.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function encodeBody(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

Deno.test('wrapped deep mode enables its explicit bounded configuration', () => {
  const result = validateSyncRequest({ sync_mode: 'wrapped_deep_sync' }, 'person@example.com');
  assert(result.success, 'Expected wrapped_deep_sync to validate.');
  assert(result.data.syncMode === 'wrapped_deep_sync', 'Expected explicit mode preservation.');
  assert(result.data.bucketedRetrieval, 'Expected bucketed retrieval.');
  assert(!result.data.lightSync, 'Wrapped deep sync must not resolve to light preview.');
  assert(result.data.maxMessages === 10, 'Expected the CPU-safe Wrapped candidate limit.');
});

Deno.test('wrapped deep mode clamps oversized client requests', () => {
  const result = validateSyncRequest({ sync_mode: 'wrapped_deep_sync', max_messages: 250 }, 'person@example.com');
  assert(result.success, 'Expected wrapped_deep_sync to validate.');
  assert(result.data.maxMessages === 10, 'Wrapped must enforce its server-side CPU cap.');
});

Deno.test('mobile session modes use bucketed CPU-safe chunks', () => {
  const result = validateSyncRequest({
    sync_mode: 'mobile_onboarding_sync',
    sync_context: 'mobile_onboarding',
    gmail_sync_session_id: 'd9f430d0-f770-4a44-8508-414e267f513b',
    max_messages: 250,
  }, 'person@example.com');
  assert(result.success, 'Expected mobile onboarding sync to validate.');
  assert(result.data.syncContext === 'mobile_onboarding', 'Expected context preservation.');
  assert(result.data.gmailSyncSessionId === 'd9f430d0-f770-4a44-8508-414e267f513b', 'Expected session preservation.');
  assert(result.data.bucketedRetrieval, 'Mobile durable sync must use query buckets.');
  assert(result.data.maxMessages === 10, 'Mobile durable sync must enforce the CPU-safe chunk cap.');
});

Deno.test('deep prefilter removes obvious noise but preserves ambiguous candidates', () => {
  const result = prefilterDeepSyncMessages([
    { id: 'alert', subject: 'Weekly job alert', snippet: '10 new jobs for you', platformEmailType: 'job_alert_noise' },
    { id: 'security', subject: 'New sign-in to your Workday account', snippet: 'Use this security code if this was you.' },
    { id: 'profile', subject: 'Your candidate profile is ready', snippet: 'Complete your profile to get started.' },
    { id: 'network', subject: 'People you may know', snippet: 'Grow your network with these connections.' },
    { id: 'candidate', subject: 'An update from the hiring team', snippet: 'Please review the next step.' },
    { id: 'assessment-verification', subject: 'Verify your account for the coding assessment', snippet: 'Complete your candidate assessment.' },
    { id: 'application-verification', subject: 'Confirm your email for your application', snippet: 'We received your application for Software Engineer.' },
  ]);
  assert(result.candidates.length === 3, 'Expected ambiguous and concrete application activity to remain.');
  assert(
    result.decisions.map((decision) => decision.message.id).join(',') === 'alert,security,profile,network',
    'Expected generic alert, security, profile, and networking mail to be excluded.',
  );
});

Deno.test('body cleaning removes quoted content and signatures while preserving links', () => {
  const cleaned = prepareEmailBodyForLlm(`Complete your assessment by Friday.\nhttps://codesignal.com/test/123\n\nBest regards,\nRecruiting Team\n> old quoted reply`);
  assert(cleaned.includes('Complete your assessment by Friday'), 'Expected deadline language to remain.');
  assert(cleaned.includes('https://codesignal.com/test/123'), 'Expected assessment links to remain.');
  assert(!cleaned.includes('old quoted reply'), 'Expected quoted replies to be removed.');
});

Deno.test('Gmail MIME extraction combines multiple plain text body parts', () => {
  const text = extractPlainText({
    mimeType: 'multipart/mixed',
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: encodeBody('Application received for Product Designer.') } },
          { mimeType: 'text/html', body: { data: encodeBody('<p>Duplicate html copy.</p>') } },
        ],
      },
      { mimeType: 'text/plain', body: { data: encodeBody('Your next step is a portfolio review.') } },
    ],
  });

  assert(text?.includes('Application received for Product Designer.'), 'Expected the first plain body part.');
  assert(text?.includes('Your next step is a portfolio review.'), 'Expected later plain body parts to be preserved.');
  assert(!text?.includes('Duplicate html copy'), 'Expected plain text to be preferred over duplicate HTML.');
});

Deno.test('Gmail MIME extraction falls back to HTML when no plain text exists', () => {
  const text = extractPlainText({
    mimeType: 'multipart/alternative',
    parts: [
      { mimeType: 'text/html', body: { data: encodeBody('<div>Interview scheduled<br>Tuesday at 2 PM</div>') } },
    ],
  });

  assert(text?.includes('Interview scheduled'), 'Expected HTML fallback text.');
  assert(text?.includes('Tuesday at 2 PM'), 'Expected HTML fallback details.');
});

Deno.test('invalid LLM output becomes unknown needs review', () => {
  const invalid = { is_job_related: true, company_name: 'Acme' };
  assert(!validateStructuredEmailParse(invalid).valid, 'Expected missing required fields to fail validation.');
  const parsed = rawToLLMResult(invalid);
  assert(parsed.is_job_related === undefined, 'Invalid output must not default to job-related.');
  assert(parsed.diagnostics?.unknownNeedsReview === true, 'Expected unknown review diagnostics.');
});

Deno.test('missing LLM classification does not make weak heuristics job-related', () => {
  const result = parseEmailCombinedWithLLM(
    'Your candidate profile is ready',
    'Workday <no-reply@myworkday.com>',
    'Complete your profile to improve job recommendations.',
    'Finish setting up your account and review recommended jobs.',
    {
      is_job_related: true,
      company_name: null,
      job_title: null,
      event_type: 'other',
      status: 'Other',
      interview_date: null,
      confidence: 0.3,
      portal_domain: null,
      job_id: null,
      diagnostics: { llmAvailable: false, rawLlmResult: null, classificationSource: 'heuristic_only' },
    },
  );

  assert(result.is_job_related === false, 'Weak heuristic-only platform mail must be excluded.');
  assert(
    result.diagnostics?.classificationSource === 'heuristic_rejected_low_evidence',
    'Expected the rejection reason to be auditable.',
  );
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

Deno.test('ATS sender alone cannot override an explicit non-job classification', () => {
  const result = parseEmailCombinedWithLLM(
    'Verify your Workday account',
    'Workday <no-reply@myworkday.com>',
    'Confirm your email address to finish setting up your account.',
    'Use this verification code to activate your account.',
    {
      is_job_related: false,
      company_name: null,
      job_title: null,
      event_type: 'other',
      status: 'Other',
      interview_date: null,
      confidence: 0.97,
      portal_domain: null,
      job_id: null,
      diagnostics: { llmAvailable: true, rawLlmResult: { is_job_related: false } },
    },
  );
  assert(result.is_job_related === false, 'Generic ATS account mail must remain excluded.');
});

Deno.test('LLM job alert classifications are excluded from application data', () => {
  const result = parseEmailCombinedWithLLM(
    'New jobs for you',
    'LinkedIn Jobs <jobs-noreply@linkedin.com>',
    'Recommended software engineering jobs based on your profile.',
    'Here are jobs you may like. Apply today to roles near you.',
    {
      is_job_related: true,
      relevance_type: 'job_alert',
      company_name: null,
      job_title: null,
      event_type: 'other',
      status: 'Other',
      interview_date: null,
      confidence: 0.88,
      portal_domain: null,
      job_id: null,
      action_required: false,
      action_summary: null,
      evidence: ['Recommended software engineering jobs based on your profile.'],
      diagnostics: { llmAvailable: true, rawLlmResult: { is_job_related: true, relevance_type: 'job_alert' } },
    },
  );

  assert(result.is_job_related === false, 'Job alert digests must not create application records.');
  assert(result.diagnostics?.classificationSource === 'llm_job_alert_excluded', 'Expected an auditable job alert exclusion.');
});

Deno.test('LLM true without evidence is excluded', () => {
  const result = parseEmailCombinedWithLLM(
    'Your career profile update',
    'Workday <no-reply@myworkday.com>',
    'Your candidate profile has new recommendations.',
    'Sign in to review profile suggestions and recommended jobs.',
    {
      is_job_related: true,
      relevance_type: 'other',
      company_name: null,
      job_title: null,
      event_type: 'other',
      status: 'Other',
      interview_date: null,
      confidence: 0.7,
      portal_domain: null,
      job_id: null,
      action_required: false,
      action_summary: null,
      evidence: [],
      diagnostics: { llmAvailable: true, rawLlmResult: { is_job_related: true, relevance_type: 'other' } },
    },
  );

  assert(result.is_job_related === false, 'LLM true still needs evidence before creating app data.');
  assert(
    result.diagnostics?.classificationSource === 'llm_generic_platform_noise_excluded',
    'Expected generic platform noise rejection diagnostics.',
  );
});

Deno.test('specific lifecycle and entity evidence can override an LLM false negative', () => {
  const result = parseEmailCombinedWithLLM(
    'Acme: application received for Software Engineer',
    'Acme Recruiting <recruiting@acme.example>',
    'We received your application for Software Engineer.',
    'Thank you for applying to Acme. We received your application for Software Engineer.',
    {
      is_job_related: false,
      company_name: null,
      job_title: null,
      event_type: 'other',
      status: 'Other',
      interview_date: null,
      confidence: 0.55,
      portal_domain: null,
      job_id: null,
      diagnostics: { llmAvailable: true, rawLlmResult: { is_job_related: false } },
    },
  );
  assert(result.is_job_related === true, 'Concrete application evidence should survive a false negative.');
  assert(result.status === 'Applied', 'Expected the lifecycle heuristic to recover Applied status.');
});
