// Email parsing utilities - company, role, status extraction

import { STATUS_PRIORITY, COMPANY_MIN_SCORE, PREFERRED_PORTAL_DOMAINS, ATS_DOMAINS } from './constants.ts';
import { logParseError } from './utils.ts';
import type { ExtractionSource, ExtractionResult, ApplicationStatus } from './types.ts';
import {
    normalizeText,
    capitalizeFirstLetter,
    looksLikeUrl,
    isAtsName,
    detectPlatform,
} from './utils.ts';

// ============================================================================
// Status Detection
// ============================================================================

export function normalizeStatus(input?: string | null): ApplicationStatus {
    if (!input) return null;
    const normalized = input.toLowerCase();
    // More robust status detection
    if (/\boffer(ed| letter)?\b|pleased to offer|congratulations|excited to offer/i.test(normalized)) return 'Offer';
    if (/\binterview|phone screen|schedule.*interview|video (interview|call)|onsite|on-site|final round|panel interview|move(d| you)? forward|advancing (you|your)/i.test(normalized)) return 'Interview';
    if (/assessment|challenge|test|codesignal|hackerrank|hirevue|codility|hackerearth|leetcode|skills (test|assessment)/i.test(normalized)) return 'Assessment';
    if (/reject|not moving forward|unfortunately|regret to inform|declined|not selected|not a (good )?fit|decided to go with another|not able to offer|unable to offer|cannot offer|not selected for (an )?interview|not moving forward with (you|your candidacy)/i.test(normalized)) return 'Rejected';
    if (/review|applied|application received|thank you for applying|we received your application|received your (application|resume|cv)|application (has been |was )?submitted|successfully (submitted|applied)|confirm(ing|ed)? (your )?application|reviewing (your )?(application|profile|resume|cv)/i.test(normalized)) return 'Applied';
    if (normalized.includes('other')) return 'Other';
    return null;
}

