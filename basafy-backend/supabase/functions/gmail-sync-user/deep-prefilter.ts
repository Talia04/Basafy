import type { EmailProcessingDecision, GmailMessage } from './types.ts';

export function prefilterDeepSyncMessages(messages: GmailMessage[]): {
    candidates: GmailMessage[];
    decisions: EmailProcessingDecision[];
} {
    const candidates: GmailMessage[] = [];
    const decisions: EmailProcessingDecision[] = [];

    for (const message of messages) {
        const text = `${message.subject ?? ''} ${message.snippet ?? ''}`.toLowerCase();
        const hasConcreteJobSignal = /application|interview|assessment|coding challenge|technical screen|recruiter|offer|candidate/.test(text);
        const reason = message.platformEmailType === 'job_alert_noise'
            ? 'Platform metadata identifies a generic job alert or recommendation digest.'
            : /password reset|reset your password|verify your account|confirm your email/.test(text) && !hasConcreteJobSignal
                ? 'Message is an account or identity notification, not application activity.'
                : /weekly digest|newsletter|jobs you may like|recommended jobs|new jobs for you/.test(text)
                    ? 'Message is a generic newsletter or job recommendation digest.'
                    : null;

        if (!reason) {
            candidates.push(message);
            continue;
        }

        decisions.push({
            message,
            relevanceDecision: 'excluded_not_job_related',
            decisionReason: reason,
            parsed: null,
            parserDiagnostics: {
                llmAvailable: false,
                rawLlmResult: null,
                heuristicResult: { platform_email_type: message.platformEmailType ?? 'unknown' },
                classificationSource: 'deterministic_prefilter',
            },
        });
    }

    return { candidates, decisions };
}
