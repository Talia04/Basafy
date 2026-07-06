// LLM (OpenAI) integration for email parsing

import type { GmailMessage, ParsedEmailLLMResult, ParsedEmailResult } from './types.ts';
import { normalizeText, extractUrlsFromText, prepareEmailBodyForLlm } from './utils.ts';
import {
  extractPortalDomain,
  extractJobIdFromUrls,
  CompanyUtils,
  JobUtils,
  determineStatusHeuristic,
} from './parsers.ts';

// ============================================================================
// OpenAI Configuration
// ============================================================================

import { getOpenAiApiKey } from '../_shared/secrets.ts';

const OPENAI_API_KEY = getOpenAiApiKey();
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const LLM_MODEL = 'gpt-4o-mini';
const OPENAI_BATCH_MAX_ATTEMPTS = 3;
const OPENAI_BATCH_TIMEOUT_MS = 20_000;

export function isRetryableOpenAIStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function retryDelay(attempt: number): number {
  return 500 * (2 ** attempt) + Math.floor(Math.random() * 250);
}

// ============================================================================
// Prompt Templates
// ============================================================================

export const PROMPT_A_SYSTEM = `You are an expert email parser specializing in job application emails. Extract key information from emails related to job applications, interviews, assessments, offers, and rejections.

CRITICAL RULES:
1. is_job_related: Set to true if this email is related to a job application, hiring process, interview, assessment, offer, or rejection. Set to false for newsletters, job alerts, marketing, password resets, or unrelated emails.
2. company_name: Extract the HIRING COMPANY name, NOT the ATS/platform name (e.g., NOT "Greenhouse", "Lever", "Workday", "Ashby", "iCIMS", "SmartRecruiters", "Taleo", etc.). Look for it in phrases like "Thank you for applying to [COMPANY]", "Your application to [COMPANY]", copyright notices, sender display names.
3. job_title: Extract the specific position/role being applied for. Clean up any extra text. If multiple roles mentioned, pick the most specific one.
4. event_type: Must be exactly one of: "application_received", "interview_invite", "assessment", "rejection", "offer", "other"
5. status: Must be exactly one of: "Applied", "Interview", "Assessment", "Rejected", "Offer", "Other"
6. interview_date: If any date/time for an interview, assessment, or deadline is mentioned, extract it in ISO 8601 format (e.g., "2026-02-15T14:00:00-05:00"). Include timezone if available.
7. If information is unclear or not present, use null

EVENT TYPE MAPPING:
- "application_received": Confirmation that application was submitted/received
- "interview_invite": Any invitation to interview (phone, video, onsite, etc.) or scheduling request
- "assessment": Request to complete a coding challenge, test, or assessment
- "rejection": Any form of rejection or "not moving forward" message
- "offer": Job offer extended
- "other": Status updates, follow-ups, or unclear emails

Output ONLY valid JSON with this exact structure:
{
  "is_job_related": boolean,
  "company_name": string | null,
  "job_title": string | null,
  "event_type": "application_received" | "interview_invite" | "assessment" | "rejection" | "offer" | "other",
  "status": "Applied" | "Interview" | "Assessment" | "Rejected" | "Offer" | "Other",
  "interview_date": string | null,
  "confidence": number (0.0 to 1.0)
}`;

