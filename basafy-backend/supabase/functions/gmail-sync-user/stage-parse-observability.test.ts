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

Deno.test('heuristic-only parsing excludes weak generic platform messages', async () => {
    const message: GmailMessage = {
        id: 'message-noise',
        subject: 'Your candidate profile is ready',
        from: 'Workday <no-reply@myworkday.com>',
        snippet: 'Complete your profile to improve job recommendations.',
        internalDate: '2026-07-01T12:00:00.000Z',
    };
    const decisions: EmailProcessingDecision[] = [];

    const parsed = await parseEmails([message], {
        useLlm: false,
        onDecision: (decision) => decisions.push(decision),
    });

    assert(parsed.length === 0, 'Expected weak generic platform mail to be excluded.');
    assert(decisions.length === 1, 'Expected one processing decision.');
    assert(decisions[0].relevanceDecision === 'excluded_not_job_related', 'Expected a not-job-related decision.');
    assert(
        decisions[0].parserDiagnostics?.classificationSource === 'heuristic_rejected_low_evidence',
        'Expected low-evidence heuristic rejection to be recorded.',
    );
});