export function pickHigherStatus(...statuses: Array<string | null | undefined>): ApplicationStatus {
    let best: ApplicationStatus = null;
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

export function determineStatusHeuristic(
    subject?: string | null,
    body?: string | null,
    snippet?: string | null
): ApplicationStatus {
    const text = `${normalizeText(subject)} ${normalizeText(body)} ${normalizeText(snippet)}`.toLowerCase();
    if (!text) return null;

    // Offer patterns (high confidence)
    const offerPatterns = [
        /\b(pleased to offer|we('d| would) like to (extend|offer)|job offer|offer letter|congratulations|excited to offer)\b/i,
        /\b(we are excited to offer|delighted to offer|happy to offer)\b/i,
        /\b(extending (you )?an offer|formal offer)\b/i,
    ];
    if (offerPatterns.some(p => p.test(text))) return 'Offer';

    // Rejection patterns - made more specific to avoid false positives
    const rejectionPatterns = [
        /\b(not moving forward|unfortunately.*not|regret to inform|your application.*declined|not selected|not a (good )?fit|decided to go with another|not able to offer|unable to offer|cannot offer|not selected for (an )?interview|not moving forward with (you|your candidacy))\b/i,
        /\b(decided (to )?(not )?proceed|not (be )?proceeding|won't be moving forward)\b/i,
        /\b(pursuing other candidates|moved forward with other|chosen (to )?not)\b/i,
        /\b(position (has been |was )?filled|filled (the )?position)\b/i,
        /\b(will not be (advancing|continuing|extending)|not selected)\b/i,
        /\b(not a (good )?fit (at this time|for this role))\b/i,
        /\b(we (have|'ve) decided to go with another|decided to go in a different direction)\b/i,
        /\b(not able to offer (you )?an? interview|unable to offer (you )?an? interview|cannot offer (you )?an? interview)\b/i,
        /\b(not selected for (an )?interview|not selected to interview)\b/i,
        /\b(will not be moving (you|your candidacy) forward)\b/i,
        /\b(not moving forward with (you|your candidacy))\b/i,
    ];
    if (rejectionPatterns.some(p => p.test(text))) return 'Rejected';

    // Interview patterns
    // e.g. "decided to move forward with your candidacy" is positive
    const interviewPatterns = [
        /\b(interview|phone screen|schedule.*interview|availability.*interview|call scheduled|calendar invite|meeting link|zoom|teams|google meet|invite to interview)\b/i,
        /\b(video (interview|call)|zoom (call|meeting)|teams (call|meeting))\b/i,
        /\b(technical (interview|screen)|hiring manager (call|chat|interview))\b/i,
        /\b(onsite|on-site|final round|panel interview)\b/i,
        /\b(move(d| you)? forward|advancing (you|your))/i,
        /\b(schedule (a |some )?time|book (a )?time|pick (a )?time)\b/i,
        /\b(goodtime\.io|calendly\.com|doodle|youcanbook)\b/i,
        /\b(recruiter (call|chat)|introductory (call|chat))\b/i,
        /\b(next (step|stage) in (the |our )?process)\b/i,
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
        /\b(application received|thank you for applying|we received your application|application confirmation|successfully submitted|successfully applied|confirm(ing|ed)? (your )?application|reviewing (your )?(application|profile|resume|cv))\b/i,
        /\b(applied|in review|under (review|consideration))\b/i,
        /\b(received your (application|resume|cv)|application (has been |was )?submitted)\b/i,
    ];
    if (appliedPatterns.some(p => p.test(text))) return 'Applied';

    return null;
}

export function statusFromEventType(eventType?: string | null): ApplicationStatus {
    if (!eventType) return null;
    if (eventType === 'rejection') return 'Rejected';
    if (eventType === 'offer') return 'Offer';
    if (eventType === 'interview_invite') return 'Interview';
    if (eventType === 'assessment') return 'Assessment';
    if (eventType === 'application_received') return 'Applied';
    return null;
}

// ============================================================================
// Company Extraction
// ============================================================================

export const CompanyUtils = {
    isLikelyNotCompany(text: string) {
        const raw = text.trim();
        const normalized = raw.toLowerCase();
        if (!normalized) return true;
        if (looksLikeUrl(normalized)) return true;
        if (isAtsName(normalized)) return true;
        if (raw.length <= 2 && !/^[A-Z0-9]+$/.test(raw)) return true;
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
        const stopWords = new Set([
            'we',
            'you',
            'your',
            'yours',
            'our',
            'ours',
            'us',
            'i',
            'me',
            'my',
            'mine',
            'the',
            'a',
            'an',
            'and',
            'or',
            'hi',
            'hello',
            'thanks',
            'thank',
            'regards',
            'sincerely',
            'best',
            'team',
            'recruiting',
            'talent',
            'careers',
            'jobs',
            'job',
            'application',
            'applicant',
            'candidate',
            'position',
            'role',
            'opportunity',
            'interview',
            'assessment',
            'offer',
            'update',
            'notification',
            'message',
        ]);
        if (stopWords.has(normalized)) return true;
        const tokens = normalized.split(/\s+/).filter(Boolean);
        if (tokens.length > 0 && tokens.every((token) => stopWords.has(token) || token.length <= 2)) {
            return true;
        }
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
            .replace(/["'']/g, '')
            .replace(/^(mail|us|eu|talent|jobs|careers)\./i, '')
            .trim();
        cleaned = cleaned.replace(/^(the)\s+/i, '').trim();
        cleaned = cleaned
            .replace(/\b(inc|inc\.|llc|ltd|ltd\.|corp|corp\.|corporation|company)\b\.?$/i, '')
            .replace(/\b(careers|jobs|recruiting|talent acquisition|talent|hiring)\b\.?$/i, '')
            .trim();
        return cleaned || null;
    },

    extractCompanyCandidatesFromSentence(
        sentence: string,
        score: number,
        addCandidate: (value: string, score: number, source: ExtractionSource) => void
    ) {
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

    extractCompany(
        subject?: string | null,
        body?: string | null,
        from?: string | null,
        snippet?: string | null
    ): ExtractionResult {
        const subjectText = normalizeText(subject);
        const bodyText = normalizeText(body);
        const snippetText = normalizeText(snippet);
        const candidates: Array<{ value: string; score: number; source: ExtractionSource }> = [];

        const addCandidate = (value: string, score: number, source: ExtractionSource) => {
            // Domain-based company detection
            if (from) {
                const domainMatch = from.match(/@([\w.-]+)\b/);
                if (domainMatch) {
                    const domain = domainMatch[1].replace(/^www\./, '').toLowerCase();
                    // If domain is not in ATS_DOMAINS and not a generic email provider, treat as company
                    if (!ATS_DOMAINS.includes(domain) && !['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'].includes(domain)) {
                        candidates.push({ value: domain.split('.')[0], score: 3, source: 'domain' });
                    }
                }
            }
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
            /new message from ([A-Za-z0-9\s&,-]+){1,50}/i,
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
            logParseError('No company candidates found', { subject, body, from, snippet });
            return { value: null, source: null };
        }
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        if (best.score < COMPANY_MIN_SCORE) {
            logParseError('Company candidate score below threshold', { best, subject, body, from, snippet });
            return { value: null, source: null };
        }
        return { value: capitalizeFirstLetter(best.value), source: best.source };
    },
};

// ============================================================================
// Job Title Extraction
// ============================================================================

export const JobUtils = {
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

    extractJobTitle(
        subject?: string | null,
        body?: string | null,
        from?: string | null,
        snippet?: string | null
    ): ExtractionResult {
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
            logParseError('No job title candidates found', { subject, body, from, snippet });
            return { value: null, source: null };
        }
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        return { value: best.value, source: best.source };
    },
};

// ============================================================================
// Portal Domain and Job ID Extraction
// ============================================================================

export function extractPortalDomain(urls: string[]): string | null {
    if (!urls || urls.length === 0) return null;

    for (const raw of urls) {
        try {
            const parsed = new URL(raw);
            const host = parsed.hostname.toLowerCase();
            const lowerPath = parsed.pathname.toLowerCase();

            // Workday - extract company subdomain
            if (host.endsWith('myworkdayjobs.com') || host.endsWith('myworkday.com')) {
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

            if (PREFERRED_PORTAL_DOMAINS.some((domain) => host.includes(domain))) {
                return host;
            }
        } catch {
            continue;
        }
    }
    return null;
}

export function extractJobIdFromUrls(urls: string[]): string | null {
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

// ============================================================================
// Derived Extraction Functions
// ============================================================================

export function deriveCompany(
    from?: string | null,
    subject?: string | null,
    snippet?: string | null,
    body?: string | null
): string | null {
    const result = CompanyUtils.extractCompany(subject, body, from, snippet);
    return result.value;
}

export function deriveRole(
    subject?: string | null,
    from?: string | null,
    snippet?: string | null,
    body?: string | null
): string | null {
    const result = JobUtils.extractJobTitle(subject, body, from, snippet);
    return JobUtils.cleanJobTitle(result.value) || result.value;
}

export function classifyJobEmailEvent(
    subject: string | null | undefined,
    from: string | null | undefined,
    snippet?: string | null,
    body?: string | null
): { event_type: string; confidence: number } {
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

export async function parseCompanyAndRole(
    subject: string | null | undefined,
    from: string | null | undefined,
    snippet?: string | null,
    body?: string | null
): Promise<{
    parsed_company: string | null;
    parsed_role: string | null;
    confidence: number;
}> {
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
