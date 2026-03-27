// ============================================================================
// Error Logging Utility
// ============================================================================

/**
 * Log a parse error with context for debugging parsing failures.
 * @param message Error message
 * @param context Arbitrary context object (e.g., email fields)
 */
export function logParseError(message: string, context: Record<string, any>) {
  try {
    // eslint-disable-next-line no-console
    console.warn('[parse-error]', message, JSON.stringify(context, null, 2));
  } catch (err) {
    // fallback
    // eslint-disable-next-line no-console
    console.warn('[parse-error]', message, context);
  }
}
// Utility functions for text processing and normalization

import { ATS_WORDS, ATS_DOMAINS, COMPANY_MIN_SCORE } from './constants.ts';
import type { ExtractionSource, ExtractionResult } from './types.ts';

// ============================================================================
// Text Processing Utilities
// ============================================================================

export function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function stripHtml(html: string): string {
  return html
    // Remove style and script blocks entirely (content + tags)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    // Remove remaining HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Decode common entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractPlainText(payload: any): string | null {
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

export function normalizeText(input?: string | null): string {
  if (!input) return '';
  let text = input;
  // Strip HTML if present (safety net for bodies that weren't pre-cleaned)
  if (text.includes('<') || text.includes('>')) {
    text = text
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]{0,2000}>/g, ' ');
  }
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function capitalizeFirstLetter(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function stripQuotedReplies(text?: string | null): string | null {
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

export function buildTopLines(text?: string | null, maxLines = 25): string {
  if (!text) return '';
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.slice(0, maxLines).join('\n');
}

export function extractUrlsFromText(text?: string | null): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s<>()]+/gi) || [];
  const dedup = new Set<string>();
  matches.forEach((raw) => {
    const trimmed = raw.replace(/[),.]+$/g, '').trim();
    if (trimmed) dedup.add(trimmed);
  });
  return Array.from(dedup).slice(0, 20);
}

// ============================================================================
// ATS and URL Detection
// ============================================================================

export function looksLikeUrl(text?: string | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return t.includes('http://') || t.includes('https://') || t.includes('www.') || /\.[a-z]{2,}$/i.test(t);
}

export function isAtsName(text?: string | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  if (!t) return false;
  if (ATS_WORDS.some((word) => t === word || t.includes(word))) return true;
  if (t.includes('.')) return true;
  if (ATS_DOMAINS.some((domain) => t.includes(domain))) return true;
  return false;
}

export function detectPlatform(from?: string | null, body?: string | null, snippet?: string | null): string | null {
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

// ============================================================================
// Normalization for Deduplication
// ============================================================================

export function normalizeCompanyForKey(name: string): string {
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

export function normalizeRoleForKey(title: string): string {
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

// Compute similarity between two strings (Jaccard index on tokens)
export function computeTokenSimilarity(a: string, b: string): number {
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
export function areSameCompany(companyA: string, companyB: string): boolean {
  const normalizedA = normalizeCompanyForKey(companyA);
  const normalizedB = normalizeCompanyForKey(companyB);
  if (normalizedA === normalizedB) return true;
  // Check if one contains the other
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return true;
  // Fuzzy match with high threshold
  return computeTokenSimilarity(normalizedA, normalizedB) >= 0.8;
}

// Check if two roles are likely the same
export function areSameRole(roleA: string, roleB: string): boolean {
  const normalizedA = normalizeRoleForKey(roleA);
  const normalizedB = normalizeRoleForKey(roleB);
  if (normalizedA === normalizedB) return true;
  // Fuzzy match with moderate threshold
  return computeTokenSimilarity(normalizedA, normalizedB) >= 0.7;
}

export function isRoleCloseEnough(roleA: string, roleB: string): boolean {
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

// ============================================================================
// Canonical Key and Deduplication
// ============================================================================

export function buildCanonicalKey(input: {
  company?: string | null;
  role?: string | null;
  companyConfidence?: number | null;
  roleConfidence?: number | null;
  requisitionId?: string | null;
  jobId?: string | null;
  portalDomain?: string | null;
}): string | null {
  if (!input.company || !input.role) return null;
  // Lower threshold for canonical key to catch more duplicates.
  // Only enforce confidence thresholds when confidence is actually provided.
  if (input.companyConfidence != null && input.companyConfidence < 0.6) return null;
  if (input.roleConfidence != null && input.roleConfidence < 0.6) return null;
  const normalizedCompany = normalizeCompanyForKey(input.company);
  const normalizedRole = normalizeRoleForKey(input.role);
  if (!normalizedCompany || !normalizedRole) return null;
  // Use more specific identifiers when available
  const suffix = input.requisitionId || input.jobId || input.portalDomain || 'na';
  return `${normalizedCompany}::${normalizedRole}::${normalizeCompanyForKey(suffix) || 'na'}`;
}

// ============================================================================
// JSON Utilities
// ============================================================================

export function safeParseJson(text?: string | null): any | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function safeParseDate(input?: string | null): string | null {
  if (!input) return null;
  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}
