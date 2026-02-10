// LLM (OpenAI) integration for email parsing

import type { ParsedEmailResult } from './types.ts';
import { normalizeText, stripQuotedReplies, extractUrlsFromText } from './utils.ts';
import { extractPortalDomain, extractJobIdFromUrls, CompanyUtils, JobUtils } from './parsers.ts';

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

export function buildPromptAInput(
  subject: string | null | undefined,
  from: string | null | undefined,
  snippet: string | null | undefined,
  body?: string | null
): string {
  const parts: string[] = [];

  if (subject) parts.push(`Subject: ${normalizeText(subject)}`);
  if (from) parts.push(`From: ${from}`);
  if (snippet) parts.push(`Snippet: ${normalizeText(snippet)}`);

  if (body) {
    const cleanBody = stripQuotedReplies(body);
    // Limit body length to avoid token limits
    const truncatedBody = cleanBody.length > 2000 ? cleanBody.substring(0, 2000) + '...' : cleanBody;
    parts.push(`Body:\n${truncatedBody}`);
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

  if (from) parts.push(`Sender: ${from}`);
  if (subject) parts.push(`Email Subject: ${normalizeText(subject)}`);

  const bodyText = body || snippet;
  if (bodyText) {
    const cleanBody = stripQuotedReplies(bodyText);
    const truncatedBody = cleanBody.length > 2500 ? cleanBody.substring(0, 2500) + '...' : cleanBody;
    parts.push(`Email Content:\n${truncatedBody}`);
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
): Promise<ParsedEmailResult | null> {
  const raw = await callOpenAIRaw(systemPrompt, userInput, temperature);
  if (!raw) return null;
  return {
    company_name: raw.company_name || null,
    job_title: raw.job_title || null,
    event_type: raw.event_type || 'other',
    status: raw.status || 'Other',
    interview_date: raw.interview_date || null,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
    is_job_related: raw.is_job_related,
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
): Promise<ParsedEmailResult> {
  const defaultResult: ParsedEmailResult = {
    company_name: null,
    job_title: null,
    event_type: 'other',
    status: 'Other',
    interview_date: null,
    confidence: 0.3,
  };

  // Try both prompts in parallel for better coverage
  const [resultA, resultB] = await Promise.all([
    callOpenAI(PROMPT_A_SYSTEM, buildPromptAInput(subject, from, snippet, body)),
    callOpenAI(PROMPT_B_SYSTEM, buildPromptBInput(subject, from, snippet, body)),
  ]);

  if (!resultA && !resultB) {
    return defaultResult;
  }

  // If only one succeeded, use it
  if (!resultA) return resultB!;
  if (!resultB) return resultA;

  // Ensemble: merge results, preferring higher confidence
  const merged: ParsedEmailResult = {
    company_name: null,
    job_title: null,
    event_type: 'other',
    status: 'Other',
    interview_date: null,
    confidence: Math.max(resultA.confidence, resultB.confidence),
  };

  // Company: prefer the one that's not an ATS name
  const companyA = resultA.company_name;
  const companyB = resultB.company_name;
  if (companyA && companyB) {
    // If both exist, prefer the one that looks more like a real company
    if (CompanyUtils.isLikelyNotCompany(companyA) && !CompanyUtils.isLikelyNotCompany(companyB)) {
      merged.company_name = companyB;
    } else if (!CompanyUtils.isLikelyNotCompany(companyA) && CompanyUtils.isLikelyNotCompany(companyB)) {
      merged.company_name = companyA;
    } else {
      // Prefer the higher confidence one
      merged.company_name = resultA.confidence >= resultB.confidence ? companyA : companyB;
    }
  } else {
    merged.company_name = companyA || companyB;
  }

  // Job title: prefer the more specific one
  const titleA = resultA.job_title;
  const titleB = resultB.job_title;
  if (titleA && titleB) {
    // Prefer longer, more specific titles
    if (JobUtils.isLikelyJobTitle(titleA) && !JobUtils.isLikelyJobTitle(titleB)) {
      merged.job_title = titleA;
    } else if (!JobUtils.isLikelyJobTitle(titleA) && JobUtils.isLikelyJobTitle(titleB)) {
      merged.job_title = titleB;
    } else {
      merged.job_title = titleA.length >= titleB.length ? titleA : titleB;
    }
  } else {
    merged.job_title = titleA || titleB;
  }

  // Event type and status: prefer non-"other" values
  if (resultA.event_type !== 'other' && resultB.event_type === 'other') {
    merged.event_type = resultA.event_type;
    merged.status = resultA.status;
  } else if (resultA.event_type === 'other' && resultB.event_type !== 'other') {
    merged.event_type = resultB.event_type;
    merged.status = resultB.status;
  } else {
    // Both have event types, prefer higher confidence
    if (resultA.confidence >= resultB.confidence) {
      merged.event_type = resultA.event_type;
      merged.status = resultA.status;
    } else {
      merged.event_type = resultB.event_type;
      merged.status = resultB.status;
    }
  }

  // Interview date
  merged.interview_date = resultA.interview_date || resultB.interview_date;

  return merged;
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
): Promise<ParsedEmailResult> {
  // Start with heuristic extraction
  const companyResult = CompanyUtils.extractCompany(subject, body, from, snippet);
  const roleResult = JobUtils.extractJobTitle(subject, body, from, snippet);

  // Extract URLs for portal domain and job ID
  const urls = extractUrlsFromText(body || snippet || '');
  const portalDomain = extractPortalDomain(urls);
  const jobId = extractJobIdFromUrls(urls);

  // Get heuristic-based result
  const heuristicResult: ParsedEmailResult = {
    company_name: companyResult.value,
    job_title: JobUtils.cleanJobTitle(roleResult.value),
    event_type: 'other',
    status: 'Other',
    interview_date: null,
    confidence: 0.5,
    portal_domain: portalDomain,
    job_id: jobId,
  };

  // Determine status from heuristics
  const { determineStatusHeuristic, statusFromEventType } = await import('./parsers.ts');
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

  // If LLM is disabled or we have high-confidence heuristic results, return early
  if (!useLLM) {
    return heuristicResult;
  }

  // If heuristics already found company and role with good confidence, skip LLM
  if (heuristicResult.company_name && heuristicResult.job_title && heuristicResult.status !== 'Other') {
    heuristicResult.confidence = 0.85;
    return heuristicResult;
  }

  // Use LLM to fill in gaps
  const llmResult = await parseEmailWithLLM(subject, from, snippet, body);

  // Merge results, preferring heuristics for company/role (more reliable patterns)
  // but using LLM for event_type/status if heuristics couldn't determine
  const finalResult: ParsedEmailResult = {
    company_name: heuristicResult.company_name || llmResult.company_name,
    job_title: heuristicResult.job_title || llmResult.job_title,
    event_type: heuristicResult.event_type !== 'other' ? heuristicResult.event_type : llmResult.event_type,
    status: heuristicResult.status !== 'Other' ? heuristicResult.status : llmResult.status,
    interview_date: llmResult.interview_date, // LLM is better at date extraction
    confidence: Math.max(heuristicResult.confidence, llmResult.confidence),
    portal_domain: portalDomain,
    job_id: jobId,
  };

  return finalResult;
}