export const PROMPT_B_SYSTEM = `You are an expert at analyzing job application emails. Your task is to extract DETAILED structured data from the email content, with special focus on interviews and assessments.

IMPORTANT DISTINCTIONS:
- company_name should be the ACTUAL HIRING COMPANY, not the recruitment platform/ATS
- Common ATS platforms to EXCLUDE from company_name: Greenhouse, Lever, Workday, Ashby, iCIMS, SmartRecruiters, Taleo, BambooHR, Jobvite, JazzHR, Recruitee, Breezy, Pinpoint, Teamtailor

CRITICAL RULES:
1. is_job_related: Set to true only when the email contains concrete evidence of a SPECIFIC job application, recruiter conversation, interview, assessment, offer, rejection, scheduling request, or follow-up. Set to false for bulk job digests, newsletters, marketing, password resets, or generic platform activity.
2. Rejections take priority: if the email says "we are unable to offer an interview", "we won't be moving forward", "not selected", "no longer under consideration", or similar — classify as "rejection" even if interview-related words appear in the same sentence.
3. confidence calibration: 0.95+ = unmistakable explicit signal (e.g. "offer letter attached", "you've been rejected"); 0.8–0.94 = clear contextual signal; 0.5–0.79 = probable but some ambiguity; 0.3–0.49 = weak or indirect signal; below 0.3 = guessing. When in doubt, score lower.

LOOK FOR COMPANY NAME IN:
1. "Thank you for applying to [COMPANY]"
2. "Your application to [COMPANY]"
3. "[COMPANY] has received your application"
4. "The team at [COMPANY]"
5. Email sender display name (if not an ATS)
6. Copyright notices "© [YEAR] [COMPANY]"

STATUS DETERMINATION:
- "Applied": Application confirmation/received
- "Interview": Any interview scheduling or invitation
- "Assessment": Technical test, coding challenge, or assessment request
- "Rejected": Not moving forward, declined, position filled
- "Offer": Job offer extended
- "Other": Unclear or general updates

INTERVIEW EXTRACTION:
- Look for any mention of scheduling an interview (phone screen, video call, onsite, technical, behavioral, etc.)
- Put the most concrete proposed date/time in event_date using ISO 8601 when possible
- Preserve meeting and scheduling links in evidence and action_summary

ASSESSMENT EXTRACTION:
- Look for coding challenges, take-home assignments, technical assessments, HackerRank/CodeSignal/Codility links
- Extract the deadline if mentioned
- Preserve the assessment link in evidence and action_summary

Return ONLY valid JSON with this structure:
{
  "is_job_related": boolean,
  "relevance_type": "application" | "interview" | "assessment" | "rejection" | "offer" | "recruiter" | "scheduling" | "followup" | "job_alert" | "other",
  "company_name": string | null,
  "role_title": string | null,
  "event_type": "application_received" | "interview_invite" | "assessment" | "rejection" | "offer" | "other",
  "deadline": string | null,
  "event_date": string | null,
  "recruiter_name": string | null,
  "recruiter_email": string | null,
  "action_required": boolean,
  "action_summary": string | null,
  "confidence": number,
  "evidence": [string]
}`;

// ============================================================================
// Prompt Input Builders
// ============================================================================

const MAX_LLM_BODY_CHARS = 12000;
const LLM_BODY_HEAD_CHARS = 9000;
const LLM_BODY_TAIL_CHARS = 3000;

function buildLlmBody(text: string): string {
  const cleaned = prepareEmailBodyForLlm(text);
  if (!cleaned) return '';
  if (cleaned.length <= MAX_LLM_BODY_CHARS) return cleaned;
  const head = cleaned.slice(0, LLM_BODY_HEAD_CHARS);
  const tail = cleaned.slice(-LLM_BODY_TAIL_CHARS);
  return `${head}\n\n...[truncated]...\n\n${tail}`;
}

export function buildPromptAInput(
  subject: string | null | undefined,
  from: string | null | undefined,
  snippet: string | null | undefined,
  body?: string | null
): string {
  const parts: string[] = [];
  const headers: string[] = [];

  if (subject) headers.push(`Subject: ${normalizeText(subject)}`);
  if (from) headers.push(`From: ${from}`);
  if (headers.length > 0) {
    parts.push(`Headers:\n${headers.join('\n')}`);
  }
  const senderEmail = extractSenderEmail(from);
  if (senderEmail) {
    parts.push(`Sender Email: ${senderEmail}`);
  }
  if (snippet) parts.push(`Snippet: ${normalizeText(snippet)}`);

  if (body) {
    const preparedBody = buildLlmBody(body);
    if (preparedBody) {
      parts.push(`Body:\n${preparedBody}`);
    }
  }

  return parts.join('\n\n');
}

