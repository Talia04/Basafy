import { parseEmails } from './stage-parse.ts';
import type { EmailProcessingDecision, GmailMessage } from './types.ts';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

Deno.test('parse observability reports one decision without changing output', async () => {
    const message: GmailMessage = {
        id: 'message-1',
        threadId: 'thread-1',
        subject: 'Interview Request: Software Engineer at Stripe',
        from: 'Recruiting <recruiting@stripe.com>',
        snippet: 'We would like to schedule your interview for the Software Engineer role.',
        internalDate: '2026-07-01T12:00:00.000Z',
    };
    const decisions: EmailProcessingDecision[] = [];

    const parsed = await parseEmails([message], {
        useLlm: false,
        onDecision: (decision) => decisions.push(decision),
    });

    assert(parsed.length === 1, 'Expected the existing parser to return one result.');
    assert(decisions.length === 1, 'Expected exactly one processing decision.');
    assert(decisions[0].relevanceDecision === 'included', 'Expected an included decision.');
    assert(decisions[0].parsed === parsed[0], 'Expected the audit decision to reference the unchanged parser result.');
    assert(decisions[0].message.id === message.id, 'Expected the source message ID in the audit decision.');
    assert(decisions[0].parserDiagnostics?.classificationSource === 'heuristic_fallback', 'Expected the parser source to be preserved.');
    assert(decisions[0].parserDiagnostics?.heuristicResult !== null, 'Expected heuristic evidence to be preserved.');
});
