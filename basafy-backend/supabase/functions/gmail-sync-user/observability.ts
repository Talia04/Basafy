import type { ApplicationMatchDecision, EmailProcessingDecision } from './types.ts';

export interface ProcessingDebugSummary {
    syncRunId: string;
    recorded: number;
    included: number;
    excluded: number;
    parseErrors: number;
}

export async function createSyncRun(options: {
    admin: any;
    id: string;
    userId: string;
    legacySyncLogId?: number | null;
    syncType: string;
    lightSync: boolean;
    useLlm: boolean;
    fetchFull: boolean;
    messagesRequested: number;
}) {
    const { error } = await options.admin.from('gmail_sync_runs').insert({
        id: options.id,
        user_id: options.userId,
        legacy_sync_log_id: options.legacySyncLogId ?? null,
        sync_type: options.syncType,
        light_sync: options.lightSync,
        use_llm: options.useLlm,
        fetch_full: options.fetchFull,
        status: 'running',
        messages_requested: options.messagesRequested,
    });
    if (error) throw error;
}

export async function completeSyncRun(options: {
    admin: any;
    id: string;
    status: 'success' | 'error';
    messagesFetched: number;
    messagesProcessed: number;
    messagesKept: number;
    messagesDiscarded: number;
    applicationsCreated: number;
    applicationsUpdated: number;
    eventsCreated: number;
    errors?: unknown[];
}) {
    const { error } = await options.admin.from('gmail_sync_runs').update({
        completed_at: new Date().toISOString(),
        status: options.status,
        messages_fetched: options.messagesFetched,
        messages_processed: options.messagesProcessed,
        messages_kept: options.messagesKept,
        messages_discarded: options.messagesDiscarded,
        applications_created: options.applicationsCreated,
        applications_updated: options.applicationsUpdated,
        events_created: options.eventsCreated,
        errors: options.errors ?? [],
    }).eq('id', options.id);
    if (error) throw error;
}

export async function recordProcessingEvidence(options: {
    admin: any;
    userId: string;
    syncRunId: string;
    query: string;
    queryBucket?: string;
    bucketQueries?: Record<string, string>;
    fullMessageIds?: ReadonlySet<string>;
    decisions: EmailProcessingDecision[];
    matchDecisions: ApplicationMatchDecision[];
}): Promise<ProcessingDebugSummary> {
    const included = options.decisions.filter((item) => item.relevanceDecision === 'included').length;
    const parseErrors = options.decisions.filter((item) => item.relevanceDecision === 'parse_error').length;
    const summary = {
        syncRunId: options.syncRunId,
        recorded: 0,
        included,
        excluded: options.decisions.length - included - parseErrors,
        parseErrors,
    };
    if (options.decisions.length === 0) return summary;

    const retrievalRows = options.decisions.flatMap((item) => {
      const matchedBuckets = item.message.matchedQueryBuckets?.length
        ? item.message.matchedQueryBuckets
        : [options.queryBucket ?? 'combined_job_search'];
      return matchedBuckets.map((bucket) => ({
        user_id: options.userId,
        sync_run_id: options.syncRunId,
        gmail_message_id: item.message.id,
        gmail_thread_id: item.message.threadId ?? null,
        query_bucket: bucket,
        query_string: options.bucketQueries?.[bucket] ?? options.query,
        sender: item.message.from ?? null,
        sender_domain: extractSenderDomain(item.message.from),
        subject: item.message.subject ?? null,
        snippet: item.message.snippet?.slice(0, 1000) ?? null,
        gmail_date: messageDate(item.message),
        has_full_body: options.fullMessageIds?.has(item.message.id) ?? false,
        matched_query_buckets: matchedBuckets,
        platform_email_type: item.message.platformEmailType ?? 'unknown',
      }));
    });
    const parseRows = options.decisions.map((item) => {
      const modelEvidence = item.parserDiagnostics?.rawLlmResult?.evidence;
      const evidence = Array.isArray(modelEvidence)
        ? modelEvidence.filter((value): value is string => typeof value === 'string')
        : [item.message.subject, item.message.snippet].filter((value): value is string => Boolean(value));
      return ({
        user_id: options.userId,
        sync_run_id: options.syncRunId,
        gmail_message_id: item.message.id,
        parser_version: 'gmail-parser-v2-observed',
        classification_source: item.parserDiagnostics?.classificationSource ?? 'fallback',
        heuristic_result: item.parserDiagnostics?.heuristicResult ?? null,
        llm_result: item.parserDiagnostics?.rawLlmResult ?? null,
        final_decision: item.relevanceDecision,
        event_type: item.parsed?.eventType ?? null,
        company_name: item.parsed?.company ?? null,
        role_title: item.parsed?.role ?? null,
        confidence: item.parsed?.confidence ?? null,
        evidence_snippets: evidence.map((text) => text.slice(0, 500)),
        failure_reason: item.relevanceDecision === 'included' ? null : item.decisionReason,
      });
    });
    const matchRows = options.matchDecisions.map((item) => ({
        user_id: options.userId,
        sync_run_id: options.syncRunId,
        gmail_message_id: item.gmailMessageId,
        matched_application_id: item.matchedApplicationId,
        match_type: item.matchType,
        match_score: item.matchScore,
        company_score: item.companyScore,
        role_score: item.roleScore,
        thread_score: item.threadScore,
        domain_score: item.domainScore,
        timeline_score: item.timelineScore,
        decision: item.decision,
        reason: item.reason,
        candidate_application_ids: item.candidateApplicationIds,
    }));

    const writes = [
        options.admin.from('gmail_retrieval_evidence').upsert(retrievalRows, { onConflict: 'sync_run_id,gmail_message_id,query_bucket' }),
        options.admin.from('email_parse_attempts').upsert(parseRows, { onConflict: 'sync_run_id,gmail_message_id' }),
        matchRows.length
            ? options.admin.from('gmail_match_decisions').upsert(matchRows, { onConflict: 'sync_run_id,gmail_message_id' })
            : Promise.resolve({ error: null }),
    ];
    const results = await Promise.all(writes);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    summary.recorded = options.decisions.length;
    return summary;
}

function extractSenderDomain(from?: string | null) {
    if (!from) return null;
    return from.match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase() ?? null;
}

function messageDate(message: EmailProcessingDecision['message']) {
    if (message.internalDate) return message.internalDate;
    if (message.internalTimestamp) return new Date(message.internalTimestamp).toISOString();
    return null;
}