export function buildPromptBInput(
  subject: string | null | undefined,
  from: string | null | undefined,
  snippet: string | null | undefined,
  body?: string | null
): string {
  // Same as A but with different context emphasis
  const parts: string[] = [];
  const headers: string[] = [];

  if (subject) headers.push(`Subject: ${normalizeText(subject)}`);
  if (from) headers.push(`From: ${from}`);
  if (headers.length > 0) {
    parts.push(`Headers:\n${headers.join('\n')}`);
  }
  const senderEmail = extractSenderEmail(from);
  if (senderEmail) {
    parts.push(`Sender Email: ${senderEmail}`);
  }
  if (from) parts.push(`Sender: ${from}`);
  if (snippet) parts.push(`Snippet: ${normalizeText(snippet)}`);

  const bodyText = body || snippet;
  if (bodyText) {
    const preparedBody = buildLlmBody(bodyText);
    if (preparedBody) {
      parts.push(`Email Content:\n${preparedBody}`);
    }
  }

  return parts.join('\n\n');
}

// ============================================================================
// OpenAI API Call
// ============================================================================

export async function callOpenAI(
  systemPrompt: string,
  userInput: string,
  temperature: number = 0.1
): Promise<ParsedEmailLLMResult | null> {
  const raw = await callOpenAIRaw(systemPrompt, userInput, temperature);
  if (!raw) return null;
  return {
    is_job_related: typeof raw.is_job_related === 'boolean' ? raw.is_job_related : true,
    company_name: raw.company_name || null,
    job_title: raw.job_title || null,
    event_type: raw.event_type || 'other',
    status: raw.status || 'Other',
    interview_date: raw.interview_date || null,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
    portal_domain: null,
    job_id: null,
  };
}

/**
 * Calls OpenAI and returns the full parsed JSON without flattening.
 * Used by Prompt B to preserve nested interview/assessment structures.
 */
export async function callOpenAIRaw(
  systemPrompt: string,
  userInput: string,
  temperature: number = 0.1
): Promise<Record<string, any> | null> {
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured');
    return null;
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput },
        ],
        temperature,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.warn('No content in OpenAI response');
      return null;
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return null;
  }
}

// ============================================================================
// Ensemble LLM Parsing
// ============================================================================

export async function parseEmailWithLLM(
  subject: string | null | undefined,
  from: string | null | undefined,
  snippet: string | null | undefined,
  body?: string | null
): Promise<ParsedEmailLLMResult> {
  const defaultResult: ParsedEmailLLMResult = {
    is_job_related: true,
    company_name: null,
    job_title: null,
    event_type: 'other',
    status: 'Other',
    interview_date: null,
    confidence: 0.3,
    portal_domain: null,
    job_id: null,
  };

  // Use raw call so we can access Prompt B's nested interview/assessment structures.
  const raw = await callOpenAIRaw(PROMPT_B_SYSTEM, buildPromptBInput(subject, from, snippet, body));
  if (!raw) {
    return defaultResult;
  }

  // Prefer top-level interview_date; fall back to first date_time_candidate from the
  // nested interview block that Prompt B may return.
  let interviewDate: string | null = raw.interview_date || null;
  if (!interviewDate && Array.isArray(raw.interview?.date_time_candidates) && raw.interview.date_time_candidates.length > 0) {
    interviewDate = raw.interview.date_time_candidates[0] || null;
  }
  // For assessment events, try the assessment deadline as a fallback date.
  if (!interviewDate && raw.assessment?.deadline) {
    interviewDate = raw.assessment.deadline || null;
  }

  return {
    is_job_related: typeof raw.is_job_related === 'boolean' ? raw.is_job_related : true,
    company_name: raw.company_name || null,
    job_title: raw.job_title || null,
    event_type: raw.event_type || 'other',
    status: raw.status || 'Other',
    interview_date: interviewDate,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
    portal_domain: raw.portal_domain || null,
    job_id: raw.job_id || null,
  };
}

// ============================================================================
// Combined Parsing (Heuristics + LLM)
// ============================================================================

