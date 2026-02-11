// Stage 2: Parse Gmail messages using heuristics + LLM ensemble
import { GmailMessage, ParsedEmailResult } from './types';
import { parseEmailCombined } from './llm';

export interface ParseOpts {
    concurrency?: number;
}

export async function parseEmails(messages: GmailMessage[], opts: ParseOpts = {}): Promise<ParsedEmailResult[]> {
    const concurrency = opts.concurrency ?? 5;
    const threads = new Map<string, GmailMessage[]>();
    for (const msg of messages) {
        const threadId = msg.threadId || 'unknown';
        if (!threads.has(threadId)) threads.set(threadId, []);
        threads.get(threadId)?.push(msg);
    }

    // Parse each thread as a unit
    const threadResults: ParsedEmailResult[] = [];
    for (const msgs of threads.values()) {
        // Sort by internalDate
        msgs.sort((a, b) => {
            const aDate = a.internalDate ? new Date(a.internalDate).getTime() : 0;
            const bDate = b.internalDate ? new Date(b.internalDate).getTime() : 0;
            return aDate - bDate;
        });
        for (const msg of msgs) {
            try {
                // parseEmailCombined expects subject, from, snippet, bodyText, threadId
                const parsed = await parseEmailCombined(
                    msg.subject ?? '',
                    msg.from ?? '',
                    msg.snippet ?? '',
                    msg.bodyText ?? '',
                    true
                );
                threadResults.push(parsed);
            } catch (err) {
                threadResults.push(null as any);
            }
        }
    }
    return threadResults.filter(Boolean);
}
