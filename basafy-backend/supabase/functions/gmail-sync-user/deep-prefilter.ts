import type { EmailProcessingDecision, GmailMessage } from './types.ts';

export function prefilterDeepSyncMessages(messages: GmailMessage[]): {
    candidates: GmailMessage[];
    decisions: EmailProcessingDecision[];
} {
    const candidates: GmailMessage[] = [];
    const decisions: EmailProcessingDecision[] = [];

    for (const message of messages) {
        const text = `${message.subject ?? ''} ${message.snippet ?? ''}`.toLowerCase();
        const hasConcreteJobSignal = /thank you for applying|application (?:was |has been )?(?:received|submitted)|we received your application|your application for|interview (?:invitation|request|scheduled)|invite you to (?:an? )?interview|schedule (?:an? )?(?:phone|video|technical|onsite )?interview|coding (?:assessment|challenge|test)|complete (?:the|this|your|an?) assessment|not moving forward with (?:your application|your candidacy|you)|offer letter|pleased to offer you/.test(text);
        const isAccountOrSecurityNoise = /password reset|reset your password|verify your account|confirm your email|verification code|security code|sign[ -]?in code|new sign[ -]?in|security alert|password (?:was )?changed|activate your account|account setup|complete your profile|candidate profile (?:is )?(?:ready|complete)|privacy policy|terms of service/.test(text);
        const isGenericPlatformNoise = /who viewed your profile|new connection request|people you may know|grow your network|weekly digest|newsletter|jobs you may like|recommended jobs|new jobs for you|job recommendations/.test(text);
        const reason = message.platformEmailType === 'job_alert_noise'
            ? 'Platform metadata identifies a generic job alert or recommendation digest.'
            : isAccountOrSecurityNoise && !hasConcreteJobSignal
                ? 'Message is an account or identity notification, not application activity.'
                : isGenericPlatformNoise && !hasConcreteJobSignal
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