export async function parseEmailCombined(
  subject: string | null | undefined,
  from: string | null | undefined,
  snippet: string | null | undefined,
  body?: string | null,
  useLLM: boolean = true
): Promise<ParsedEmailLLMResult> {
  // Start with heuristic extraction
  const companyResult = CompanyUtils.extractCompany(subject, body, from, snippet);
  const roleResult = JobUtils.extractJobTitle(subject, body, from, snippet);

  // Extract URLs for portal domain and job ID
  const urls = extractUrlsFromText(body || snippet || '');
  const portalDomain = extractPortalDomain(urls);
  const jobId = extractJobIdFromUrls(urls);

  // Get heuristic-based result
  const heuristicResult: ParsedEmailLLMResult = {
    company_name: companyResult.value,
    job_title: JobUtils.cleanJobTitle(roleResult.value),
    event_type: 'other',
    status: 'Other',
    interview_date: null,
    confidence: 0.5,
    portal_domain: portalDomain,
    job_id: jobId,
    is_job_related: true, // Optimistically assume true for heuristics alone
  };

  // Determine status from heuristics
  const heuristicStatus = determineStatusHeuristic(subject, body, snippet);
  if (heuristicStatus) {
    heuristicResult.status = heuristicStatus;
    // Map status to event_type
    if (heuristicStatus === 'Applied') heuristicResult.event_type = 'application_received';
    else if (heuristicStatus === 'Interview') heuristicResult.event_type = 'interview_invite';
    else if (heuristicStatus === 'Assessment') heuristicResult.event_type = 'assessment';
    else if (heuristicStatus === 'Rejected') heuristicResult.event_type = 'rejection';
    else if (heuristicStatus === 'Offer') heuristicResult.event_type = 'offer';
  }

  // If LLM is disabled return heuristics
  if (!useLLM) {
    return heuristicResult;
  }

  // Always use LLM when enabled to improve accuracy
  const llmResult = await parseEmailWithLLM(subject, from, snippet, body);

  // If LLM explicitly determines this is not job-related, return immediately with the flag
  if (llmResult.is_job_related === false) {
    return {
      ...llmResult,
      is_job_related: false,
    };
  }

  const llmCompanyValid = llmResult.company_name && !CompanyUtils.isLikelyNotCompany(llmResult.company_name);
  const llmRoleValid = llmResult.job_title && !JobUtils.isLikelyNotRole(llmResult.job_title);

  // Trust LLM first for structured data, fall back to heuristics
  const finalResult: ParsedEmailLLMResult = {
    company_name: llmCompanyValid ? llmResult.company_name : heuristicResult.company_name,
    job_title: llmRoleValid ? llmResult.job_title : heuristicResult.job_title,
    event_type: llmResult.event_type !== 'other'
      ? llmResult.event_type
      : (heuristicResult.event_type !== 'other' ? heuristicResult.event_type : 'other'),
    status: llmResult.status !== 'Other'
      ? llmResult.status
      : (heuristicResult.status !== 'Other' ? heuristicResult.status : 'Other'),
    interview_date: llmResult.interview_date, // LLM is better at date extraction
    confidence: Math.max(heuristicResult.confidence, llmResult.confidence),
    portal_domain: portalDomain,
    job_id: jobId,
    is_job_related: true,
  };

  return finalResult;
}

function extractSenderEmail(from?: string | null): string | null {
  if (!from) return null;
  const angleMatch = from.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();
  const emailMatch = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch?.[0]) return emailMatch[0].trim();
  return null;
}

// ============================================================================
// Batch LLM Parsing
// ============================================================================

