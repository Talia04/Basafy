/* @ts-ignore
   VSCode/TypeScript may show errors for remote imports and Deno global.
   These are expected for Deno edge functions and do not affect runtime.
*/
// Edge function: Gmail sync entry point
// @ts-ignore
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

// Use non-SUPABASE_ prefixes because Supabase CLI blocks them in secrets
// @ts-ignore
const SUPABASE_URL = Deno.env.get('PROJECT_URL');
// @ts-ignore
const SUPABASE_ANON_KEY = Deno.env.get('ANON_KEY');
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');
// @ts-ignore
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
// @ts-ignore
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
// @ts-ignore
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI');

type GmailConnection = {
  id?: string | null;
  user_id: string;
  email: string | null;
  refresh_token: string | null;
  provider: string | null;
  backfill_page_token?: string | null;
  backfill_started_at?: string | null;
  backfill_completed_at?: string | null;
  backfill_total_estimate?: number | null;
  backfill_processed_count?: number | null;
};

type GmailMessage = {
  id: string;
  threadId?: string;
  subject?: string;
  from?: string;
  internetMessageId?: string | null;
  internalDate?: string;
  internalTimestamp?: number;
  snippet?: string;
  bodyText?: string | null;
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function getAccessToken(refresh_token: string) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google client credentials missing on server');
  }
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Unable to refresh Google access token');
  }
  return data.access_token as string;
}

async function exchangeAuthCodeForTokens(authCode: string) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google client credentials missing on server');
  }
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code: authCode,
      grant_type: 'authorization_code',
      ...(GOOGLE_REDIRECT_URI ? { redirect_uri: GOOGLE_REDIRECT_URI } : {}),
    }),
  });
  const raw = await resp.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }
  if (!resp.ok) {
    console.error('gmail-sync-user token exchange failed', {
      status: resp.status,
      body: data,
    });
    throw new Error(
      (data as any).error_description || (data as any).error || 'Unable to exchange Google auth code',
    );
  }
  return data as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
}

async function listMessages(
  accessToken: string,
  query: string,
  maxResults = 100,
  pageToken?: string
) {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(maxResults));
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || 'Failed to list Gmail messages');
  }
  return {
    messages: (data.messages || []) as { id: string }[],
    nextPageToken: data.nextPageToken as string | undefined,
    resultSizeEstimate: typeof data.resultSizeEstimate === 'number' ? data.resultSizeEstimate : null,
  };
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractPlainText(payload: any): string | null {
  if (!payload) return null;
  const mimeType = payload.mimeType || '';
  const bodyData = payload.body?.data;
  if (mimeType.startsWith('text/plain') && bodyData) {
    return decodeBase64Url(bodyData);
  }
  if (mimeType.startsWith('text/html') && bodyData) {
    return stripHtml(decodeBase64Url(bodyData));
  }
  const parts = payload.parts || [];
  for (const part of parts) {
    const text = extractPlainText(part);
    if (text) return text;
  }
  return null;
}

