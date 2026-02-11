// Stage 2: Parse Gmail messages using heuristics + LLM ensemble
import { GmailMessage, ParsedEmail } from './types';
import { parseEmailCombined } from './llm';

export interface ParseOpts {
    concurrency?: number;
}

export async function parseEmails(messages: GmailMessage[], opts: ParseOpts = {}): Promise<ParsedEmail[]> {
    const concurrency = opts.concurrency ?? 5;
    const results: ParsedEmail[] = [];
    let idx = 0;

    // Simple concurrency-limited parallelism
    async function worker() {
        while (idx < messages.length) {
            const i = idx++;
            try {
                const parsed = await parseEmailCombined(messages[i]);
                results[i] = parsed;
            } catch (err) {
                results[i] = null;
            }
        }
    }

    await Promise.all(Array(concurrency).fill(0).map(() => worker()));
    return results.filter(Boolean);
}