// 5 emails × 500 max output tokens = 2500 tokens per request.
// At gpt-4o-mini's ~200 tok/s output rate that's ~12 seconds, well inside the 40s timeout.
// 10-email batches were hitting 7000 max_tokens (~35s) and reliably timing out at 25s.
const BATCH_SIZE = 10;
const MAX_TOKENS_PER_EMAIL_BATCH = 650;
const MAX_BATCH_BODY_CHARS = 2500;
const MAX_CONCURRENT_LLM_BATCHES = 1;
const NULLABLE_STRING_SCHEMA = { anyOf: [{ type: 'string' }, { type: 'null' }] };
const EMAIL_PARSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    is_job_related: { type: 'boolean' },
    relevance_type: { type: 'string', enum: ['application', 'interview', 'assessment', 'rejection', 'offer', 'recruiter', 'scheduling', 'followup', 'job_alert', 'other'] },
    company_name: NULLABLE_STRING_SCHEMA,
    role_title: NULLABLE_STRING_SCHEMA,
    event_type: { type: 'string', enum: ['application_received', 'interview_invite', 'assessment', 'rejection', 'offer', 'other'] },
    deadline: NULLABLE_STRING_SCHEMA,
    event_date: NULLABLE_STRING_SCHEMA,
    recruiter_name: NULLABLE_STRING_SCHEMA,
    recruiter_email: NULLABLE_STRING_SCHEMA,
    action_required: { type: 'boolean' },
    action_summary: NULLABLE_STRING_SCHEMA,
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    evidence: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'is_job_related', 'relevance_type', 'company_name', 'role_title', 'event_type',
    'deadline', 'event_date', 'recruiter_name', 'recruiter_email', 'action_required',
    'action_summary', 'confidence', 'evidence',
  ],
};

const PROMPT_BATCH_SYSTEM = `${PROMPT_B_SYSTEM}

---
ADDITIONAL EXTRACTION RULES:
- If the email body contains raw HTML, CSS, or is otherwise unreadable, extract company_name and role_title from the Subject line and From address instead. Do not return null just because the body is garbled.
- The Subject line alone is often sufficient: "Thank you for applying to Acme Corp" → company_name="Acme Corp"; "Application received for Senior Engineer at Acme Corp" → company_name="Acme Corp", role_title="Senior Engineer".
- Common subject patterns and what to extract:
  * "Thank you for applying to [COMPANY]" → company_name=[COMPANY], role_title=null (role not stated)
  * "Thank you for your interest in [COMPANY]" → company_name=[COMPANY], role_title=null
  * "Application Received: ... for your interest in [COMPANY]" → company=[COMPANY]
  * "Your application for [ROLE] at [COMPANY]" → both fields
  * "Application received for [ROLE]" → role_title=[ROLE]
  * "[COMPANY] — Your application" → company=[COMPANY]
- If no job title is mentioned anywhere in subject or body, return role_title=null (that is correct, do not guess).
- Non-job emails to reject (is_job_related=false): account verification emails, password resets, identity checks, newsletters, promotional emails, job alert digests, system notifications unrelated to a specific application you sent.

You will receive MULTIPLE emails in one request. Each email is delimited by "=== EMAIL N ===" markers (where N is the 1-based index). Analyze each email INDEPENDENTLY using all the rules above.

Return a single JSON object with a "results" array containing exactly one result per email in the same order as the input. Each result must use the same output schema described above.

Output ONLY valid JSON:
{"results": [<result for EMAIL 1>, <result for EMAIL 2>, ...]}`;

function buildBatchEmailInput(
  email: { subject?: string | null; from?: string | null; snippet?: string | null; body?: string | null; date?: string | null },
  index: number
): string {
  const parts: string[] = [`=== EMAIL ${index + 1} ===`];
  if (email.subject) parts.push(`Subject: ${normalizeText(email.subject)}`);
  if (email.from) parts.push(`From: ${email.from}`);
  if (email.date) parts.push(`Date: ${email.date}`);
  const senderEmail = extractSenderEmail(email.from);
  if (senderEmail) parts.push(`Sender Email: ${senderEmail}`);
  if (email.snippet) parts.push(`Snippet: ${normalizeText(email.snippet)}`);
  if (email.body) {
    const cleaned = prepareEmailBodyForLlm(email.body);
    if (cleaned) parts.push(`Body:\n${cleaned.slice(0, MAX_BATCH_BODY_CHARS)}`);
  }
  return parts.join('\n');
}

/**
 * Sends multiple emails in a single OpenAI request and returns one parsed result per email.
 * Returns null for any email where parsing failed.
 */
