// Stage 2: Parse Gmail messages using heuristics + LLM ensemble
import { GmailMessage, ParsedEmailResult, ParsedEmailLLMResult } from './types';
import { parseEmailCombined } from './llm';
import { buildCanonicalKey } from './utils';
import { JobUtils } from './parsers';

export interface ParseOpts {
    concurrency?: number;
    useLlm?: boolean;
}

export async function parseEmails(messages: GmailMessage[], opts: ParseOpts = {}): Promise<ParsedEmailResult[]> {
    const concurrency = Math.max(1, opts.concurrency ?? 5);
    const useLlm = opts.useLlm ?? true;
    const threads = new Map<string, GmailMessage[]>();
    for (const msg of messages) {
        const threadId = msg.threadId || 'unknown';
        if (!threads.has(threadId)) threads.set(threadId, []);
        threads.get(threadId)?.push(msg);
    }

    const threadEntries = Array.from(threads.values());

    const normalizeParsed = (raw: ParsedEmailLLMResult, msg: GmailMessage): ParsedEmailResult => {
        const company = raw.company_name ?? null;
        const cleanedRole = raw.job_title ? JobUtils.cleanJobTitle(raw.job_title) : null;
        const role = cleanedRole || raw.job_title || null;
        const status = raw.status ?? 'Other';
        const eventType = raw.event_type ?? 'other';
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
            gmailMessageId: msg.id,
            gmailThreadId: msg.threadId ?? null,
            internetMessageId: msg.internetMessageId ?? null,
            rawSubject: msg.subject ?? null,
            rawFrom: msg.from ?? null,
            rawSnippet: msg.snippet ?? null,
            receivedAt,
        };
    };

    const results: ParsedEmailResult[] = [];
    let index = 0;

    const worker = async () => {
        while (index < threadEntries.length) {
            const current = threadEntries[index];
            index += 1;
            if (!current) continue;
            current.sort((a, b) => {
                const aDate = a.internalDate ? new Date(a.internalDate).getTime() : 0;
                const bDate = b.internalDate ? new Date(b.internalDate).getTime() : 0;
                return aDate - bDate;
            });
            for (const msg of current) {
                try {
                    const parsed = await parseEmailCombined(
                        msg.subject ?? '',
                        msg.from ?? '',
                        msg.snippet ?? '',
                        msg.bodyText ?? '',
                        useLlm
                    );
                    results.push(normalizeParsed(parsed, msg));
                } catch {
                    // skip failures
                }
            }
        }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
}
