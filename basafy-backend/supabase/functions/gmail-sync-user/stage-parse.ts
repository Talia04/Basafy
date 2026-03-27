// Stage 2: Parse Gmail messages using heuristics + batched LLM
import { GmailMessage, ParsedEmailResult, ParsedEmailLLMResult } from './types.ts';
import { parseEmailsBatchLLM, parseEmailCombinedWithLLM } from './llm.ts';
import { buildCanonicalKey } from './utils.ts';
import { JobUtils } from './parsers.ts';

export interface ParseOpts {
    useLlm?: boolean;
}

export async function parseEmails(messages: GmailMessage[], opts: ParseOpts = {}): Promise<ParsedEmailResult[]> {
    const useLlm = opts.useLlm ?? true;
    const threadEarliestById = buildThreadEarliestMap(messages);

    // Step 1: Get all LLM results in batched API calls (one call per BATCH_SIZE emails)
    // instead of one API call per email. Falls back to safe defaults on failure.
    const llmResults = useLlm
        ? await parseEmailsBatchLLM(messages)
        : messages.map((): ParsedEmailLLMResult => ({
            is_job_related: true,
            company_name: null,
            job_title: null,
            event_type: 'other',
            status: 'Other',
            interview_date: null,
            confidence: 0.3,
            portal_domain: null,
            job_id: null,
        }));

    // Step 2: Per-email: merge LLM result with heuristics, then normalize
    const results: ParsedEmailResult[] = [];
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        try {
            const merged = parseEmailCombinedWithLLM(
                msg.subject ?? '',
                msg.from ?? '',
                msg.snippet ?? '',
                msg.bodyText ?? '',
                llmResults[i],
            );
            const normalized = normalizeParsed(merged, msg, threadEarliestById);
            if (normalized) {
                results.push(normalized);
            } else {
                console.info(`[stage-parse] Dropped non-job email: ${msg.subject}`);
            }
        } catch (err) {
            console.warn('[stage-parse] failed to parse message', {
                subject: msg.subject ?? null,
                from: msg.from ?? null,
                error: (err as Error)?.message ?? err,
            });
        }
    }

    return results;
}

function normalizeParsed(
    raw: ParsedEmailLLMResult,
    msg: GmailMessage,
    threadEarliestById: Map<string, string>,
): ParsedEmailResult | null {
    // Drop non-job emails the LLM explicitly flagged
    if (raw.is_job_related === false) {
        return null;
    }

    // Secondary noise filter: drop low-signal emails with no extractable data
    const noCompany = !raw.company_name;
    const noRole = !raw.job_title;
    const lowConfidence = (raw.confidence ?? 1) < 0.4;
    const isUnclassified = (raw.status ?? 'Other') === 'Other' || (raw.event_type ?? 'other') === 'other';
    if (noCompany && noRole && lowConfidence && isUnclassified) {
        console.info(`[stage-parse] Dropped low-signal email (no company/role, low confidence): ${msg.subject}`);
        return null;
    }

    const company = raw.company_name ?? null;
    const cleanedRole = raw.job_title ? JobUtils.cleanJobTitle(raw.job_title) : null;
    const role = cleanedRole || raw.job_title || null;
    const status = raw.status ?? 'Other';
    const eventType = raw.event_type ?? 'other';
    const interviewDate = raw.interview_date ?? null;

    const canonicalKey = buildCanonicalKey({
        company,
        role,
        companyConfidence: null,
        roleConfidence: null,
        portalDomain: raw.portal_domain ?? null,
        jobId: raw.job_id ?? null,
    });

    const receivedAt =
        msg.internalDate ||
        (msg.internalTimestamp ? new Date(msg.internalTimestamp).toISOString() : null) ||
        null;
    const threadReceivedAt = msg.threadId ? threadEarliestById.get(msg.threadId) : undefined;
    const isApplicationReceived = raw.event_type === 'application_received' || raw.status === 'Applied';
    const appliedReceivedAt = isApplicationReceived ? (threadReceivedAt ?? receivedAt) : receivedAt;


    const urlRegex = /https?:\/\/[^\s<"']+/g;
    const urls = Array.from(new Set(msg.bodyText?.match(urlRegex) || []));
    const has_ics = msg.bodyText?.includes('BEGIN:VCALENDAR') || msg.snippet?.includes('invite.ics') || false;

    let sender_type: 'ats' | 'human' | 'system' = 'human';
    const fromLower = (msg.from || '').toLowerCase();
    if (fromLower.includes('noreply') || fromLower.includes('no-reply') || fromLower.includes('donotreply')) {
        sender_type = 'system';
    }
    const atsDomains = ['greenhouse.io', 'lever.co', 'workday.com', 'icims.com', 'smartrecruiters.com', 'ashbyhq.com', 'bamboohr.com', 'workable.com'];
    if (atsDomains.some(d => fromLower.includes(d))) {
        sender_type = 'ats';
    }

    return {
        company,
        role,
        status,
        eventType,
        confidence: raw.confidence ?? 0.5,
        companyConfidence: null,
        roleConfidence: null,
        portalDomain: raw.portal_domain ?? null,
        jobId: raw.job_id ?? null,
        requisitionId: null,
        canonicalKey,
        interviewDate,
        gmailMessageId: msg.id,
        gmailThreadId: msg.threadId ?? null,
        internetMessageId: msg.internetMessageId ?? null,
        rawSubject: msg.subject ?? null,
        rawFrom: msg.from ?? null,
        rawSnippet: msg.snippet ?? null,
        receivedAt: appliedReceivedAt,
        message_features: {
            urls,
            has_ics,
            sender_type,
            company_candidates: raw.company_name ? [raw.company_name] : [],
            job_title_candidates: raw.job_title ? [raw.job_title] : [],
            job_id_candidates: raw.job_id ? [raw.job_id] : [],
        },
    };
}

function buildThreadEarliestMap(messages: GmailMessage[]) {
    const map = new Map<string, { ts: number; iso: string }>();
    for (const msg of messages) {
        if (!msg.threadId) continue;
        const ts =
            typeof msg.internalTimestamp === 'number'
                ? msg.internalTimestamp
                : msg.internalDate
                    ? new Date(msg.internalDate).getTime()
                    : null;
        if (!ts || Number.isNaN(ts)) continue;
        const existing = map.get(msg.threadId);
        if (!existing || ts < existing.ts) {
            map.set(msg.threadId, { ts, iso: new Date(ts).toISOString() });
        }
    }
    const out = new Map<string, string>();
    for (const [threadId, value] of map.entries()) {
        out.set(threadId, value.iso);
    }
    return out;
}