export async function callOpenAIBatch(
  emails: Array<{ subject?: string | null; from?: string | null; snippet?: string | null; body?: string | null; date?: string | null }>,
  fetchImpl: typeof fetch = fetch,
): Promise<Array<Record<string, any> | null>> {
  if (!OPENAI_API_KEY || emails.length === 0) return emails.map(() => null);

  const userInput = emails.map((e, i) => buildBatchEmailInput(e, i)).join('\n\n');
  const maxTokens = MAX_TOKENS_PER_EMAIL_BATCH * emails.length;

  for (let attempt = 0; attempt < OPENAI_BATCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: PROMPT_BATCH_SYSTEM },
          { role: 'user', content: userInput },
        ],
        temperature: 0.1,
        max_tokens: maxTokens,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'basafy_email_parse_batch',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                results: { type: 'array', items: EMAIL_PARSE_SCHEMA },
              },
              required: ['results'],
            },
          },
        },
      }),
        signal: AbortSignal.timeout(OPENAI_BATCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const retryable = isRetryableOpenAIStatus(response.status);
        console.warn(`OpenAI batch attempt ${attempt + 1} failed: ${response.status} - ${errorText.slice(0, 500)}`);
        if (!retryable || attempt === OPENAI_BATCH_MAX_ATTEMPTS - 1) return emails.map(() => null);
        await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt)));
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return emails.map(() => null);

      const parsed = JSON.parse(content);
      const results: Array<Record<string, any> | null> = Array.isArray(parsed.results) ? parsed.results : [];
      while (results.length < emails.length) results.push(null);
      return results.slice(0, emails.length);
    } catch (err) {
      console.warn(`OpenAI batch attempt ${attempt + 1} failed:`, err);
      if (attempt === OPENAI_BATCH_MAX_ATTEMPTS - 1) return emails.map(() => null);
      await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt)));
    }
  }
  return emails.map(() => null);
}

const VALID_RELEVANCE_TYPES = new Set([
  'application', 'interview', 'assessment', 'rejection', 'offer',
  'recruiter', 'scheduling', 'followup', 'job_alert', 'other',
]);
const VALID_EVENT_TYPES = new Set([
  'application_received', 'interview_invite', 'assessment', 'rejection', 'offer', 'other',
]);

export function validateStructuredEmailParse(raw: Record<string, any> | null): {
  valid: boolean;
  error: string | null;
} {
  if (!raw) return { valid: false, error: 'LLM returned no structured result.' };
  const nullableString = (value: unknown) => value === null || typeof value === 'string';
  if (typeof raw.is_job_related !== 'boolean') return { valid: false, error: 'is_job_related must be boolean.' };
  if (!VALID_RELEVANCE_TYPES.has(raw.relevance_type)) return { valid: false, error: 'Invalid relevance_type.' };
  if (!VALID_EVENT_TYPES.has(raw.event_type)) return { valid: false, error: 'Invalid event_type.' };
  for (const field of ['company_name', 'role_title', 'deadline', 'event_date', 'recruiter_name', 'recruiter_email', 'action_summary']) {
    if (!nullableString(raw[field])) return { valid: false, error: `${field} must be a string or null.` };
  }
  if (typeof raw.action_required !== 'boolean') return { valid: false, error: 'action_required must be boolean.' };
  if (typeof raw.confidence !== 'number' || raw.confidence < 0 || raw.confidence > 1) {
    return { valid: false, error: 'confidence must be between 0 and 1.' };
  }
  if (!Array.isArray(raw.evidence) || raw.evidence.some((item: unknown) => typeof item !== 'string')) {
    return { valid: false, error: 'evidence must be an array of strings.' };
  }
  return { valid: true, error: null };
}