function normalizeText(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizeFirstLetter(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

const ATS_WORDS = [
  'workday',
  'myworkday',
  'myworkdayjobs',
  'workdayjobs',
  'ashby',
  'ashbyhq',
  'icims',
  'greenhouse',
  'grnh',
  'lever',
  'smartrecruiters',
  'taleo',
  'successfactors',
  'workable',
  'jobvite',
  'bamboohr',
  'recruitee',
  'breezy',
  'rippling',
  'applytojob',
  'interviewing',
  'greenhouse-mail',
  'smartrecruiters',
  'glassdoor',
  'jointaro',
  'gmail',
  'mail',
  'talent',
  'recruiting',
  'careers',
  'jobs',
  'candidate portal',
  'candidate login',
  'job requisition',
  // Additional ATS platforms
  'wellfound',
  'angellist',
  'hired',
  'triplebyte',
  'vettery',
  'underdog',
  'otta',
  'cord',
  'ycombinator',
  'workatastartup',
  'angel',
  'notion',
  'lattice',
  'gusto',
  'deel',
  'remote',
  'oyster',
  'factorial',
  'personio',
  'sage',
  'zenefits',
  'namely',
  'paylocity',
  'paycom',
  'ceridian',
  'ultipro',
  'kronos',
  'ukg',
  'adp',
  'paychex',
];

const ATS_DOMAINS = [
  'workday.com',
  'myworkday.com',
  'myworkdayjobs.com',
  'ashbyhq.com',
  'icims.com',
  'greenhouse.io',
  'grnh.se',
  'jobs.lever.co',
  'hire.lever.co',
  'smartrecruiters.com',
  'taleo.net',
  'successfactors.com',
  'workable.com',
  'jobvite.com',
  'bamboohr.com',
  'recruitee.com',
  'breezy.hr',
  // Additional ATS domains
  'wellfound.com',
  'angel.co',
  'hired.com',
  'triplebyte.com',
  'vettery.com',
  'underdog.io',
  'otta.com',
  'cord.co',
  'workatastartup.com',
  'eightfold.ai',
  'phenom.com',
  'beamery.com',
  'gem.com',
  'hiretual.com',
  'seekout.com',
  'entelo.com',
  'findem.ai',
  'paradox.ai',
  'xor.ai',
  'mya.com',
  'olivia.paradox.ai',
  'humanly.io',
  'fetcher.ai',
  'hireez.com',
  'sourcinghub.io',
  'textrecruit.com',
  'grayscale.io',
  'fountain.com',
  'retool.com',
  'apply.workable.com',
  'jobs.ashbyhq.com',
  'boards.eu.greenhouse.io',
  'app.dover.io',
  'dover.io',
  'hirebridge.com',
  'jazz.co',
  'jazzhr.com',
  'clearcompany.com',
  'paycor.com',
  'ultipro.com',
  'ukg.com',
  'cornerstoneondemand.com',
  'dayforce.com',
];

// Batch size for parallel message fetching
const BATCH_SIZE = 10;
const MAX_CONCURRENT_BATCHES = 3;

const COMPANY_MIN_SCORE = 4;

function looksLikeUrl(text?: string | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return t.includes('http://') || t.includes('https://') || t.includes('www.') || /\.[a-z]{2,}$/i.test(t);
}

function isAtsName(text?: string | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  if (!t) return false;
  if (ATS_WORDS.some((word) => t === word || t.includes(word))) return true;
  if (t.includes('.')) return true;
  if (ATS_DOMAINS.some((domain) => t.includes(domain))) return true;
  return false;
}

function detectPlatform(from?: string | null, body?: string | null, snippet?: string | null): string | null {
  const text = `${from || ''} ${body || ''} ${snippet || ''}`.toLowerCase();
  if (text.includes('ashbyhq.com') || text.includes('ashby')) return 'ashby';
  if (text.includes('workday.com') || text.includes('myworkday') || text.includes('workday')) return 'workday';
  if (text.includes('greenhouse.io') || text.includes('grnh.se') || text.includes('greenhouse')) return 'greenhouse';
  if (text.includes('jobs.lever.co') || text.includes('hire.lever.co') || text.includes('lever')) return 'lever';
  if (text.includes('icims.com') || text.includes('icims')) return 'icims';
  if (text.includes('smartrecruiters.com') || text.includes('smartrecruiters')) return 'smartrecruiters';
  if (text.includes('taleo.net') || text.includes('taleo')) return 'taleo';
  if (text.includes('successfactors.com') || text.includes('successfactors')) return 'successfactors';
  if (text.includes('workable.com') || text.includes('workable')) return 'workable';
  if (text.includes('jobvite.com') || text.includes('jobvite')) return 'jobvite';
  if (text.includes('bamboohr.com') || text.includes('bamboohr')) return 'bamboohr';
  if (text.includes('recruitee.com') || text.includes('recruitee')) return 'recruitee';
  if (text.includes('breezy.hr') || text.includes('breezy')) return 'breezy';
  return null;
}

type ExtractionSource = 'subject' | 'body' | 'snippet' | 'from' | 'fallback' | 'html' | null;
type ExtractionResult = { value: string | null; source: ExtractionSource };

const STATUS_PRIORITY: Record<string, number> = {
  Rejected: 5,
  Offer: 4,
  Interview: 3,
  Assessment: 2,
  Applied: 1,
  Other: 0,
};

function normalizeStatus(input?: string | null): string | null {
  if (!input) return null;
  const normalized = input.toLowerCase();
  if (normalized.includes('offer')) return 'Offer';
  if (normalized.includes('interview')) return 'Interview';
  if (normalized.includes('assessment') || normalized.includes('challenge') || normalized.includes('test')) {
    return 'Assessment';
  }
  if (normalized.includes('reject') || normalized.includes('not moving forward') || normalized.includes('unfortunately')) {
    return 'Rejected';
  }
  if (normalized.includes('review')) return 'Applied';
  if (normalized.includes('applied') || normalized.includes('application')) return 'Applied';
  if (normalized.includes('other')) return 'Other';
  return null;
}

function pickHigherStatus(...statuses: Array<string | null | undefined>) {
  let best: string | null = null;
  let bestScore = -1;
  for (const status of statuses) {
    const normalized = normalizeStatus(status);
    if (!normalized) continue;
    const score = STATUS_PRIORITY[normalized] ?? 0;
    if (score > bestScore) {
      best = normalized;
      bestScore = score;
    }
  }
  return best;
}

function determineStatusHeuristic(subject?: string | null, body?: string | null, snippet?: string | null): string | null {
  const text = `${normalizeText(subject)} ${normalizeText(body)} ${normalizeText(snippet)}`.toLowerCase();
  if (!text) return null;

  // Offer patterns (high confidence)
  const offerPatterns = [
    /\b(offer|pleased to offer|congratulations|we('d| would) like to (extend|offer)|job offer|offer letter)\b/i,
    /\b(we are excited to offer|delighted to offer|happy to offer)\b/i,
    /\b(extending (you )?an offer|formal offer)\b/i,
  ];
  if (offerPatterns.some(p => p.test(text))) return 'Offer';

  // Rejection patterns (high confidence) - check before interview to catch "moving forward with other candidates"
  const rejectionPatterns = [
    /\b(not moving forward|unfortunately|regret to inform|declined|rejected)\b/i,
    /\b(decided (to )?(not )?proceed|not (be )?proceeding|won't be moving forward)\b/i,
    /\b(pursuing other candidates|other candidates|chosen (to )?not)\b/i,
    /\b(position (has been |was )?filled|filled (the )?position)\b/i,
    /\b(will not be (advancing|continuing|extending)|not selected)\b/i,
    /\b(at this time|this time around|different direction)\b/i,
    /\b(thank you for your interest.*but|but.*not a fit)\b/i,
    /\b(we (have|'ve) decided|decided to move forward with)\b/i,
  ];
  if (rejectionPatterns.some(p => p.test(text))) return 'Rejected';

  // Interview patterns
  const interviewPatterns = [
    /\b(interview|phone screen|schedule|availability|calendly|meeting)\b/i,
    /\b(video (interview|call)|zoom (call|meeting)|teams (call|meeting))\b/i,
    /\b(technical (interview|screen)|hiring manager (call|chat|interview))\b/i,
    /\b(onsite|on-site|final round|panel interview)\b/i,
    /\b(next (step|stage)|move( you)? forward|advancing (you )?to)\b/i,
    /\b(schedule (a |some )?time|book (a )?time|pick (a )?time)\b/i,
    /\b(goodtime\.io|calendly\.com|doodle|youcanbook)\b/i,
    /\b(recruiter (call|chat)|introductory (call|chat))\b/i,
  ];
  if (interviewPatterns.some(p => p.test(text))) return 'Interview';

  // Assessment patterns
  const assessmentPatterns = [
    /\b(assessment|coding challenge|take[- ]home|technical test)\b/i,
    /\b(codesignal|hackerrank|hirevue|codility|hackerearth|leetcode)\b/i,
    /\b(online (test|assessment|challenge)|skills (test|assessment))\b/i,
    /\b(complete (the|this|an?) (assessment|challenge|test))\b/i,
    /\b(coding (test|exercise|assignment)|technical (exercise|assessment))\b/i,
    /\b(pymetrics|criteria|testgorilla|vervoe)\b/i,
  ];
  if (assessmentPatterns.some(p => p.test(text))) return 'Assessment';

  // Applied/Received patterns
  const appliedPatterns = [
    /\b(application received|thank you for applying|we received your application)\b/i,
    /\b(applied|in review|under (review|consideration))\b/i,
    /\b(received your (application|resume|cv)|application (has been |was )?submitted)\b/i,
    /\b(successfully (submitted|applied)|confirm(ing|ed)? (your )?application)\b/i,
    /\b(reviewing (your )?(application|profile|resume|cv))\b/i,
  ];
  if (appliedPatterns.some(p => p.test(text))) return 'Applied';

  return null;
}

function extractUrlsFromText(text?: string | null): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s<>()]+/gi) || [];
  const dedup = new Set<string>();
  matches.forEach((raw) => {
    const trimmed = raw.replace(/[),.]+$/g, '').trim();
    if (trimmed) dedup.add(trimmed);
  });
  return Array.from(dedup).slice(0, 20);
}

function stripQuotedReplies(text?: string | null): string | null {
  if (!text) return null;
  const lines = text.split('\n');
  const cleaned: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^>+/.test(trimmed)) continue;
    if (/^on .+ wrote:$/i.test(trimmed)) break;
    if (/^from:\s/i.test(trimmed) && cleaned.length > 3) break;
    if (/^sent:\s/i.test(trimmed) && cleaned.length > 3) break;
    if (/^subject:\s/i.test(trimmed) && cleaned.length > 3) break;
    cleaned.push(line);
  }
  const joined = cleaned.join('\n').trim();
  return joined || text;
}

function buildTopLines(text?: string | null, maxLines = 25): string {
  if (!text) return '';
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.slice(0, maxLines).join('\n');
}

function normalizeCompanyForKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    // Remove common company suffixes
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|limited|group|holdings|plc|gmbh|ag|sa|srl|bv|nv)\b/g, ' ')
    // Remove common job-related words that might creep in
    .replace(/\b(careers|jobs|recruiting|hiring|talent|team)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRoleForKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    // Normalize common abbreviations
    .replace(/\b(fullstack|full-stack)\b/g, 'full stack')
    .replace(/\b(new grad|newgrad)\b/g, 'new graduate')
    .replace(/\bswe\b/g, 'software engineer')
    .replace(/\bsde\b/g, 'software development engineer')
    .replace(/\bpm\b/g, 'product manager')
    .replace(/\bux\b/g, 'user experience')
    .replace(/\bui\b/g, 'user interface')
    .replace(/\bml\b/g, 'machine learning')
    .replace(/\bfe\b/g, 'frontend')
    .replace(/\bbe\b/g, 'backend')
    .replace(/\bqa\b/g, 'quality assurance')
    .replace(/\bdevops\b/g, 'devops')
    .replace(/\bsr\b/g, 'senior')
    .replace(/\bjr\b/g, 'junior')
    // Remove level indicators for matching (keep different roles separate)
    .replace(/\b(i{1,3}|iv|v|1|2|3|4|5)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Enhanced canonical key with fuzzy matching support
function buildCanonicalKey(input: {
  company?: string | null;
  role?: string | null;
  companyConfidence?: number | null;
  roleConfidence?: number | null;
  requisitionId?: string | null;
  jobId?: string | null;
  portalDomain?: string | null;
}): string | null {
  if (!input.company || !input.role) return null;
  // Lower threshold for canonical key to catch more duplicates
  if ((input.companyConfidence ?? 0) < 0.6 || (input.roleConfidence ?? 0) < 0.6) return null;
  const normalizedCompany = normalizeCompanyForKey(input.company);
  const normalizedRole = normalizeRoleForKey(input.role);
  if (!normalizedCompany || !normalizedRole) return null;
  // Use more specific identifiers when available
  const suffix = input.requisitionId || input.jobId || input.portalDomain || 'na';
  return `${normalizedCompany}::${normalizedRole}::${normalizeCompanyForKey(suffix) || 'na'}`;
}

// Compute similarity between two strings (Jaccard index on tokens)
function computeTokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  tokensA.forEach(token => {
    if (tokensB.has(token)) intersection++;
  });
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// Check if two companies are likely the same
function areSameCompany(companyA: string, companyB: string): boolean {
  const normalizedA = normalizeCompanyForKey(companyA);
  const normalizedB = normalizeCompanyForKey(companyB);
  if (normalizedA === normalizedB) return true;
  // Check if one contains the other
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return true;
  // Fuzzy match with high threshold
  return computeTokenSimilarity(normalizedA, normalizedB) >= 0.8;
}

// Check if two roles are likely the same
function areSameRole(roleA: string, roleB: string): boolean {
  const normalizedA = normalizeRoleForKey(roleA);
  const normalizedB = normalizeRoleForKey(roleB);
  if (normalizedA === normalizedB) return true;
  // Fuzzy match with moderate threshold
  return computeTokenSimilarity(normalizedA, normalizedB) >= 0.7;
}

function extractPortalDomain(urls: string[]): string | null {
  if (!urls || urls.length === 0) return null;
  const preferredDomains = [
    'myworkdayjobs.com',
    'myworkday.com',
    'workday.com',
    'greenhouse.io',
    'job-boards.greenhouse.io',
    'boards.greenhouse.io',
    'grnh.se',
    'ashbyhq.com',
    'lever.co',
    'smartrecruiters.com',
    'icims.com',
    'taleo.net',
    'successfactors.com',
    'workable.com',
    'jobvite.com',
    'bamboohr.com',
    'recruitee.com',
    'breezy.hr',
    // Additional platforms
    'dover.io',
    'gem.com',
    'wellfound.com',
    'angel.co',
    'hired.com',
    'otta.com',
    'underdog.io',
    'workatastartup.com',
    'jazzhr.com',
    'jazz.co',
    'clearcompany.com',
    'hirebridge.com',
    'paylocity.com',
    'paycor.com',
    'ceridian.com',
    'dayforce.com',
    'eightfold.ai',
    'phenom.com',
    'beamery.com',
    'fountain.com',
    'rippling.com',
  ];
  for (const raw of urls) {
    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.toLowerCase();
      const lowerPath = parsed.pathname.toLowerCase();

      // Workday - extract company subdomain
      if (host.endsWith('myworkdayjobs.com') || host.endsWith('myworkday.com')) {
        // e.g., company.wd5.myworkdayjobs.com -> extract "company"
        const parts = host.split('.');
        if (parts.length >= 3) {
          return `${parts[0]}.workday`;
        }
        return host;
      }

      // Greenhouse - extract company from path
      if (host.includes('greenhouse.io')) {
        const segments = lowerPath.split('/').filter(Boolean);
        if (segments[0]) return `greenhouse.io/${segments[0]}`;
        return host;
      }

      // Ashby - extract company from path
      if (host.includes('ashbyhq.com')) {
        const segments = lowerPath.split('/').filter(Boolean);
        if (segments[0]) return `ashbyhq.com/${segments[0]}`;
        return host;
      }

      // Lever - extract company from subdomain or path
      if (host.includes('lever.co')) {
        const segments = lowerPath.split('/').filter(Boolean);
        if (segments[0]) return `lever.co/${segments[0]}`;
        const parts = host.split('.');
        if (parts[0] !== 'jobs' && parts[0] !== 'hire') {
          return `lever.co/${parts[0]}`;
        }
        return host;
      }

      // SmartRecruiters - extract company from subdomain
      if (host.includes('smartrecruiters.com')) {
        const parts = host.split('.');
        if (parts[0] !== 'jobs' && parts[0] !== 'www') {
          return `smartrecruiters.com/${parts[0]}`;
        }
        const segments = lowerPath.split('/').filter(Boolean);
        if (segments[0]) return `smartrecruiters.com/${segments[0]}`;
        return host;
      }

      if (preferredDomains.some((domain) => host.includes(domain))) {
        return host;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Extract job/requisition ID from URLs
function extractJobIdFromUrls(urls: string[]): string | null {
  if (!urls || urls.length === 0) return null;

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname;
      const params = parsed.searchParams;

      // Greenhouse job ID
      if (host.includes('greenhouse.io')) {
        const match = path.match(/\/jobs?\/(\d+)/i);
        if (match) return `gh-${match[1]}`;
      }

      // Lever job ID
      if (host.includes('lever.co')) {
        const segments = path.split('/').filter(Boolean);
        const jobSegment = segments.find(s => /^[a-f0-9-]{36}$/i.test(s));
        if (jobSegment) return `lever-${jobSegment.substring(0, 8)}`;
      }

      // Workday job ID
      if (host.includes('workday') || host.includes('myworkdayjobs')) {
        const jobId = params.get('jobRequisitionId') || params.get('jobId');
        if (jobId) return `wd-${jobId}`;
      }

      // Ashby job ID
      if (host.includes('ashbyhq.com')) {
        const segments = path.split('/').filter(Boolean);
        const jobSegment = segments.find(s => /^[a-f0-9-]{36}$/i.test(s));
        if (jobSegment) return `ashby-${jobSegment.substring(0, 8)}`;
      }

      // iCIMS job ID
      if (host.includes('icims.com')) {
        const match = path.match(/\/jobs\/(\d+)/i);
        if (match) return `icims-${match[1]}`;
      }

    } catch {
      continue;
    }
  }
  return null;
}

function isJobRelatedFromPrompt(result: any): boolean {
  if (!result) return false;
  if (typeof result.is_job_related === 'boolean') return result.is_job_related;
  if (typeof result.job_related_confidence === 'number') return result.job_related_confidence >= 0.5;
  return false;
}

function mapEventTypeFromPrompt(value?: string | null): string | null {
  if (!value) return null;
  switch (value) {
    case 'APPLICATION_CONFIRMATION':
      return 'application_received';
    case 'INTERVIEW_REQUEST':
      return 'interview_invite';
    case 'ASSESSMENT_INVITE':
      return 'assessment';
    case 'REJECTION':
      return 'rejection';
    case 'OFFER':
      return 'offer';
    case 'RECRUITER_OUTREACH':
    case 'UPDATE':
    case 'OTHER':
    default:
      return 'other';
  }
}

function mapStatusFromPrompt(value?: string | null): string | null {
  if (!value) return null;
  switch (value) {
    case 'APPLIED':
      return 'Applied';
    case 'IN_REVIEW':
      return 'Applied';
    case 'INTERVIEWING':
      return 'Interview';
    case 'ASSESSMENT':
      return 'Assessment';
    case 'REJECTED':
      return 'Rejected';
    case 'OFFER':
      return 'Offer';
    default:
      return null;
  }
}

function statusFromEventType(eventType?: string | null): string | null {
  if (!eventType) return null;
  if (eventType === 'rejection') return 'Rejected';
  if (eventType === 'offer') return 'Offer';
  if (eventType === 'interview_invite') return 'Interview';
  if (eventType === 'assessment') return 'Assessment';
  if (eventType === 'application_received') return 'Applied';
  return null;
}

function isRoleCloseEnough(roleA: string, roleB: string): boolean {
  const tokensA = new Set(normalizeRoleForKey(roleA).split(' ').filter(Boolean));
  const tokensB = new Set(normalizeRoleForKey(roleB).split(' ').filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let intersection = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersection += 1;
  });
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? intersection / union >= 0.6 : false;
}

function safeParseJson(text?: string | null): any | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const CompanyUtils = {
  isLikelyNotCompany(text: string) {
    const normalized = text.toLowerCase().trim();
    if (!normalized) return true;
    if (looksLikeUrl(normalized)) return true;
    if (isAtsName(normalized)) return true;
    const jobWords = [
      'position',
      'role',
      'intern',
      'internship',
      'job',
      'application',
      'hiring',
      'recruiting',
      'recruiter',
      'team',
      'talent',
      'careers',
      'jobs',
      'apply',
      'candidate',
      'portal',
      'indeed',
      'glassdoor',
      'linkedin',
      'notifications',
      'no-reply',
      'noreply',
    ];
    const textLower = normalized;
    return jobWords.some((word) => {
      const pattern = new RegExp(`(^|\\s|,|-|/|\\(|\\)|&)${word}($|\\s|,|-|/|\\(|\\)|&|s|ing|er)`, 'i');
      return pattern.test(textLower);
    });
  },

  normalizeCompanyName(name: string): string | null {
    if (!name) return null;
    let cleaned = name
      .replace(/\s{2,}/g, ' ')
      .replace(/[|•·•–—]+/g, ' ')
      .replace(/["'’]/g, '')
      .replace(/^(mail|us|eu|talent|jobs|careers)\./i, '')
      .trim();
    cleaned = cleaned
      .replace(/\b(inc|inc\.|llc|ltd|ltd\.|corp|corp\.|corporation|company)\b\.?$/i, '')
      .replace(/\b(careers|jobs|recruiting|talent acquisition|talent|hiring)\b\.?$/i, '')
      .trim();
    return cleaned || null;
  },

  extractCompanyCandidatesFromSentence(sentence: string, score: number, addCandidate: (value: string, score: number, source: ExtractionSource) => void) {
    const capitalized = sentence.match(/\b([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4})\b/g) || [];
    capitalized.forEach((candidate) => addCandidate(candidate, score, 'body'));
  },

  extractSenderName(from?: string | null): string | null {
    if (!from) return null;
    const markdownBoldPattern = /\*\*([^*]+)\*\*/;
    const quotedNamePattern = /"([^"]+)"/;
    const plainNamePattern = /^([^<]+?)\s*</;
    let match = from.match(markdownBoldPattern);
    if (match && match[1]) return match[1].trim();
    match = from.match(quotedNamePattern);
    if (match && match[1]) return match[1].trim();
    match = from.match(plainNamePattern);
    if (match && match[1]) return match[1].trim();
    return null;
  },

  capitalizeCompanyName(name: string): string {
    if (!name) return '';
    if (name.includes('-')) {
      return name
        .split('-')
        .map((part) => this.capitalizeCompanyName(part))
        .join('-');
    }
    const commonSuffixes: Record<string, string> = {
      co: 'Co',
      inc: 'Inc',
      corp: 'Corp',
      llc: 'LLC',
      ltd: 'Ltd',
      tech: 'Tech',
      io: 'IO',
      ai: 'AI',
    };
    if (commonSuffixes[name.toLowerCase()]) {
      return commonSuffixes[name.toLowerCase()];
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  },

  extractCompany(subject?: string | null, body?: string | null, from?: string | null, snippet?: string | null): ExtractionResult {
    const subjectText = normalizeText(subject);
    const bodyText = normalizeText(body);
    const snippetText = normalizeText(snippet);
    const candidates: Array<{ value: string; score: number; source: ExtractionSource }> = [];

    const addCandidate = (value: string, score: number, source: ExtractionSource) => {
      const normalized = this.normalizeCompanyName(value);
      if (!normalized) return;
      if (this.isLikelyNotCompany(normalized)) return;
      if (isAtsName(normalized)) return;
      let adjusted = score;
      if (bodyText.toLowerCase().includes(normalized.toLowerCase())) adjusted += 1;
      candidates.push({ value: normalized, score: adjusted, source });
    };

    const bodyPatterns = [
      /role at ([A-Za-z0-9][A-Za-z0-9\s&,-]{1,50})/i,
      /job at ([A-Za-z0-9][A-Za-z0-9\s&,-]{1,50})/i,
      /position at ([A-Za-z0-9][A-Za-z0-9\s&,-]{1,50})/i,
      /team at ([A-Za-z0-9][A-Za-z0-9\s&,-]{1,50})/i,
      /career (?:with|at) ([A-Za-z0-9\s&-]+){1,50}/i,
      /applying to join ([A-Za-z0-9\s&-]+){1,50}/i,
      /in joining ([A-Za-z0-9\s&,-]+){1,50}/i,
      /for your interest in(?:\s+employment)?(?:\s+with|at)? ([A-Za-z0-9\s&,-]+){1,50}/i,
      /thank you for your interest in ([A-Za-z0-9][A-Za-z0-9\s&.,-]{1,60})/i,
      /employment with ([A-Za-z0-9\s&,-]+){1,50}/i,
      /thank you for applying to ([A-Za-z0-9\s&,-]+){1,50}/i,
      /your application to ([A-Za-z0-9\s&,-]+){1,50}/i,
      /your application with ([A-Za-z0-9\s&,-]+){1,50}/i,
      /application at ([A-Za-z0-9\s&,-]+){1,50}/i,
      /application with ([A-Za-z0-9\s&,-]+){1,50}/i,
      /application received ([A-Za-z0-9\s&,-]+){1,50}/i,
      /we (?:have )?received your application to ([A-Za-z0-9][A-Za-z0-9\s&.,-]{1,60})/i,
      /([A-Za-z0-9][A-Za-z0-9\s&.,-]{1,60}) has received your application/i,
      /for the .*? role at ([A-Za-z0-9][A-Za-z0-9\s&.,-]{1,60})/i,
      /new message from ([A-Za-z0-9\s&,-]+){1,50}/i
    ];
    if (bodyText) {
      for (const pattern of bodyPatterns) {
        const match = bodyText.match(pattern);
        if (match && match[1]) {
          const candidate = match[1].trim();
          if (candidate.length > 1 && candidate.length <= 60) {
            addCandidate(candidate, 6, 'body');
          }
        }
      }
    } else if (snippetText) {
      for (const pattern of bodyPatterns) {
        const match = snippetText.match(pattern);
        if (match && match[1]) {
          const candidate = match[1].trim();
          if (candidate.length > 1 && candidate.length <= 60) {
            addCandidate(candidate, 3, 'snippet');
          }
        }
      }
    }

    const subjectPatterns = [
      /for your interest in(?:.*?)([A-Za-z0-9&.,-]+(?:\s+[A-Za-z0-9&.,-]+)*)/i,
      /applying to join ([A-Za-z0-9\s&-]+){1,50}/i,
      /(?:application|applying|interview|offer|assessment).*?\bat\s+([A-Za-z0-9][A-Za-z0-9\s&.,-]{1,50})/i,
      /(?:application|applying|interview|offer|assessment).*?\bwith\s+([A-Za-z0-9][A-Za-z0-9\s&.,-]{1,50})/i,
      /from\s+([A-Za-z0-9][A-Za-z0-9\s&.,-]{1,50})/i,
    ];
    for (const pattern of subjectPatterns) {
      const match = subjectText.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (candidate.length > 1 && candidate.length <= 60) {
          addCandidate(candidate, 4, 'subject');
        }
      }
    }

    const senderName = this.extractSenderName(from);
    if (senderName && senderName.length > 1 && senderName.length <= 60) {
      addCandidate(senderName, 1, 'from');
    }

    const copyrightMatch = bodyText.match(/©\s?\d{4}\s+([A-Za-z0-9\s&.,-]{2,60})/i);
    if (copyrightMatch && copyrightMatch[1]) {
      addCandidate(copyrightMatch[1], 4, 'body');
    }

    if (bodyText) {
      const sentences = bodyText.split(/[\n.!?]+/).map((s) => s.trim()).filter(Boolean);
      const strongCues = [
        /thank you for applying to/i,
        /your application to/i,
        /we (?:have )?received your application to/i,
        /has received your application/i,
        /thank you for your interest in/i,
      ];
      const mediumCues = [/careers/i, /talent acquisition/i, /recruiting team/i];
      sentences.forEach((sentence) => {
        if (strongCues.some((cue) => cue.test(sentence))) {
          this.extractCompanyCandidatesFromSentence(sentence, 7, addCandidate);
        } else if (mediumCues.some((cue) => cue.test(sentence))) {
          this.extractCompanyCandidatesFromSentence(sentence, 5, addCandidate);
        }
      });
    }

    if (candidates.length === 0) {
      return { value: null, source: null };
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best.score < COMPANY_MIN_SCORE) {
      return { value: null, source: null };
    }
    return { value: capitalizeFirstLetter(best.value), source: best.source };
  },
};

const JobUtils = {
  isLikelyJobTitle(text: string) {
    const jobWords = [
      'associate',
      'assistant',
      'junior',
      'senior',
      'lead',
      'head',
      'chief',
      'director',
      'manager',
      'supervisor',
      'coordinator',
      'executive',
      'intern',
      'entry-level',
      'specialist',
      'analyst',
      'engineer',
      'developer',
      'administrator',
      'technician',
      'officer',
      'representative',
      'consultant',
      'advisor',
      'data',
      'software',
      'marketing',
      'sales',
      'operations',
      'human resources',
      'hr',
      'it',
      'project',
      'business',
      'financial',
      'technical',
      'customer',
      'product',
      'scientist',
      'designer',
      'strategist',
    ];
    const textLower = text.toLowerCase();
    return jobWords.some((word) => {
      const pattern = new RegExp(`(^|\\s|,|-|/|\\(|\\)|&)${word}($|\\s|,|-|/|\\(|\\)|&|s|ing|er)`, 'i');
      return pattern.test(textLower);
    });
  },

  isLikelyNotRole(text: string) {
    const normalized = text.toLowerCase().trim();
    if (!normalized) return true;
    if (looksLikeUrl(normalized)) return true;
    if (isAtsName(normalized)) return true;
    if (normalized.length > 80) return true;
    if ((normalized.match(/,/g) || []).length >= 3) return true;
    const badTokens = [
      'candidate portal',
      'application portal',
      'do not reply',
      'no-reply',
      'noreply',
      'workday',
      'ashby',
      'icims',
      'greenhouse',
      'lever',
      'smartrecruiters',
      'taleo',
      'successfactors',
    ];
    if (badTokens.some((token) => normalized.includes(token))) return true;
    return false;
  },

  scoreRoleCandidate(candidate: string, baseScore: number) {
    let score = baseScore;
    if (this.isLikelyJobTitle(candidate)) score += 2;
    const roleKeywords = [
      'engineer',
      'developer',
      'analyst',
      'manager',
      'scientist',
      'designer',
      'intern',
      'associate',
      'specialist',
      'coordinator',
      'product',
      'data',
      'security',
    ];
    const lower = candidate.toLowerCase();
    if (roleKeywords.some((word) => lower.includes(word))) score += 1;
    return score;
  },

  cleanJobTitle(title?: string | null): string | null {
    if (!title || typeof title !== 'string') return null;
    let cleaned = title.replace(/^(re:|fwd:|fw:)/i, '').trim();
    cleaned = cleaned.replace(/^(our|the)\s+/i, '').trim();
    cleaned = cleaned
      .replace(/(?:position|role|opportunity|opening)(?:(,|.|\s+)(?:at|with|and)?\s+[A-Za-z0-9\s&(),.'-]+)?$/i, '')
      .trim();
    cleaned = cleaned.replace(/\s+at\s+[A-Za-z0-9\s&(),.'-]+$/i, '').trim();
    cleaned = cleaned.replace(/\s+and\s+(?:your|are|we|we're)\s+[A-Za-z0-9\s&(),.'-]+$/i, '').trim();
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    cleaned = cleaned.replace(/[.,]$/i, '').trim();
    if (cleaned.length > 100) {
      const parts = cleaned.split(/[,.;:]/);
      if (parts[0] && parts[0].length > 3) {
        cleaned = parts[0].trim();
      } else {
        cleaned = cleaned.substring(0, 47) + '...';
      }
    }
    return cleaned || null;
  },

  extractJobTitle(subject?: string | null, body?: string | null, from?: string | null, snippet?: string | null): ExtractionResult {
    const subjectText = normalizeText(subject);
    const bodyText = normalizeText(body || snippet);
    const candidates: Array<{ value: string; score: number; source: ExtractionSource }> = [];

    const addCandidate = (value: string, score: number, source: ExtractionSource) => {
      const cleaned = this.cleanJobTitle(value);
      if (!cleaned) return;
      if (this.isLikelyNotRole(cleaned)) return;
      candidates.push({ value: cleaned, score: this.scoreRoleCandidate(cleaned, score), source });
    };

    const subjectPatterns = [
      /application received for ([A-Za-z0-9\s&(),.'-:]+)/i,
      /applied for (?:our|the) ([A-Za-z0-9\s&(),.'-]+) position/i,
      /your application for (?:our|the)? ([A-Za-z0-9\s&(),.'-]+)(\s+at|\s+with)?/i,
      /interview(?: invitation| invite)? for ([A-Za-z0-9\s&(),.'-]+)/i,
      /(?:post|job|position|role) of ([A-Za-z0-9\s&(),.'-]+)/i,
      /role of ([A-Za-z0-9\s&(),.'-]+)/i,
      /to the ([A-Za-z0-9\s&(),.'-]+) position/i,
      /: ([A-Za-z0-9\s&(),.'-]+) at/i,
    ];
    for (const pattern of subjectPatterns) {
      const match = subjectText.match(pattern);
      if (match && match[1]) {
        addCandidate(match[1].trim(), 5, 'subject');
      }
    }

    const bodyPatterns = [
      /apply(?:ing)? (?:to|for) (?:the|our)? ([A-Za-z0-9\s&(),'-.]+)(?:\s+position|\s+role|\s+at|\s+with|\s+job)/i,
      /your application for (?:the)? (?:position|role|job|post)? (?:of)? ([A-Za-z0-9\s&(),'-]+)(?:,|.|\s+position|\s+role|\s+job)? (?:at|with)?/i,
      /received your application for (?:the )?([A-Za-z0-9\s&(),'-]+)(?:,|\s+position|\s+role|\s+job)?/i,
      /interview(?: invitation| invite)? for ([A-Za-z0-9\s&(),'-]+)/i,
      /for the (?:position|role|job|post) of ([A-Za-z0-9\s&(),'-]+)(?:,|\s+at|\s+with)/i,
      /position title:?\s*([A-Za-z0-9\s&(),'-]+)/i,
      /job title:?\s*([A-Za-z0-9\s&(),'-]+)/i,
      /position:?\s*([A-Za-z0-9\s&(),'-]+)/i,
      /role:?\s*([A-Za-z0-9\s&(),'-]+)/i,
      /job:?\s*([A-Za-z0-9\s&(),'-]+)/i,
      /requisition title:?\s*([A-Za-z0-9\s&(),'-]+)/i,
      /posting title:?\s*([A-Za-z0-9\s&(),'-]+)/i,
      /opportunity:?\s*([A-Za-z0-9\s&(),'-]+)/i,
    ];
    for (const pattern of bodyPatterns) {
      const match = bodyText.match(pattern);
      if (match && match[1]) {
        addCandidate(match[1].trim(), 5, 'body');
      }
    }

    if (from) {
      const roleMatch = from.match(/(?:re:|fwd:)?\s*(?:position|role)\s*[:\-]\s*([^<]+)/i);
      if (roleMatch && roleMatch[1]) {
        addCandidate(roleMatch[1].trim(), 2, 'from');
      }
    }

    if (candidates.length === 0) {
      return { value: null, source: null };
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    return { value: best.value, source: best.source };
  },
};

// ============================================================================
// BATCH FETCHING UTILITIES - Parallel message fetching for speed
// ============================================================================

async function fetchMessagesBatch(
  accessToken: string,
  ids: string[],
  format: 'metadata' | 'full' = 'metadata'
): Promise<GmailMessage[]> {
  const results: GmailMessage[] = [];

  for (const id of ids) {
    try {
      if (format === 'full') {
        results.push(await fetchMessageFull(accessToken, id));
      } else {
        results.push(await fetchMessageMetadata(accessToken, id));
      }
    } catch (err) {
      console.error(`Failed to fetch message ${id}:`, err);
    }
  }

  return results;
}

async function fetchMessagesParallel(
  accessToken: string,
  ids: { id: string }[],
  options: {
    batchSize?: number;
    maxConcurrent?: number;
    format?: 'metadata' | 'full';
  } = {}
): Promise<GmailMessage[]> {
  const {
    batchSize = BATCH_SIZE,
    maxConcurrent = MAX_CONCURRENT_BATCHES,
    format = 'metadata'
  } = options;

  const allMessages: GmailMessage[] = [];
  const batches: string[][] = [];

  // Split into batches
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize).map(item => item.id));
  }

  // Process batches with limited concurrency
  for (let i = 0; i < batches.length; i += maxConcurrent) {
    const currentBatches = batches.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      currentBatches.map(batch => fetchMessagesBatch(accessToken, batch, format))
    );
    allMessages.push(...batchResults.flat());
  }

  return allMessages;
}

// ============================================================================
// IMPROVED GMAIL QUERY BUILDER - Comprehensive job email detection
// ============================================================================

function buildOptimizedGmailQuery(options: {
  hardSync?: boolean;
  lightSync?: boolean;
  lookbackMonths?: number | string | null;
  lastSyncedAt?: string | null;
  isInitialImport?: boolean;
}): string {
  const { hardSync, lightSync, lookbackMonths, lastSyncedAt, isInitialImport } = options;

  // Base query - exclude noise
  const baseQuery = hardSync
    ? 'in:anywhere '
    : 'in:inbox -category:promotions -category:social -category:forums -is:chat ';

  // Comprehensive ATS and recruiting platform domains
  const atsDomains = [
    // Major ATS platforms
    'lever.co', 'greenhouse.io', 'grnh.se', 'ashbyhq.com',
    'workday.com', 'myworkday.com', 'myworkdayjobs.com',
    'icims.com', 'taleo.net', 'successfactors.com',
    'smartrecruiters.com', 'workable.com', 'jobvite.com',
    'bamboohr.com', 'recruitee.com', 'breezy.hr',
    // Job boards & marketplaces
    'wellfound.com', 'angel.co', 'hired.com', 'otta.com',
    'underdog.io', 'workatastartup.com', 'triplebyte.com',
    // Additional ATS
    'dover.io', 'gem.com', 'eightfold.ai', 'phenom.com',
    'beamery.com', 'fountain.com', 'jazzhr.com', 'jazz.co',
    'clearcompany.com', 'hirebridge.com', 'paylocity.com',
    'paycor.com', 'ultipro.com', 'ukg.com', 'adp.com',
    'ceridian.com', 'dayforce.com', 'rippling.com',
    // Assessment platforms
    'codesignal.com', 'hackerrank.com', 'hirevue.com',
    'codility.com', 'hackerearth.com', 'testgorilla.com',
    'criteria.com', 'pymetrics.com', 'harver.com',
    // Scheduling platforms
    'calendly.com', 'goodtime.io', 'paradox.ai',
  ];

  // Recruiter-related keywords in sender name/email
  const recruiterKeywords = [
    'recruiter', '"talent acquisition"', '"hiring team"',
    '"hiring manager"', 'sourcer', '"people team"',
    '"people operations"', '"talent partner"', '"hr team"',
    '"human resources"', '"ta team"', '"recruitment"',
  ];

  // Job-related subject/body keywords - comprehensive list
  const subjectKeywords = [
    // Application status
    'application', '"application received"', '"application status"',
    '"thank you for applying"', '"your application"', '"we received"',
    '"application confirmation"', '"successfully submitted"',
    // Interview related
    'interview', '"phone screen"', '"video interview"',
    '"interview request"', '"interview invite"', '"interview scheduled"',
    '"technical interview"', '"onsite"', '"on-site"', '"final round"',
    '"hiring manager"', 'schedule', 'availability', 'calendly',
    // Assessment related
    'assessment', '"online assessment"', '"coding challenge"',
    '"take-home"', '"technical assessment"', '"skills assessment"',
    'hackerrank', 'codesignal', 'codility', 'hirevue',
    // Offer related
    '"job offer"', 'offer', '"offer letter"', '"congratulations"',
    // Rejection related
    '"unfortunately"', '"not moving forward"', '"other candidates"',
    '"position has been filled"', '"decided to move forward"',
    // General job related
    '"career opportunity"', '"next steps"', '"background check"',
    '"reference check"', '"start date"', '"onboarding"',
    'position', 'role', 'opportunity', '"new role"',
  ];

  // Senders to exclude (job board notifications, not actual applications)
  const excludedSenders = [
    'jobs-listings@linkedin.com',
    'jobs-noreply@linkedin.com',
    'jobalerts-noreply@linkedin.com',
    'alerts@glassdoor.com',
    'jobs@indeed.com',
    'noreply@indeed.com',
    'notifications@monster.com',
    'noreply@ziprecruiter.com',
  ];

  // Build the query
  let query = baseQuery;

  // Domain OR recruiter keyword OR subject keyword matching
  query += `(from:(${atsDomains.join(' OR ')}) `;
  query += `OR from:(${recruiterKeywords.join(' OR ')}) `;
  query += `OR subject:(${subjectKeywords.slice(0, 15).join(' OR ')}) `;
  query += `OR (${subjectKeywords.slice(0, 10).join(' OR ')})) `;

  // Exclude noise
  query += '-unsubscribe ';
  query += '-"job alert" ';
  query += '-"jobs you might be interested" ';
  query += '-"based on your profile" ';
  query += '-"password reset" ';
  query += excludedSenders.map(sender => `-from:${sender}`).join(' ');

  // Apply date filter based on sync type
  if (hardSync) {
    // Hard sync: use lookbackMonths if provided
    if (lookbackMonths && lookbackMonths !== 'all' && !isNaN(Number(lookbackMonths)) && Number(lookbackMonths) > 0) {
      const months = Math.min(12, Math.max(1, Number(lookbackMonths)));
      const afterDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
        .replace(/-/g, '/');
      query += ` after:${afterDate}`;
    }
  } else if (isInitialImport) {
    // Initial import: default to 3 months (configurable via lookbackMonths)
    const months = lookbackMonths && !isNaN(Number(lookbackMonths)) ? Number(lookbackMonths) : 3;
    const afterDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '/');
    query += ` after:${afterDate}`;
  } else if (lastSyncedAt) {
    // Incremental sync: only new messages since last sync
    const afterDate = new Date(lastSyncedAt)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '/');
    query += ` after:${afterDate}`;
  }

  return query;
}

async function fetchMessageMetadata(accessToken: string, id: string): Promise<GmailMessage> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set('format', 'metadata');
  url.searchParams.append('metadataHeaders', 'Subject');
  url.searchParams.append('metadataHeaders', 'From');
  url.searchParams.append('metadataHeaders', 'Message-ID');

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || 'Failed to fetch Gmail message');
  }

  const headers = (data.payload?.headers || []) as { name: string; value: string }[];
  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value;
  const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value;
  const internetMessageId = headers.find((h) => h.name?.toLowerCase() === 'message-id')?.value || null;
  const internalTimestamp = data.internalDate ? Number(data.internalDate) : undefined;
  return {
    id,
    threadId: data.threadId,
    subject,
    from,
    internetMessageId,
    internalDate: internalTimestamp ? new Date(internalTimestamp).toISOString() : data.internalDate,
    internalTimestamp,
    snippet: data.snippet,
    bodyText: null,
  };
}

async function fetchMessageFull(accessToken: string, id: string): Promise<GmailMessage> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set('format', 'full');
  url.searchParams.append('metadataHeaders', 'Subject');
  url.searchParams.append('metadataHeaders', 'From');
  url.searchParams.append('metadataHeaders', 'Message-ID');

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || 'Failed to fetch Gmail message');
  }

  const headers = (data.payload?.headers || []) as { name: string; value: string }[];
  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value;
  const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value;
  const internetMessageId = headers.find((h) => h.name?.toLowerCase() === 'message-id')?.value || null;
  const internalTimestamp = data.internalDate ? Number(data.internalDate) : undefined;
  const bodyText = extractPlainText(data.payload) || null;

  return {
    id,
    threadId: data.threadId,
    subject,
    from,
    internetMessageId,
    internalDate: internalTimestamp ? new Date(internalTimestamp).toISOString() : data.internalDate,
    internalTimestamp,
    snippet: data.snippet,
    bodyText,
  };
}

function deriveCompany(
  from?: string | null,
  subject?: string | null,
  snippet?: string | null,
  body?: string | null
): string | null {
  const result = CompanyUtils.extractCompany(subject, body, from, snippet);
  return result.value;
}

function deriveRole(
  subject?: string | null,
  from?: string | null,
  snippet?: string | null,
  body?: string | null
): string | null {
  const result = JobUtils.extractJobTitle(subject, body, from, snippet);
  return JobUtils.cleanJobTitle(result.value) || result.value;
}

const PROMPT_A_SYSTEM = `You are an information extraction engine for job application emails.

Return ONLY valid JSON that matches the schema in the user message.
No markdown. No extra keys. No commentary.

Rules:
- Use evidence-based extraction only. If you cannot find a value in the input, set it to null and lower confidence.
- Do NOT guess the company from the email platform (Workday, Greenhouse, Ashby). Platform is not the employer.
- Prefer company and role that are explicitly stated in the subject or body.
- If the sender domain is a platform (workday, greenhouse-mail.io, ashbyhq.com), search the body and URLs for the employer.
- If uncertain, set company.name = null and company.confidence < 0.70.
- Keep evidence short, max 2 snippets per field, each snippet max 12 words.
- event_type must be one of the enum values.
- application.status must be one of the enum values.
- platform.provider must be one of the enum values.`;

const PROMPT_B_SYSTEM = `You extract structured interview and assessment details from job application emails.

Return ONLY valid JSON matching the schema in the user message.
No markdown. No extra keys. No commentary.

Rules:
- Extract only what is present. Never guess times or timezones.
- Prefer explicit date and time strings. If multiple options exist, return the earliest upcoming one.
- If you find a scheduling link (Calendly, GoodTime, Google Calendar, Microsoft Bookings, Ashby scheduling, Greenhouse scheduling), include it.
- If you find a meeting link (Zoom, Teams, Google Meet), include it separately.
- Evidence snippets must be short, max 12 words each.`;

async function callOpenAI(prompt: { system: string; user: string }) {
  // @ts-ignore
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return null;
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        max_tokens: 500,
        temperature: 0,
      }),
    });
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    return safeParseJson(content);
  } catch {
    return null;
  }
}

function buildPromptAInput(input: {
  threadId?: string | null;
  messageId?: string | null;
  internalDate?: string | null;
  from?: string | null;
  replyTo?: string | null;
  subject?: string | null;
  snippet?: string | null;
  bodyText?: string | null;
  extractedUrls: string[];
}) {
  return `Extract job application info from this email.

Return JSON with this exact schema:
{
  "is_job_related": boolean,
  "job_related_confidence": number,
  "event_type": "APPLICATION_CONFIRMATION" | "INTERVIEW_REQUEST" | "ASSESSMENT_INVITE" | "REJECTION" | "OFFER" | "RECRUITER_OUTREACH" | "UPDATE" | "OTHER",
  "company": { "name": string|null, "confidence": number, "evidence": string[] },
  "role": { "title": string|null, "confidence": number, "evidence": string[] },
  "platform": { "provider": "WORKDAY" | "GREENHOUSE" | "ASHBY" | "LEVER" | "SMARTRECRUITERS" | "ICIMS" | "TALEO" | "SUCCESSFACTORS" | "HACKERRANK" | "CODESIGNAL" | "HIREVUE" | "OTHER" | "UNKNOWN", "confidence": number },
  "application": { "status": "APPLIED" | "IN_REVIEW" | "INTERVIEWING" | "ASSESSMENT" | "REJECTED" | "OFFER" | "UNKNOWN", "applied_date": string|null },
  "identifiers": { "job_id": string|null, "requisition_id": string|null, "application_id": string|null },
  "dedupe": { "thread_id": string|null, "message_id": string|null, "portal_domain": string|null, "canonical_key": string|null },
  "notes": string,
  "errors": string[]
}

Important rules for canonical_key:
- If you have company.name and role.title with confidence >= 0.70, set canonical_key = normalize(company.name) + "::" + normalize(role.title) + "::" + (requisition_id or job_id or portal_domain or "na")
- Else canonical_key must be null.

normalize rules:
- lowercase
- remove punctuation
- collapse whitespace
- remove common suffixes like inc, llc, ltd, corporation, corp, co

Input email:
${JSON.stringify({
    thread_id: input.threadId ?? null,
    message_id: input.messageId ?? null,
    internal_date: input.internalDate ?? null,
    from: input.from ?? null,
    reply_to: input.replyTo ?? null,
    subject: input.subject ?? null,
    snippet: input.snippet ?? null,
    body_text: input.bodyText ?? null,
    extracted_urls: input.extractedUrls,
  })}`;
}

function buildPromptBInput(input: {
  from?: string | null;
  subject?: string | null;
  bodyText?: string | null;
  extractedUrls: string[];
}) {
  return `Extract interview or assessment details from this email.

Return JSON with this exact schema:
{
  "event_type": "INTERVIEW_REQUEST" | "ASSESSMENT_INVITE" | "OFFER" | "UPDATE" | "OTHER",
  "interview": {
    "requested": boolean,
    "date_time_candidates": string[],
    "timezone": string|null,
    "scheduling_link": string|null,
    "meeting_link": string|null,
    "contact_email": string|null,
    "evidence": string[]
  },
  "assessment": {
    "invited": boolean,
    "provider": "HACKERRANK" | "CODESIGNAL" | "CODILITY" | "HACKEREARTH" | "HIREVUE" | "OTHER" | "UNKNOWN",
    "deadline": string|null,
    "assessment_link": string|null,
    "evidence": string[]
  },
  "identifiers": { "job_id": string|null, "requisition_id": string|null, "application_id": string|null },
  "errors": string[]
}

Input email:
${JSON.stringify({
    from: input.from ?? null,
    subject: input.subject ?? null,
    body_text: input.bodyText ?? null,
    extracted_urls: input.extractedUrls,
  })}`;
}

function safeParseDate(input?: string | null): string | null {
  if (!input) return null;
  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: JSON_HEADERS });
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Service misconfigured' }, 500);
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return jsonResponse({ error: 'Service misconfigured' }, 500);
    }

    const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const requestBody = await req.json().catch(() => ({}));
    let incomingRefresh = (requestBody as any)?.refresh_token || null;
    const incomingEmail = (requestBody as any)?.email || user.email || null;
    const incomingServerAuthCode = (requestBody as any)?.server_auth_code || null;
    const hardSync = Boolean((requestBody as any)?.hard_sync);
    const lightSync = Boolean((requestBody as any)?.light_sync);
    const lookbackMonthsRaw = (requestBody as any)?.lookback_months ?? null;
    const lookbackMonths = typeof lookbackMonthsRaw === "string" ? lookbackMonthsRaw : (typeof lookbackMonthsRaw === "number" ? lookbackMonthsRaw : null);
    const maxMessagesRaw = Number((requestBody as any)?.max_messages);
    const maxMessagesOverride =
      Number.isFinite(maxMessagesRaw) && maxMessagesRaw > 0 ? Math.min(Math.floor(maxMessagesRaw), 200) : null;
    const enrichOnly = Boolean((requestBody as any)?.enrich_only);
    const pageTokenFromClient = (requestBody as any)?.page_token || null;
    const seedOnly = Boolean((requestBody as any)?.seed_only);
    const rawMaxMessages = Number((requestBody as any)?.max_messages);
    const defaultMaxMessages = hardSync ? 200 : lightSync ? 40 : 100;
    const maxMessages = Number.isFinite(rawMaxMessages) && rawMaxMessages > 0
      ? Math.min(500, Math.floor(rawMaxMessages))
      : defaultMaxMessages;
    const syncStartMs = Date.now();
    const TIME_BUDGET_MS = 110_000;
    const LLM_MAX_PER_SYNC = enrichOnly ? 15 : hardSync ? 6 : 8;
    const LLM_MIN_TIME_REMAINING_MS = 15_000;
    const PHASE1_LOOKBACK_DAYS = 60;
    const DEEP_SYNC_MAX_MESSAGES_PER_RUN = 200;
    const DEEP_SYNC_TOTAL_LIMIT = DEEP_SYNC_MAX_MESSAGES_PER_RUN * 20;
    let llmCalls = 0;
    let fullFetches = 0;
    const FULL_FETCH_MAX = enrichOnly ? 20 : hardSync ? 15 : 20;
    let syncType: "full" | "incremental" | "enrich" = hardSync ? 'full' : 'incremental';

    const writeSyncLogError = async (message: string) => {
      if (seedOnly) return;
      const payload: Record<string, unknown> = {
        user_id: user.id,
        status: 'error',
        error_message: message,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        sync_type: syncType,
        messages_processed: 0,
      };
      const { error: logError } = await admin.from('gmail_sync_logs').insert([payload]);
      if (logError) {
        console.error('gmail-sync-user failed to write error sync log', logError);
      }
    };

    if (!incomingRefresh && incomingServerAuthCode) {
      try {
        const tokenData = await exchangeAuthCodeForTokens(incomingServerAuthCode);
        incomingRefresh = tokenData.refresh_token || null;
      } catch (exchangeErr: any) {
        console.error('gmail-sync-user failed to exchange auth code', exchangeErr);
        await writeSyncLogError(exchangeErr?.message || 'Unable to exchange Google auth code');
        return jsonResponse({ error: exchangeErr?.message || 'Unable to exchange Google auth code' }, 500);
      }
    }

    const { data: connectionData, error: connError } = await admin
      .from('gmail_connections')
      .select('id,user_id,email,refresh_token,provider,last_synced_at,backfill_page_token,backfill_started_at,backfill_completed_at,backfill_total_estimate,backfill_processed_count')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle();
    let connection = connectionData as (GmailConnection & { last_synced_at?: string | null }) | null;

    if (connError) {
      await writeSyncLogError(connError.message || 'Unable to read Gmail connection');
      return jsonResponse({ error: connError.message }, 500);
    }

    if (!connection) {
      // Fallback: any provider row for this user (in case provider value differs)
      const { data: anyConn, error: anyErr } = await admin
        .from('gmail_connections')
        .select('id,user_id,email,refresh_token,provider,backfill_page_token,backfill_started_at,backfill_completed_at,backfill_total_estimate,backfill_processed_count')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!anyErr && anyConn) {
        connection = anyConn as GmailConnection;
        console.warn('gmail-sync-user provider mismatch, using available connection', {
          user_id: user.id,
          provider: connection?.provider,
        });
      }
    }

    // If still no connection but we received a refresh token from the client, seed it once.
    if (!connection && incomingRefresh) {
      const { error: seedError } = await admin.from('gmail_connections').insert({
        user_id: user.id,
        provider: 'google',
        email: incomingEmail,
        refresh_token: incomingRefresh,
      });
      if (seedError) {
        console.error('gmail-sync-user failed to seed connection', seedError);
      } else {
        const { data: seeded } = await admin
          .from('gmail_connections')
          .select('user_id,email,refresh_token,provider')
          .eq('user_id', user.id)
          .maybeSingle();
        connection = seeded as GmailConnection | null;
        console.log('gmail-sync-user seeded connection from request body', {
          user_id: user.id,
          provider: connection?.provider,
          has_refresh_token: !!connection?.refresh_token,
        });
      }
    }

    if (!connection) {
      if (seedOnly && !incomingRefresh) {
        return jsonResponse({
          ok: true,
          seed_only: true,
          has_refresh_token: false,
          provider: 'google',
          email: incomingEmail ?? user.email,
        });
      }
      console.warn('gmail-sync-user no connection found', { user_id: user.id });
      await writeSyncLogError('No Gmail connection found for user');
      return jsonResponse({ error: 'No Gmail connection found for user' }, 404);
    }

    const gmail = connection as GmailConnection;
    const isInitialImport = !enrichOnly && !hardSync && !connection?.last_synced_at;
    const isDeepSync = !enrichOnly && hardSync;
    syncType = enrichOnly ? 'enrich' : (hardSync ? 'full' : (connection?.last_synced_at ? 'incremental' : 'full'));
    console.log('gmail-sync-user start', {
      user_id: user.id,
      email: gmail.email,
      provider: gmail.provider,
      has_refresh_token: !!gmail.refresh_token,
      incoming_refresh: !!incomingRefresh,
      seed_only: seedOnly,
    });

    if (!gmail.refresh_token && incomingRefresh) {
      const { error: updateError } = await admin
        .from('gmail_connections')
        .update({ refresh_token: incomingRefresh, email: gmail.email ?? incomingEmail })
        .eq('user_id', user.id)
        .eq('provider', gmail.provider || 'google');
      if (!updateError) {
        gmail.refresh_token = incomingRefresh;
      } else {
        console.error('gmail-sync-user failed to backfill refresh token', updateError);
      }
    }

    if (seedOnly) {
      return jsonResponse({
        ok: true,
        seed_only: true,
        has_refresh_token: !!gmail.refresh_token,
        provider: gmail.provider ?? 'google',
        email: gmail.email ?? incomingEmail ?? user.email,
      });
    }

    if (!gmail.refresh_token) {
      console.warn('gmail-sync-user missing refresh token', { user_id: user.id, provider: gmail.provider });
      await writeSyncLogError('Missing refresh token for Gmail connection');
      return jsonResponse({ error: 'Missing refresh token for Gmail connection' }, 400);
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken(gmail.refresh_token);
    } catch (err: any) {
      await writeSyncLogError(err?.message || 'Unable to get Gmail access token');
      return jsonResponse({ error: err?.message || 'Unable to get Gmail access token' }, 500);
    }

    const updateSyncState = async (updates: Record<string, unknown>) => {
      if (enrichOnly) return;
      await admin.from('gmail_sync_state').upsert({
        user_id: user.id,
        connection_id: gmail.id ?? null,
        ...updates,
      }, { onConflict: 'user_id' });
    };

    // Build Gmail query using the optimized query builder
    let query = '';
    if (!enrichOnly) {
      query = buildOptimizedGmailQuery({
        hardSync,
        lightSync,
        lookbackMonths,
        lastSyncedAt: connection?.last_synced_at || null,
        isInitialImport,
      });
      console.log('gmail-sync-user query built', { query: query.substring(0, 200) + '...' });
    }

    let syncLogId: number | null = null;
    let resolvedSyncType: "full" | "incremental" | "enrich" = syncType;
    let totalMessagesFetched = 0;
    let nextPageTokenFromSync: string | undefined;
    let eventInserted = 0;
    let eventUpdated = 0;
    let appInserted = 0;
    let appUpdated = 0;

    try {
      // create sync log entry
      const { data: syncLog, error: logError } = await admin
        .from('gmail_sync_logs')
        .insert([{
          user_id: user.id,
          status: 'running',
          sync_type: resolvedSyncType,
          started_at: new Date().toISOString()
        }])
        .select('id')
        .maybeSingle();
      if (logError) {
        console.error('gmail-sync-user failed to create sync log', logError);
      } else {
        syncLogId = (syncLog as any)?.id ?? null;
      }

      const ids: { id: string }[] = [];
      let estimateFromSync: number | null = null;
      let lastProgressPercent: number | null = null;
      let backfillProcessedCount: number | null = null;
      if (isInitialImport) {
        await updateSyncState({
          initial_import_status: 'phase1_running',
          initial_import_progress: 0,
          last_sync_summary: 'Phase 1 sync started.',
        });
      }
      if (isDeepSync) {
        await updateSyncState({
          initial_import_status: 'deep_running',
          last_sync_summary: 'Deep sync started.',
        });
      }
      if (enrichOnly) {
        const { data: enrichRows } = await admin
          .from('job_email_events')
          .select('gmail_message_id')
          .eq('user_id', user.id)
          .is('llm_parsed_json', null)
          .order('received_at', { ascending: false })
          .limit(maxMessages);
        ids.push(
          ...(enrichRows || [])
            .map((row: any) => ({ id: row.gmail_message_id }))
            .filter((row: any) => !!row.id)
        );
        totalMessagesFetched = ids.length;
        nextPageTokenFromSync = undefined;
      } else {
        let pageToken: string | undefined =
          pageTokenFromClient || (hardSync ? connection?.backfill_page_token || undefined : undefined);
        const maxTotalMessages = hardSync
          ? DEEP_SYNC_MAX_MESSAGES_PER_RUN
          : isInitialImport
            ? (lightSync ? 100 : 200)
            : 500;
        while (true) {
          const { messages: messageIds, nextPageToken, resultSizeEstimate } = await listMessages(
            accessToken,
            query,
            maxMessages,
            pageToken
          );
          if (estimateFromSync === null && typeof resultSizeEstimate === 'number') {
            estimateFromSync = resultSizeEstimate;
          }
          ids.push(...messageIds);
          totalMessagesFetched = ids.length;
          nextPageTokenFromSync = nextPageToken;
          if (estimateFromSync && (isInitialImport || isDeepSync)) {
            const percent = Math.min(100, Math.round((totalMessagesFetched / estimateFromSync) * 100));
            if (lastProgressPercent === null || percent >= lastProgressPercent + 5) {
              lastProgressPercent = percent;
              await updateSyncState({ initial_import_progress: percent });
            }
          }
          const timeRemaining = TIME_BUDGET_MS - (Date.now() - syncStartMs);
          if (!nextPageToken) break;
          if (totalMessagesFetched >= maxTotalMessages) break;
          if (timeRemaining < 10_000) break;
          pageToken = nextPageToken;
        }
        if (hardSync) {
          const isFreshBackfill =
            !pageTokenFromClient &&
            !connection?.backfill_page_token &&
            !connection?.backfill_started_at;
          const nextProcessedCount =
            (isFreshBackfill ? 0 : (connection?.backfill_processed_count || 0)) + ids.length;
          backfillProcessedCount = nextProcessedCount;
          if (nextPageTokenFromSync) {
            await admin
              .from('gmail_connections')
              .update({
                backfill_page_token: nextPageTokenFromSync,
                backfill_started_at: connection?.backfill_started_at || new Date().toISOString(),
                backfill_completed_at: null,
                backfill_total_estimate: estimateFromSync ?? connection?.backfill_total_estimate ?? null,
                backfill_processed_count: nextProcessedCount,
              })
              .eq('user_id', user.id)
              .eq('provider', connection.provider || 'google');
            if (isDeepSync) {
              const deepEstimate = estimateFromSync ?? connection?.backfill_total_estimate ?? null;
              const deepProgress = deepEstimate
                ? Math.min(99, Math.round((nextProcessedCount / deepEstimate) * 100))
                : null;
              await updateSyncState({
                initial_import_progress: deepProgress,
              });
            }
          } else {
            await admin
              .from('gmail_connections')
              .update({
                backfill_page_token: null,
                backfill_started_at: connection?.backfill_started_at || new Date().toISOString(),
                backfill_completed_at: new Date().toISOString(),
                backfill_total_estimate: estimateFromSync ?? connection?.backfill_total_estimate ?? null,
                backfill_processed_count: nextProcessedCount,
              })
              .eq('user_id', user.id)
              .eq('provider', connection.provider || 'google');
            if (isDeepSync) {
              await updateSyncState({
                initial_import_progress: 100,
              });
            }
          }
        }
      }
      totalMessagesFetched = ids.length;
      const messages: GmailMessage[] = [];
      const appResults: Array<{ gmail_message_id: string; action: 'inserted' | 'updated' | 'error'; error?: string }> =
        [];
      const notificationDedup = new Set<string>();
      const notificationCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const appCache = new Map<string, { status: string | null; company: string | null; role: string | null }>();
      let llmSampleLogs = 0;
      const LLM_SAMPLE_LIMIT = 10;

      async function createNotificationOnce(
        dedupKey: string,
        payload: Record<string, unknown>,
        options?: { statusTo?: string }
      ) {
        if (notificationDedup.has(dedupKey)) return;
        notificationDedup.add(dedupKey);
        let query = admin
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('subtype', payload.subtype as string)
          .gte('created_at', notificationCutoff)
          .limit(1);
        if (payload.entity_id) {
          query = query.eq('entity_id', payload.entity_id as string);
        }
        if (options?.statusTo) {
          query = query.eq('metadata->>status_to', options.statusTo);
        }
        const { data: existingNotification, error: existingError } = await query;
        if (existingError) {
          console.warn('gmail-sync-user failed to check notification dedup', existingError);
          return;
        }
        if (existingNotification && existingNotification.length > 0) return;
        const { error: insertError } = await admin.from('notifications').insert([payload]);
        if (insertError) {
          console.error('gmail-sync-user failed to insert notification', insertError);
        }
      }

      const messageIds = ids.map((item) => item.id);
      const existingAppsByMessage = new Map<string, any>();
      const existingEventsByMessage = new Map<string, any>();
      const pendingEventUpserts: Array<Record<string, unknown>> = [];
      const pendingTaskUpserts: Array<Record<string, unknown>> = [];
      if (messageIds.length > 0) {
        const { data: existingApps } = await admin
          .from('applications')
          .select('id, company, role, role_title, status, source_type, gmail_message_id')
          .eq('user_id', user.id)
          .in('gmail_message_id', messageIds);
        (existingApps || []).forEach((app: any) => {
          if (app.gmail_message_id) {
            existingAppsByMessage.set(app.gmail_message_id, app);
          }
        });

        const { data: existingEvents } = await admin
          .from('job_email_events')
          .select('id, application_id, user_id, gmail_message_id, gmail_thread_id, parsed_company, parsed_role, parsed_status, event_type, llm_parsed_json')
          .eq('user_id', user.id)
          .in('gmail_message_id', messageIds);
        (existingEvents || []).forEach((event: any) => {
          if (event.gmail_message_id) {
            existingEventsByMessage.set(event.gmail_message_id, event);
          }
        });
      }

      let latestMessageTime: string | null = null;
      const syncTimestamp = new Date().toISOString();
      for (const { id } of ids) {
        try {
          const msg = await fetchMessageMetadata(accessToken, id);
          messages.push(msg);
          if (msg.internalDate && (!latestMessageTime || msg.internalDate > latestMessageTime)) {
            latestMessageTime = msg.internalDate;
          }
          console.log('gmail-sync-user fetched', {
            id: msg.id,
            subject: msg.subject,
            from: msg.from,
            internalDate: msg.internalDate,
          });

          const existing = existingAppsByMessage.get(msg.id) || null;
          if (existing?.id) {
            appCache.set(existing.id, {
              status: (existing as any).status ?? null,
              company: (existing as any).company ?? null,
              role: (existing as any).role ?? null,
            });
          }

          const roleGuess = deriveRole(msg.subject, msg.from, msg.snippet, msg.bodyText) || 'Job application';

          const receivedAt =
            (msg.internalTimestamp && new Date(msg.internalTimestamp).toISOString()) ||
            msg.internalDate ||
            new Date().toISOString();

          function classifyJobEmailEvent(
            subject: string | null | undefined,
            from: string | null | undefined,
            snippet?: string | null,
            body?: string | null
          ) {
            const status = determineStatusHeuristic(subject, body, snippet);
            if (status === 'Applied') return { event_type: 'application_received', confidence: 0.95 };
            if (status === 'Interview') return { event_type: 'interview_invite', confidence: 0.95 };
            if (status === 'Assessment') return { event_type: 'assessment', confidence: 0.9 };
            if (status === 'Rejected') return { event_type: 'rejection', confidence: 0.95 };
            if (status === 'Offer') return { event_type: 'offer', confidence: 0.95 };
            const s = (subject || '').toLowerCase();
            const snip = (snippet || '').toLowerCase();
            if (s.includes('recruiting') || snip.includes('recruiting')) {
              return { event_type: 'other', confidence: 0.6 };
            }
            return { event_type: 'other', confidence: 0.5 };
          }

          async function parseCompanyAndRole(
            subject: string | null | undefined,
            from: string | null | undefined,
            snippet?: string | null,
            body?: string | null
          ) {
            const platform = detectPlatform(from, body, snippet);
            const companyResult = CompanyUtils.extractCompany(subject, body, from, snippet);
            const roleResult = JobUtils.extractJobTitle(subject, body, from, snippet);
            let parsed_company = companyResult.value || null;
            const cleanedRole = JobUtils.cleanJobTitle(roleResult.value);
            const parsed_role = cleanedRole || roleResult.value || null;

            let confidence = 0.4;
            if (parsed_company) {
              const lowerCompany = parsed_company.toLowerCase();
              if (isAtsName(lowerCompany) || (platform && lowerCompany.includes(platform))) {
                parsed_company = null;
              }
            }
            if (parsed_company) {
              if (companyResult.source === 'body') {
                confidence += 0.4;
              } else if (companyResult.source === 'subject') {
                confidence += 0.35;
              } else {
                confidence += platform ? 0.05 : 0.15;
              }
            }
            if (parsed_role) {
              confidence += roleResult.source === 'subject' ? 0.35 : 0.25;
            }
            confidence = Math.min(0.98, confidence);
            return { parsed_company, parsed_role, confidence };
          }

          const existingEvent = existingEventsByMessage.get(msg.id) || null;

          let classification = classifyJobEmailEvent(msg.subject, msg.from, msg.snippet, msg.bodyText);
          let parsing = await parseCompanyAndRole(msg.subject, msg.from, msg.snippet, msg.bodyText);
          let heuristicStatus = determineStatusHeuristic(msg.subject, msg.bodyText, msg.snippet);
          const timeRemaining = TIME_BUDGET_MS - (Date.now() - syncStartMs);
          const heuristicConfidence = Math.max(classification.confidence, parsing.confidence);
          const allowLlmByHeuristic = enrichOnly ? true : heuristicConfidence < 0.9;
          const shouldUsePromptA =
            !lightSync &&
            llmCalls < LLM_MAX_PER_SYNC &&
            timeRemaining > LLM_MIN_TIME_REMAINING_MS &&
            (allowLlmByHeuristic || !parsing.parsed_company || !parsing.parsed_role) &&
            (!existingEvent?.llm_parsed_json || enrichOnly);

          const needsFullFetch = parsing.confidence < 0.7 || !heuristicStatus || shouldUsePromptA;
          if (!msg.bodyText && needsFullFetch && fullFetches < FULL_FETCH_MAX && timeRemaining > 10_000) {
            const fullMsg = await fetchMessageFull(accessToken, id);
            msg.bodyText = fullMsg.bodyText;
            msg.snippet = fullMsg.snippet ?? msg.snippet;
            msg.subject = fullMsg.subject ?? msg.subject;
            msg.from = fullMsg.from ?? msg.from;
            msg.internetMessageId = fullMsg.internetMessageId ?? msg.internetMessageId;
            fullFetches += 1;
            parsing = await parseCompanyAndRole(msg.subject, msg.from, msg.snippet, msg.bodyText);
            heuristicStatus = determineStatusHeuristic(msg.subject, msg.bodyText, msg.snippet);
            classification = classifyJobEmailEvent(msg.subject, msg.from, msg.snippet, msg.bodyText);
          }

          const cleanedBody = stripQuotedReplies(msg.bodyText);
          const topLines = buildTopLines(cleanedBody || msg.bodyText);
          const bodyForLlm = [topLines, cleanedBody].filter(Boolean).join('\n\n').trim();
          const extractedUrls = extractUrlsFromText(bodyForLlm || msg.snippet || '');
          const portalDomain = extractPortalDomain(extractedUrls);
          const extractedJobId = extractJobIdFromUrls(extractedUrls);

          let promptAResult: any | null = null;
          if (shouldUsePromptA && bodyForLlm) {
            promptAResult = await callOpenAI({
              system: PROMPT_A_SYSTEM,
              user: buildPromptAInput({
                threadId: msg.threadId ?? null,
                messageId: msg.id,
                internalDate: msg.internalDate ?? null,
                from: msg.from ?? null,
                replyTo: null,
                subject: msg.subject ?? null,
                snippet: msg.snippet ?? null,
                bodyText: bodyForLlm,
                extractedUrls,
              }),
            });
            llmCalls += 1;
            if (promptAResult && llmSampleLogs < LLM_SAMPLE_LIMIT) {
              llmSampleLogs += 1;
              console.log('gmail-sync-user llm sample', {
                sample_index: llmSampleLogs,
                gmail_message_id: msg.id,
                thread_id: msg.threadId ?? null,
                subject: msg.subject ?? null,
                from: msg.from ?? null,
                parsed: promptAResult,
              });
            }
          }

          const isJobRelated = promptAResult ? isJobRelatedFromPrompt(promptAResult) : true;
          const promptCompany = promptAResult?.company?.name ? String(promptAResult.company.name) : null;
          const promptCompanyConfidence =
            typeof promptAResult?.company?.confidence === 'number' ? promptAResult.company.confidence : null;
          const promptRole = promptAResult?.role?.title ? String(promptAResult.role.title) : null;
          const promptRoleConfidence =
            typeof promptAResult?.role?.confidence === 'number' ? promptAResult.role.confidence : null;
          const promptEventType = mapEventTypeFromPrompt(promptAResult?.event_type || null);
          const promptStatus = mapStatusFromPrompt(promptAResult?.application?.status || null);
          const promptJobId = promptAResult?.identifiers?.job_id ?? null;
          const promptReqId = promptAResult?.identifiers?.requisition_id ?? null;
          const promptAppId = promptAResult?.identifiers?.application_id ?? null;
          const promptPortalDomain = promptAResult?.dedupe?.portal_domain ?? null;

          let parsedCompany = promptCompany || parsing.parsed_company || (existingEvent as any)?.parsed_company || null;
          let parsedRole = promptRole || parsing.parsed_role || (existingEvent as any)?.parsed_role || null;
          if (parsedCompany && isAtsName(parsedCompany)) {
            parsedCompany = null;
          }
          if (parsedRole && JobUtils.isLikelyNotRole(parsedRole)) {
            parsedRole = null;
          }

          const companyConfidence =
            parsedCompany === promptCompany && promptCompanyConfidence !== null
              ? promptCompanyConfidence
              : (parsedCompany ? parsing.confidence : 0);
          const roleConfidence =
            parsedRole === promptRole && promptRoleConfidence !== null
              ? promptRoleConfidence
              : (parsedRole ? parsing.confidence : 0);

          const resolvedPortalDomain = promptPortalDomain || portalDomain;
          // Use extracted job ID if LLM didn't provide one
          const resolvedJobId = promptJobId || extractedJobId;
          const canonicalKey = buildCanonicalKey({
            company: parsedCompany,
            role: parsedRole,
            companyConfidence,
            roleConfidence,
            requisitionId: promptReqId,
            jobId: resolvedJobId,
            portalDomain: resolvedPortalDomain,
          });

          const eventType = promptEventType || classification.event_type;
          const statusFromEvent = statusFromEventType(eventType);
          const parsedStatus = pickHigherStatus(
            promptStatus,
            statusFromEvent,
            heuristicStatus,
            (existingEvent as any)?.parsed_status || null,
            existing?.status || null,
          );

          const canCreateApp = !!parsedCompany && !!parsedRole && companyConfidence >= 0.7 && roleConfidence >= 0.7;

          const resolvedCompany = parsedCompany ? capitalizeFirstLetter(parsedCompany) : null;
          const resolvedRoleRaw = parsedRole || roleGuess;
          const resolvedRole = JobUtils.cleanJobTitle(resolvedRoleRaw) || resolvedRoleRaw;

          if (!isJobRelated) {
            continue;
          }

          const duplicateInternetId =
            msg.internetMessageId
              ? await admin
                .from('job_email_events')
                .select('id, gmail_message_id, application_id')
                .eq('user_id', user.id)
                .eq('internet_message_id', msg.internetMessageId)
                .maybeSingle()
              : null;
          if (duplicateInternetId?.data?.gmail_message_id && duplicateInternetId.data.gmail_message_id !== msg.id) {
            continue;
          }

          let foundAppId: string | null = (existingEvent as any)?.application_id || null;

          if (!foundAppId && promptAppId) {
            const { data: appByExternal } = await admin
              .from('applications')
              .select('id, status, company, role, created_at, portal_domain')
              .eq('user_id', user.id)
              .eq('external_application_id', promptAppId)
              .maybeSingle();
            if (appByExternal?.id) foundAppId = appByExternal.id;
          }
          if (!foundAppId && promptReqId) {
            const { data: appByReq } = await admin
              .from('applications')
              .select('id')
              .eq('user_id', user.id)
              .eq('requisition_id', promptReqId)
              .maybeSingle();
            if (appByReq?.id) foundAppId = appByReq.id;
          }
          if (!foundAppId && promptJobId) {
            const { data: appByJob } = await admin
              .from('applications')
              .select('id')
              .eq('user_id', user.id)
              .eq('job_id', promptJobId)
              .maybeSingle();
            if (appByJob?.id) foundAppId = appByJob.id;
          }
          if (!foundAppId && msg.threadId) {
            const { data: appByThread } = await admin
              .from('applications')
              .select('id')
              .eq('user_id', user.id)
              .eq('gmail_thread_id', msg.threadId)
              .maybeSingle();
            if (appByThread?.id) foundAppId = appByThread.id;
          }
          if (!foundAppId && canonicalKey) {
            const { data: appByCanonical } = await admin
              .from('applications')
              .select('id')
              .eq('user_id', user.id)
              .eq('canonical_key', canonicalKey)
              .maybeSingle();
            if (appByCanonical?.id) foundAppId = appByCanonical.id;
          }
          // Improved fuzzy matching with better company and role comparison
          if (!foundAppId && parsedCompany && parsedRole && companyConfidence >= 0.7 && roleConfidence >= 0.6) {
            const { data: fuzzyApps } = await admin
              .from('applications')
              .select('id, company, role, created_at, portal_domain, job_id')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(20);
            const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
            const match = (fuzzyApps || []).find((app: any) => {
              // Check company match using improved similarity
              const companyMatch = app.company ? areSameCompany(parsedCompany, app.company) : false;
              if (!companyMatch) return false;

              // Check role match using improved similarity
              const roleMatch = app.role ? areSameRole(parsedRole, app.role) : false;
              if (!roleMatch) return false;

              // Additional checks for confidence
              const dateOk = app.created_at ? new Date(app.created_at).getTime() >= sixMonthsAgo : false;
              const portalOk = resolvedPortalDomain && app.portal_domain ?
                resolvedPortalDomain === app.portal_domain : false;
              const jobIdOk = resolvedJobId && app.job_id ?
                resolvedJobId === app.job_id : false;

              return dateOk || portalOk || jobIdOk;
            });
            if (match?.id) foundAppId = match.id;
          }

          const eventPayload: Record<string, unknown> = {
            user_id: user.id,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId ?? null,
            internet_message_id: msg.internetMessageId ?? null,
            raw_subject: msg.subject ?? null,
            raw_from: msg.from ?? null,
            raw_snippet: msg.snippet ?? null,
            received_at: receivedAt,
            event_type: eventType,
            confidence: Math.max(
              classification.confidence,
              parsing.confidence,
              promptCompanyConfidence || 0,
              promptRoleConfidence || 0
            ),
            parsed_company: resolvedCompany || null,
            parsed_role: resolvedRole || null,
            parsed_status: parsedStatus || null,
            portal_domain: resolvedPortalDomain,
            canonical_key: canonicalKey,
            job_id: promptJobId,
            requisition_id: promptReqId,
            external_application_id: promptAppId,
            llm_parsed_json: promptAResult
              ? { prompt_a: promptAResult }
              : (existingEvent as any)?.llm_parsed_json || null,
          };

          const { data: upsertedEvent, error: eventUpsertError } = await admin
            .from('job_email_events')
            .upsert([eventPayload], { onConflict: 'user_id,gmail_message_id' })
            .select('id, application_id, user_id, gmail_thread_id, parsed_company, parsed_role, event_type');
          if (eventUpsertError) {
            console.error('gmail-sync-user failed to upsert job_email_event', {
              message_id: msg.id,
              error: eventUpsertError,
            });
          } else if (existingEvent?.id) {
            eventUpdated += 1;
          } else {
            eventInserted += 1;
          }

          const eventRow = (upsertedEvent && upsertedEvent[0]) || eventPayload;

          if (foundAppId && eventRow?.id) {
            await admin
              .from('job_email_events')
              .update({ application_id: foundAppId })
              .eq('id', eventRow.id);
          }

          const shouldUpdateAppFields = (value: string | null | undefined, existingValue: string | null | undefined) => {
            if (!value) return false;
            if (!existingValue) return true;
            const lower = existingValue.toLowerCase();
            return lower.includes('unknown');
          };

          if (foundAppId) {
            let cachedApp = appCache.get(foundAppId);
            if (!cachedApp) {
              const { data: appRow } = await admin
                .from('applications')
                .select('status, company, role, role_title, gmail_thread_id, canonical_key, portal_domain')
                .eq('id', foundAppId)
                .maybeSingle();
              if (appRow) {
                cachedApp = {
                  status: (appRow as any).status ?? null,
                  company: (appRow as any).company ?? null,
                  role: (appRow as any).role ?? null,
                };
                appCache.set(foundAppId, cachedApp);
              }
            }
            const nextStatus = pickHigherStatus(parsedStatus || null, cachedApp?.status || null);
            const updatePayload: Record<string, unknown> = {
              last_synced_at: syncTimestamp,
            };
            if (resolvedCompany && shouldUpdateAppFields(resolvedCompany, cachedApp?.company || null)) {
              updatePayload.company = resolvedCompany;
            }
            if (resolvedRole && shouldUpdateAppFields(resolvedRole, cachedApp?.role || null)) {
              updatePayload.role = resolvedRole;
              updatePayload.role_title = resolvedRole;
            }
            if (msg.threadId) {
              updatePayload.gmail_thread_id = msg.threadId;
            }
            if (canonicalKey) {
              updatePayload.canonical_key = canonicalKey;
            }
            if (resolvedPortalDomain) {
              updatePayload.portal_domain = resolvedPortalDomain;
            }
            if (promptReqId) {
              updatePayload.requisition_id = promptReqId;
            }
            if (promptJobId) {
              updatePayload.job_id = promptJobId;
            }
            if (promptAppId) {
              updatePayload.external_application_id = promptAppId;
            }
            if (nextStatus && nextStatus !== cachedApp?.status) {
              updatePayload.status = nextStatus;
            }

            const { error: updateError } = await admin.from('applications').update(updatePayload).eq('id', foundAppId);
            if (updateError) {
              console.error('gmail-sync-user failed to update application', { id: foundAppId, error: updateError });
              appResults.push({ gmail_message_id: msg.id, action: 'error', error: updateError.message });
            } else {
              appUpdated += 1;
              appResults.push({ gmail_message_id: msg.id, action: 'updated' });
              if (nextStatus && nextStatus !== cachedApp?.status) {
                await createNotificationOnce(`status:${foundAppId}:${nextStatus}`, {
                  user_id: user.id,
                  type: 'update',
                  subtype: 'status_change',
                  title: `Update: ${nextStatus} for ${resolvedCompany || cachedApp?.company || 'Application'}`,
                  body: resolvedRole || cachedApp?.role || null,
                  entity_type: 'application',
                  entity_id: foundAppId,
                  metadata: {
                    status_from: cachedApp?.status || null,
                    status_to: nextStatus,
                    company: resolvedCompany || cachedApp?.company || null,
                    role: resolvedRole || cachedApp?.role || null,
                  },
                  channel: 'both',
                  priority: 'normal',
                  scheduled_for: syncTimestamp,
                }, { statusTo: nextStatus });
              }
            }
          }

          if (!foundAppId && canCreateApp) {
            const initialStatus = pickHigherStatus(parsedStatus || null, statusFromEvent || null, 'Applied');
            const { data: newApp, error: insertError } = await admin
              .from('applications')
              .insert([{
                user_id: user.id,
                company: resolvedCompany || 'Unknown',
                role: resolvedRole || 'Unknown',
                role_title: resolvedRole || 'Unknown',
                source_type: 'gmail',
                gmail_message_id: msg.id,
                gmail_thread_id: msg.threadId ?? null,
                email_snippet: msg.snippet ?? null,
                status: initialStatus,
                last_synced_at: syncTimestamp,
                canonical_key: canonicalKey,
                portal_domain: resolvedPortalDomain,
                requisition_id: promptReqId,
                job_id: promptJobId,
                external_application_id: promptAppId,
              }])
              .select('id, company, role, status')
              .maybeSingle();
            if (insertError) {
              console.error('gmail-sync-user failed to insert application', { message_id: msg.id, error: insertError });
              appResults.push({ gmail_message_id: msg.id, action: 'error', error: insertError.message });
            } else {
              appInserted += 1;
              appResults.push({ gmail_message_id: msg.id, action: 'inserted' });
              if (newApp?.id) {
                foundAppId = newApp.id;
                appCache.set(newApp.id, {
                  status: (newApp as any).status ?? null,
                  company: (newApp as any).company ?? null,
                  role: (newApp as any).role ?? null,
                });
                await admin
                  .from('job_email_events')
                  .update({ application_id: newApp.id })
                  .eq('id', eventRow.id);
                await createNotificationOnce(`new_app:${newApp.id}`, {
                  user_id: user.id,
                  type: 'update',
                  subtype: 'new_application',
                  title: `New job detected: ${(newApp as any).company || 'Application'}`,
                  body: (newApp as any).role || null,
                  entity_type: 'application',
                  entity_id: newApp.id,
                  metadata: {
                    company: (newApp as any).company || null,
                    role: (newApp as any).role || null,
                  },
                  channel: 'both',
                  priority: 'normal',
                  scheduled_for: syncTimestamp,
                });
              }
            }
          }

          let promptBResult: any | null = null;
          const shouldUsePromptB =
            !!promptAResult &&
            bodyForLlm &&
            llmCalls < LLM_MAX_PER_SYNC &&
            (promptEventType === 'interview_invite' ||
              promptEventType === 'assessment' ||
              promptEventType === 'offer' ||
              ((companyConfidence < 0.7 || roleConfidence < 0.7) && isJobRelated));
          if (shouldUsePromptB && bodyForLlm) {
            promptBResult = await callOpenAI({
              system: PROMPT_B_SYSTEM,
              user: buildPromptBInput({
                from: msg.from ?? null,
                subject: msg.subject ?? null,
                bodyText: bodyForLlm,
                extractedUrls,
              }),
            });
            llmCalls += 1;
            if (promptBResult) {
              await admin
                .from('job_email_events')
                .update({
                  llm_parsed_json: {
                    prompt_a: promptAResult,
                    prompt_b: promptBResult,
                  },
                })
                .eq('id', eventRow.id);
            }
          }

          if (foundAppId && promptBResult) {
            const interviewRequested = !!promptBResult?.interview?.requested;
            const interviewStart = safeParseDate(promptBResult?.interview?.date_time_candidates?.[0] || null);
            const interviewMeeting = promptBResult?.interview?.meeting_link || promptBResult?.interview?.scheduling_link || null;
            if (interviewRequested && interviewStart) {
              pendingEventUpserts.push({
                user_id: user.id,
                application_id: foundAppId,
                event_type: 'interview',
                title: `${resolvedCompany || 'Application'} interview`,
                provider: null,
                meeting_link: interviewMeeting,
                start_at: interviewStart,
                end_at: null,
                location: null,
                source_type: 'gmail',
              });
            }

            const assessmentInvited = !!promptBResult?.assessment?.invited;
            const assessmentDeadline = safeParseDate(promptBResult?.assessment?.deadline || null);
            const assessmentLink = promptBResult?.assessment?.assessment_link || null;
            if (assessmentInvited && assessmentDeadline) {
              pendingEventUpserts.push({
                user_id: user.id,
                application_id: foundAppId,
                event_type: 'assessment',
                title: `${resolvedCompany || 'Application'} assessment`,
                provider: null,
                meeting_link: assessmentLink,
                start_at: assessmentDeadline,
                end_at: null,
                location: null,
                source_type: 'gmail',
              });
            }
            if (assessmentInvited && (assessmentDeadline || assessmentLink)) {
              pendingTaskUpserts.push({
                user_id: user.id,
                application_id: foundAppId,
                title: 'Complete assessment',
                description: assessmentLink ? `Assessment link: ${assessmentLink}` : null,
                due_at: assessmentDeadline,
                status: 'open',
                completed_at: null,
                origin: 'gmail',
                source_message_id: msg.id,
              });
            }
          }
        } catch (msgErr) {
          console.error('Failed to fetch message', id, msgErr);
        }
      }
      if (pendingEventUpserts.length > 0) {
        await admin
          .from('events')
          .upsert(pendingEventUpserts, { onConflict: 'user_id,application_id,event_type,start_at' });
      }
      if (pendingTaskUpserts.length > 0) {
        await admin
          .from('tasks')
          .upsert(pendingTaskUpserts, { onConflict: 'user_id,application_id,title,due_at' });
      }

      if (syncLogId) {
        const { error: finishError } = await admin
          .from('gmail_sync_logs')
          .update({
            status: 'success',
            finished_at: new Date().toISOString(),
            sync_type: resolvedSyncType,
            total_messages_fetched: totalMessagesFetched,
            job_email_events_created: eventInserted,
            job_email_events_updated: eventUpdated,
            applications_created: appInserted,
            applications_updated: appUpdated,
            messages_processed: messages.length,
          })
          .eq('id', syncLogId);
        if (finishError) {
          console.error('gmail-sync-user failed to finalize sync log', finishError);
        }
      }
      // Update last_synced_at to now or latest message time
      if (connection && !nextPageTokenFromSync && !enrichOnly) {
        const newSyncTime = latestMessageTime || new Date().toISOString();
        await admin
          .from('gmail_connections')
          .update({ last_synced_at: newSyncTime })
          .eq('user_id', user.id)
          .eq('provider', connection.provider || 'google');
      }

      if (isInitialImport) {
        await updateSyncState({
          initial_import_status: 'phase1_done',
          initial_import_progress: 100,
          last_phase1_result_count: appInserted,
          last_sync_summary: `Phase 1 imported ${appInserted} applications.`,
        });
        const enqueueUrl = `${SUPABASE_URL}/functions/v1/gmail-sync-user`;
        try {
          await fetch(enqueueUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ hard_sync: true }),
          });
          await updateSyncState({
            initial_import_status: 'deep_running',
            last_sync_summary: 'Deep sync queued.',
          });
        } catch (enqueueErr) {
          console.error('gmail-sync-user failed to enqueue deep sync', enqueueErr);
        }
      }

      if (isDeepSync && nextPageTokenFromSync) {
        await updateSyncState({
          initial_import_status: 'deep_running',
          last_deep_result_count: appInserted,
          last_sync_summary: 'Deep sync continuing.',
        });
        if ((backfillProcessedCount ?? 0) < DEEP_SYNC_TOTAL_LIMIT) {
          const enqueueUrl = `${SUPABASE_URL}/functions/v1/gmail-sync-user`;
          try {
            await fetch(enqueueUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                hard_sync: true,
                page_token: nextPageTokenFromSync,
                max_messages: maxMessages,
              }),
            });
          } catch (enqueueErr) {
            console.error('gmail-sync-user failed to enqueue deep sync continuation', enqueueErr);
          }
        } else {
          await updateSyncState({
            initial_import_status: 'deep_done',
            last_sync_summary: 'Deep sync stopped at safety limit.',
          });
        }
      }

      if (isDeepSync && !nextPageTokenFromSync) {
        await updateSyncState({
          initial_import_status: 'deep_done',
          last_deep_result_count: appInserted,
          last_sync_summary: `Deep sync added ${appInserted} applications.`,
        });
      }

      return jsonResponse({
        ok: true,
        user_id: user.id,
        email: gmail.email ?? user.email,
        provider: gmail.provider ?? 'google',
        processed: messages.length,
        next_page_token: nextPageTokenFromSync ?? null,
        debug: {
          had_connection: !!connection,
          inserted: appInserted,
          updated: appUpdated,
          eventInserted,
          eventUpdated,
          llm_used: llmCalls,
          max_messages: maxMessages,
          app_results: appResults.slice(0, 10),
        },
      });
    } catch (err: any) {
      if (isInitialImport || isDeepSync) {
        await updateSyncState({
          initial_import_status: 'failed',
          last_sync_summary: err?.message || 'Gmail sync failed',
        });
      }
      if (syncLogId) {
        const { error: finishError } = await admin
          .from('gmail_sync_logs')
          .update({
            status: 'error',
            finished_at: new Date().toISOString(),
            sync_type: resolvedSyncType,
            total_messages_fetched: totalMessagesFetched,
            job_email_events_created: eventInserted,
            job_email_events_updated: eventUpdated,
            applications_created: appInserted,
            applications_updated: appUpdated,
            error_message: err?.message || 'Gmail sync failed',
          })
          .eq('id', syncLogId);
        if (finishError) {
          console.error('gmail-sync-user failed to mark sync error', finishError);
        }
      } else {
        await writeSyncLogError(err?.message || 'Gmail sync failed');
      }
      return jsonResponse({ error: err?.message || 'Gmail sync failed' }, 500);
    }
  } catch (err: any) {
    console.error('gmail-sync-user unhandled error', err);
    return jsonResponse({ error: err?.message || 'Unhandled error' }, 500);
  }
});
