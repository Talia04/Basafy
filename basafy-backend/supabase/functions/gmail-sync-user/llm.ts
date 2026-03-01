// LLM (OpenAI) integration for email parsing

import type { ParsedEmailLLMResult, ParsedEmailResult } from './types.ts';
import { normalizeText, stripQuotedReplies, extractUrlsFromText } from './utils.ts';
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
1. is_job_related: Set to false IMMEDIATELY if the email is a newsletter, job alert, digest, marketing, password reset, general update, or anything not DIRECTLY related to the user's active application with a SPECIFIC company. Set to true ONLY if it relates strictly to an application, interview, assessment, offer, or rejection for the user.
2. Rejections can mention "interview" or "schedule" (e.g., "we are unable to offer an interview"). If it is a rejection, classify it as "rejection" even if interview terms appear.

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
- Extract all proposed date/time candidates (ISO 8601 format with timezone if available)
- Extract any meeting links (Zoom, Google Meet, Teams, Calendly, etc.) or scheduling links
- Set "requested" to true if the email is inviting the candidate to an interview

ASSESSMENT EXTRACTION:
- Look for coding challenges, take-home assignments, technical assessments, HackerRank/CodeSignal/Codility links
- Extract the deadline if mentioned
- Extract the assessment link if provided
- Set "invited" to true if the candidate is being asked to complete an assessment

Return ONLY valid JSON with this structure:
{
  "is_job_related": boolean,
  "company_name": string | null,
  "job_title": string | null,
  "event_type": "application_received" | "interview_invite" | "assessment" | "rejection" | "offer" | "other",
  "status": "Applied" | "Interview" | "Assessment" | "Rejected" | "Offer" | "Other",
  "interview_date": string | null,
  "confidence": number,
  "interview": {
    "requested": boolean,
    "date_time_candidates": [string] | [],
    "meeting_link": string | null,
    "scheduling_link": string | null,
    "interview_type": "phone" | "video" | "onsite" | "technical" | "behavioral" | "panel" | "other" | null
  },
  "assessment": {
    "invited": boolean,
    "deadline": string | null,
    "assessment_link": string | null,
    "platform": string | null
  }
}`;

// ============================================================================
// Prompt Input Builders
// ============================================================================

const MAX_LLM_BODY_CHARS = 12000;
const LLM_BODY_HEAD_CHARS = 9000;
const LLM_BODY_TAIL_CHARS = 3000;

function buildLlmBody(text: string): string {
  const cleaned = normalizeText(stripQuotedReplies(text));
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

  const result = await callOpenAI(PROMPT_B_SYSTEM, buildPromptBInput(subject, from, snippet, body));
  if (!result) {
    return defaultResult;
  }

  return {
    is_job_related: typeof result.is_job_related === 'boolean' ? result.is_job_related : true,
    company_name: result.company_name || null,
    job_title: result.job_title || null,
    event_type: result.event_type || 'other',
    status: result.status || 'Other',
    interview_date: result.interview_date || null,
    confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
    portal_domain: result.portal_domain || null,
    job_id: result.job_id || null,
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