export function rawToLLMResult(raw: Record<string, any> | null): ParsedEmailLLMResult {
  const validation = validateStructuredEmailParse(raw);
  if (!validation.valid || !raw) {
    return {
      is_job_related: undefined,
      company_name: null,
      job_title: null,
      event_type: 'other',
      status: 'Other',
      interview_date: null,
      confidence: 0,
      portal_domain: null,
      job_id: null,
      diagnostics: {
        llmAvailable: Boolean(raw),
        rawLlmResult: raw,
        unknownNeedsReview: true,
        validationError: validation.error,
      },
    };
  }
  const statusByEvent: Record<string, ParsedEmailLLMResult['status']> = {
    application_received: 'Applied',
    interview_invite: 'Interview',
    assessment: 'Assessment',
    rejection: 'Rejected',
    offer: 'Offer',
    other: 'Other',
  };
  return {
    is_job_related: raw.is_job_related,
    relevance_type: raw.relevance_type,
    company_name: raw.company_name || null,
    job_title: raw.role_title || null,
    event_type: raw.event_type,
    status: statusByEvent[raw.event_type] ?? 'Other',
    interview_date: raw.event_date || raw.deadline || null,
    confidence: raw.confidence,
    portal_domain: null,
    job_id: null,
    deadline: raw.deadline,
    event_date: raw.event_date,
    recruiter_name: raw.recruiter_name,
    recruiter_email: raw.recruiter_email,
    action_required: raw.action_required,
    action_summary: raw.action_summary,
    evidence: raw.evidence,
    diagnostics: { llmAvailable: true, rawLlmResult: raw, unknownNeedsReview: false, validationError: null },
  };
}

/**
 * Parses all messages with the LLM using batched API calls (BATCH_SIZE emails per request).
 * Returns one ParsedEmailLLMResult per input message, in the same order.
 * Falls back to a safe default for any message where the batch call fails.
 */
export async function parseEmailsBatchLLM(messages: GmailMessage[]): Promise<ParsedEmailLLMResult[]> {
  const emailInputs = messages.map((msg) => ({
    subject: msg.subject,
    from: msg.from,
    snippet: msg.snippet,
    body: msg.bodyText,
    date: msg.internalDate,
  }));

  const chunks: Array<{
    start: number;
    emails: Array<{ subject?: string | null; from?: string | null; snippet?: string | null; body?: string | null; date?: string | null }>;
  }> = [];
  for (let i = 0; i < emailInputs.length; i += BATCH_SIZE) {
    chunks.push({
      start: i,
      emails: emailInputs.slice(i, i + BATCH_SIZE),
    });
  }

  const allRaws: Array<Record<string, any> | null> = new Array(emailInputs.length).fill(null);
  const startMs = Date.now();
  let nextChunkIndex = 0;

  async function worker() {
    while (true) {
      const chunkIndex = nextChunkIndex++;
      if (chunkIndex >= chunks.length) return;

      const chunk = chunks[chunkIndex];
      if (!chunk) return;

      // Leave headroom for the write stage within the edge runtime wall clock limit.
      if (Date.now() - startMs > 100_000) {
        console.warn(`[llm] Time budget exceeded after ${chunk.start} emails, skipping remaining`);
        return;
      }

      console.info(
        `[llm] Batch call: emails ${chunk.start + 1}–${chunk.start + chunk.emails.length} of ${emailInputs.length}`
      );
      const batchResults = await callOpenAIBatch(chunk.emails);
      for (let i = 0; i < batchResults.length; i++) {
        allRaws[chunk.start + i] = batchResults[i] ?? null;
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_LLM_BATCHES, chunks.length || 1) },
      () => worker()
    )
  );

  return allRaws.map(rawToLLMResult);
}

/**
 * Runs heuristic extraction for a single email and merges with a pre-computed LLM result.
 * Use this instead of parseEmailCombined when LLM results are already available from a batch call.
 */
export function parseEmailCombinedWithLLM(
  subject: string | null | undefined,
  from: string | null | undefined,
  snippet: string | null | undefined,
  body: string | null | undefined,
  llmResult: ParsedEmailLLMResult
): ParsedEmailLLMResult {
  // Run heuristics
  const companyResult = CompanyUtils.extractCompany(subject, body, from, snippet);
  const roleResult = JobUtils.extractJobTitle(subject, body, from, snippet);
  const urls = extractUrlsFromText(body || snippet || '');
  const portalDomain = extractPortalDomain(urls);
  const jobId = extractJobIdFromUrls(urls);
  const heuristicStatus = determineStatusHeuristic(subject, body, snippet);

  const heuristicResult: ParsedEmailLLMResult = {
    company_name: companyResult.value,
    job_title: JobUtils.cleanJobTitle(roleResult.value),
    event_type: 'other',
    status: 'Other',
    interview_date: null,
    confidence: 0.5,
    portal_domain: portalDomain,
    job_id: jobId,
    is_job_related: true,
  };
  const diagnostics = {
    llmAvailable: llmResult.diagnostics?.llmAvailable ?? false,
    rawLlmResult: llmResult.diagnostics?.rawLlmResult ?? null,
    heuristicResult: {
      company_name: heuristicResult.company_name,
      job_title: heuristicResult.job_title,
      event_type: heuristicResult.event_type,
      status: heuristicResult.status,
      confidence: heuristicResult.confidence,
      portal_domain: heuristicResult.portal_domain,
      job_id: heuristicResult.job_id,
    },
    classificationSource: llmResult.diagnostics?.llmAvailable ? 'llm_with_heuristics' : 'heuristic_fallback',
    unknownNeedsReview: llmResult.diagnostics?.unknownNeedsReview ?? false,
    validationError: llmResult.diagnostics?.validationError ?? null,
  };

  if (diagnostics.unknownNeedsReview) {
    return { ...llmResult, is_job_related: undefined, diagnostics: { ...diagnostics, classificationSource: 'invalid_llm_output' } };
  }

  if (heuristicStatus) {
    heuristicResult.status = heuristicStatus;
    if (heuristicStatus === 'Applied') heuristicResult.event_type = 'application_received';
    else if (heuristicStatus === 'Interview') heuristicResult.event_type = 'interview_invite';
    else if (heuristicStatus === 'Assessment') heuristicResult.event_type = 'assessment';
    else if (heuristicStatus === 'Rejected') heuristicResult.event_type = 'rejection';
    else if (heuristicStatus === 'Offer') heuristicResult.event_type = 'offer';
  }

  // An ATS sender is retrieval evidence, not proof of application activity. Only
  // override an explicit LLM rejection when the content names a concrete entity
  // and contains a specific hiring-lifecycle phrase.
  if (llmResult.is_job_related === false) {
    const content = `${subject || ''}\n${snippet || ''}\n${body || ''}`;
    const hasSpecificLifecycleSignal = /\b(thank you for applying|application (?:was |has been )?(?:received|submitted)|we received your application|interview (?:invitation|request|scheduled)|invite you to (?:an? )?interview|schedule (?:an? )?(?:phone|video|technical|onsite )?interview|complete (?:the|this|your|an?) (?:coding )?(?:assessment|challenge|test)|not moving forward with (?:your application|your candidacy|you)|offer letter|pleased to offer you)\b/i.test(content);
    const heuristicHasStrongCompany = !!companyResult.value && companyResult.source !== 'from';
    const heuristicHasStrongRole = !!roleResult.value && roleResult.source !== 'from';
    const canOverrideRejection = hasSpecificLifecycleSignal
      && (heuristicHasStrongCompany || heuristicHasStrongRole);

    if (!canOverrideRejection) {
      return { ...llmResult, is_job_related: false, diagnostics };
    }
    console.info('[llm] Overriding LLM rejection with specific lifecycle and entity evidence');
  }

  const llmCompanyValid = llmResult.company_name && !CompanyUtils.isLikelyNotCompany(llmResult.company_name);
  const llmRoleValid = llmResult.job_title && !JobUtils.isLikelyNotRole(llmResult.job_title);

  return {
    company_name: llmCompanyValid ? llmResult.company_name : heuristicResult.company_name,
    job_title: llmRoleValid ? llmResult.job_title : heuristicResult.job_title,
    event_type: llmResult.event_type !== 'other'
      ? llmResult.event_type
      : (heuristicResult.event_type !== 'other' ? heuristicResult.event_type : 'other'),
    status: llmResult.status !== 'Other'
      ? llmResult.status
      : (heuristicResult.status !== 'Other' ? heuristicResult.status : 'Other'),
    interview_date: llmResult.interview_date,
    confidence: Math.max(heuristicResult.confidence, llmResult.confidence),
    portal_domain: portalDomain,
    job_id: jobId,
    is_job_related: true,
    diagnostics,
  };
}
