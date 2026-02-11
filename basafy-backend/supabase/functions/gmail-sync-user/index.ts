/* @ts-ignore
   VSCode/TypeScript may show errors for remote imports and Deno global.
   These are expected for Deno edge functions and do not affect runtime.
*/
// Edge function: Gmail sync entry point - Refactored modular version
// @ts-ignore
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

// Import from modules
import type { GmailConnection, GmailMessage } from './types.ts';
import {
    BATCH_SIZE,
    MAX_CONCURRENT_BATCHES,
    TIME_BUDGET_MS,
    LLM_MIN_TIME_REMAINING_MS,
    PHASE1_LOOKBACK_DAYS,
    DEEP_SYNC_MAX_MESSAGES_PER_RUN,
    DEEP_SYNC_TOTAL_LIMIT,
    COMPANY_MIN_SCORE,
} from './constants.ts';
import {
    normalizeText,
    capitalizeFirstLetter,
    stripQuotedReplies,
    buildTopLines,
    extractUrlsFromText,
    normalizeCompanyForKey,
    normalizeRoleForKey,
    buildCanonicalKey,
    computeTokenSimilarity,
    areSameCompany,
    areSameRole,
    isAtsName,
    detectPlatform,
    extractPlainText,
} from './utils.ts';
import {
    getAccessToken,
    exchangeAuthCodeForTokens,
    listMessages,
    fetchMessageMetadata,
    fetchMessageFull,
    fetchMessagesParallel,
} from './gmail-api.ts';
import { buildOptimizedGmailQuery } from './query-builder.ts';
import {
    normalizeStatus,
    pickHigherStatus,
    determineStatusHeuristic,
    statusFromEventType,
    CompanyUtils,
    JobUtils,
    extractPortalDomain,
    extractJobIdFromUrls,
    deriveCompany,
    deriveRole,
    classifyJobEmailEvent,
    parseCompanyAndRole,
} from './parsers.ts';
import {
    PROMPT_A_SYSTEM,
    PROMPT_B_SYSTEM,
    buildPromptAInput,
    buildPromptBInput,
    callOpenAI,
    callOpenAIRaw,
    parseEmailWithLLM,
    parseEmailCombined,
} from './llm.ts';
import {
    validateSyncRequest,
    sanitizeForLog,
    type ValidatedSyncParams,
} from './validation.ts';
import {
    checkMultipleRateLimits,
    getRateLimitConfigs,
    buildRateLimitHeaders,
    formatRateLimitError,
} from './rate-limit.ts';

import {
    getSupabaseUrl,
    getSupabaseAnonKey,
    getSupabaseServiceRoleKey,
} from '../_shared/secrets.ts';
import {
    createLogger,
    generateRequestId,
} from '../_shared/logger.ts';

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const SUPABASE_SERVICE_ROLE_KEY = getSupabaseServiceRoleKey();

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function safeParseJson(text?: string | null): any | null {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function isJobRelatedFromPrompt(result: any): boolean {
    if (!result) return false;
    if (typeof result.is_job_related === 'boolean') return result.is_job_related;
    if (typeof result.job_related_confidence === 'number') return result.job_related_confidence >= 0.5;
    // Prompt A/B schemas don't include is_job_related — infer from event_type/status.
    // If the LLM found a company or meaningful event type, it's job-related.
    if (result.event_type && result.event_type !== 'other') return true;
    if (result.company_name) return true;
    if (result.job_title) return true;
    if (result.status && result.status !== 'Other') return true;
    // Even if the LLM returned all nulls, we already pre-filtered via Gmail query,
    // so default to true to avoid dropping messages silently.
    return true;
}

function mapEventTypeFromPrompt(value?: string | null): string | null {
    if (!value) return null;
    switch (value) {
        case 'APPLICATION_CONFIRMATION':
            return 'application_received';
        case 'INTERVIEW_REQUEST':
            return 'interview_invite';
        case 'ASSESSMENT_INVITE':
            return 'assessment';
        case 'REJECTION':
            return 'rejection';
        case 'OFFER':
            return 'offer';
        case 'RECRUITER_OUTREACH':
        case 'UPDATE':
        case 'OTHER':
        default:
            return 'other';
    }
}

function mapStatusFromPrompt(value?: string | null): string | null {
    if (!value) return null;
    switch (value) {
        case 'APPLIED':
            return 'Applied';
        case 'IN_REVIEW':
            return 'Applied';
        case 'INTERVIEWING':
            return 'Interview';
        case 'ASSESSMENT':
            return 'Assessment';
        case 'REJECTED':
            return 'Rejected';
        case 'OFFER':
            return 'Offer';
        default:
            return null;
    }
}

function safeParseDate(input?: string | null): string | null {
    if (!input) return null;
    const parsed = Date.parse(input);
    if (Number.isNaN(parsed)) return null;
    return new Date(parsed).toISOString();
}

// ============================================================================
// Main Serve Handler
// ============================================================================

serve(async (req: Request) => {
    try {
        if (req.method === 'OPTIONS') {
            return new Response('ok', { headers: JSON_HEADERS });
        }
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
            return jsonResponse({ error: 'Service misconfigured' }, 500);
        }

        const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
        if (!token) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: {
                headers: { Authorization: `Bearer ${token}` },
            },
        });

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Parse and validate request body
        const rawBody = await req.json().catch(() => ({}));
        const validationResult = validateSyncRequest(rawBody, user.email ?? null);

        if (!validationResult.success) {
            console.warn('gmail-sync-user invalid request', {
                user_id: user.id,
                error: validationResult.error,
            });
            return jsonResponse({ error: validationResult.error }, 400);
        }

        const params = validationResult.data;

        // ── Rate Limiting ─────────────────────────────────────────────────
        const rateLimitConfigs = getRateLimitConfigs(params);
        const rateLimitResult = await checkMultipleRateLimits(
            admin,
            user.id,
            rateLimitConfigs
        );

        if (!rateLimitResult.allowed) {
            console.warn('gmail-sync-user rate limit exceeded', {
                user_id: user.id,
                limit_name: rateLimitResult.limitName,
                remaining: rateLimitResult.remaining,
                reset_at: rateLimitResult.resetAt,
            });
            return new Response(
                JSON.stringify({
                    error: formatRateLimitError(rateLimitResult),
                    rate_limit: {
                        limit: rateLimitResult.limit,
                        remaining: rateLimitResult.remaining,
                        reset_at: rateLimitResult.resetAt,
                    },
                }),
                {
                    status: 429,
                    headers: {
                        ...JSON_HEADERS,
                        ...buildRateLimitHeaders(rateLimitResult),
                    },
                }
            );
        }
        // ──────────────────────────────────────────────────────────────────

        let incomingRefresh = params.refreshToken;
        const incomingEmail = params.email;
        const incomingServerAuthCode = params.serverAuthCode;
        const hardSync = params.hardSync;
        const lightSync = params.lightSync;
        const lookbackMonths = params.lookbackMonths;
        const enrichOnly = params.enrichOnly;
        const pageTokenFromClient = params.pageToken;
        const seedOnly = params.seedOnly;
        const maxMessages = params.maxMessages;
        const syncStartMs = Date.now();
        const LLM_MAX_PER_SYNC = enrichOnly ? 40 : hardSync ? 30 : 30;
        let llmCalls = 0;
        let fullFetches = 0;
        const FULL_FETCH_MAX = enrichOnly ? 50 : hardSync ? 40 : 40;
        let syncType: "full" | "incremental" | "enrich" = hardSync ? 'full' : 'incremental';

        const writeSyncLogError = async (message: string) => {
            if (seedOnly) return;
            const payload: Record<string, unknown> = {
                user_id: user.id,
                status: 'error',
                error_message: message,
                started_at: new Date().toISOString(),
                finished_at: new Date().toISOString(),
                sync_type: syncType,
                messages_processed: 0,
            };
            const { error: logError } = await admin.from('gmail_sync_logs').insert([payload]);
            if (logError) {
                console.error('gmail-sync-user failed to write error sync log', logError);
            }
        };

        if (!incomingRefresh && incomingServerAuthCode) {
            try {
                const tokenData = await exchangeAuthCodeForTokens(incomingServerAuthCode);
                incomingRefresh = tokenData.refresh_token || null;
            } catch (exchangeErr: any) {
                console.error('gmail-sync-user failed to exchange auth code', exchangeErr);
                await writeSyncLogError(exchangeErr?.message || 'Unable to exchange Google auth code');
                return jsonResponse({ error: exchangeErr?.message || 'Unable to exchange Google auth code' }, 500);
            }
        }

        const { data: connectionData, error: connError } = await admin
            .from('gmail_connections')
            .select('id,user_id,email,refresh_token,provider,last_synced_at,backfill_page_token,backfill_started_at,backfill_completed_at,backfill_total_estimate,backfill_processed_count')
            .eq('user_id', user.id)
            .eq('provider', 'google')
            .maybeSingle();
        let connection = connectionData as (GmailConnection & { last_synced_at?: string | null }) | null;

        if (connError) {
            await writeSyncLogError(connError.message || 'Unable to read Gmail connection');
            return jsonResponse({ error: connError.message }, 500);
        }

        if (!connection) {
            const { data: anyConn, error: anyErr } = await admin
                .from('gmail_connections')
                .select('id,user_id,email,refresh_token,provider,backfill_page_token,backfill_started_at,backfill_completed_at,backfill_total_estimate,backfill_processed_count')
                .eq('user_id', user.id)
                .maybeSingle();
            if (!anyErr && anyConn) {
                connection = anyConn as GmailConnection;
                console.warn('gmail-sync-user provider mismatch, using available connection', {
                    user_id: user.id,
                    provider: connection?.provider,
                });
            }
        }

        if (!connection && incomingRefresh) {
            const { error: seedError } = await admin.from('gmail_connections').insert({
                user_id: user.id,
                provider: 'google',
                email: incomingEmail,
                refresh_token: incomingRefresh,
            });
            if (seedError) {
                console.error('gmail-sync-user failed to seed connection', seedError);
            } else {
                const { data: seeded } = await admin
                    .from('gmail_connections')
                    .select('user_id,email,refresh_token,provider')
                    .eq('user_id', user.id)
                    .maybeSingle();
                connection = seeded as GmailConnection | null;
                console.log('gmail-sync-user seeded connection from request body', {
                    user_id: user.id,
                    provider: connection?.provider,
                    has_refresh_token: !!connection?.refresh_token,
                });
            }
        }

        if (!connection) {
            if (seedOnly && !incomingRefresh) {
                return jsonResponse({
                    ok: true,
                    seed_only: true,
                    has_refresh_token: false,
                    provider: 'google',
                    email: incomingEmail ?? user.email,
                });
            }
            console.warn('gmail-sync-user no connection found', { user_id: user.id });
            await writeSyncLogError('No Gmail connection found for user');
            return jsonResponse({ error: 'No Gmail connection found for user' }, 404);
        }

        const gmail = connection as GmailConnection;
        const isInitialImport = !enrichOnly && !hardSync && !connection?.last_synced_at;
        const isDeepSync = !enrichOnly && hardSync;
        syncType = enrichOnly ? 'enrich' : (hardSync ? 'full' : (connection?.last_synced_at ? 'incremental' : 'full'));
        console.log('gmail-sync-user start', {
            user_id: user.id,
            email: gmail.email,
            provider: gmail.provider,
            has_refresh_token: !!gmail.refresh_token,
            incoming_refresh: !!incomingRefresh,
            seed_only: seedOnly,
        });

        if (!gmail.refresh_token && incomingRefresh) {
            const { error: updateError } = await admin
                .from('gmail_connections')
                .update({ refresh_token: incomingRefresh, email: gmail.email ?? incomingEmail })
                .eq('user_id', user.id)
                .eq('provider', gmail.provider || 'google');
            if (!updateError) {
                gmail.refresh_token = incomingRefresh;
            } else {
                console.error('gmail-sync-user failed to backfill refresh token', updateError);
            }
        }

        if (seedOnly) {
            return jsonResponse({
                ok: true,
                seed_only: true,
                has_refresh_token: !!gmail.refresh_token,
                provider: gmail.provider ?? 'google',
                email: gmail.email ?? incomingEmail ?? user.email,
            });
        }

        if (!gmail.refresh_token) {
            console.warn('gmail-sync-user missing refresh token', { user_id: user.id, provider: gmail.provider });
            await writeSyncLogError('Missing refresh token for Gmail connection');
            return jsonResponse({ error: 'Missing refresh token for Gmail connection' }, 400);
        }

        let accessToken: string;
        try {
            accessToken = await getAccessToken(gmail.refresh_token);
        } catch (err: any) {
            await writeSyncLogError(err?.message || 'Unable to get Gmail access token');
            return jsonResponse({ error: err?.message || 'Unable to get Gmail access token' }, 500);
        }

        const updateSyncState = async (updates: Record<string, unknown>) => {
            if (enrichOnly) return;
            await admin.from('gmail_sync_state').upsert({
                user_id: user.id,
                connection_id: gmail.id ?? null,
                ...updates,
            }, { onConflict: 'user_id' });
        };

        // Build Gmail query using the optimized query builder
        let query = '';
        if (!enrichOnly) {
            query = buildOptimizedGmailQuery({
                hardSync,
                lightSync,
                lookbackMonths,
                lastSyncedAt: connection?.last_synced_at || null,
                isInitialImport,
            });
            console.log('gmail-sync-user query built', { query: query.substring(0, 200) + '...' });
        }

        let syncLogId: number | null = null;
        let resolvedSyncType: "full" | "incremental" | "enrich" = syncType;
        let totalMessagesFetched = 0;
        let nextPageTokenFromSync: string | undefined;
        let eventInserted = 0;
        let eventUpdated = 0;
        let appInserted = 0;
        let appUpdated = 0;

        try {
            const { data: syncLog, error: logError } = await admin
                .from('gmail_sync_logs')
                .insert([{
                    user_id: user.id,
                    status: 'running',
                    sync_type: resolvedSyncType,
                    started_at: new Date().toISOString()
                }])
                .select('id')
                .maybeSingle();
            if (logError) {
                console.error('gmail-sync-user failed to create sync log', logError);
            } else {
                syncLogId = (syncLog as any)?.id ?? null;
            }

            const ids: { id: string }[] = [];
            let estimateFromSync: number | null = null;
            let lastProgressPercent: number | null = null;
            let backfillProcessedCount: number | null = null;

            if (isInitialImport) {
                await updateSyncState({
                    initial_import_status: 'phase1_running',
                    initial_import_progress: 0,
                    last_sync_summary: 'Phase 1 sync started.',
                });
            }
            if (isDeepSync) {
                await updateSyncState({
                    initial_import_status: 'deep_running',
                    last_sync_summary: 'Deep sync started.',
                });
            }

            if (enrichOnly) {
                const { data: enrichRows } = await admin
                    .from('job_email_events')
                    .select('gmail_message_id')
                    .eq('user_id', user.id)
                    .is('llm_parsed_json', null)
                    .order('received_at', { ascending: false })
                    .limit(maxMessages);
                ids.push(
                    ...(enrichRows || [])
                        .map((row: any) => ({ id: row.gmail_message_id }))
                        .filter((row: any) => !!row.id)
                );
                totalMessagesFetched = ids.length;
                nextPageTokenFromSync = undefined;
            } else {
                let pageToken: string | undefined =
                    pageTokenFromClient || (hardSync ? connection?.backfill_page_token || undefined : undefined);
                const maxTotalMessages = hardSync
                    ? DEEP_SYNC_MAX_MESSAGES_PER_RUN
                    : isInitialImport
                        ? (lightSync ? 100 : 200)
                        : 500;
                while (true) {
                    const { messages: messageIds, nextPageToken, resultSizeEstimate } = await listMessages(
                        accessToken,
                        query,
                        maxMessages,
                        pageToken
                    );
                    if (estimateFromSync === null && typeof resultSizeEstimate === 'number') {
                        estimateFromSync = resultSizeEstimate;
                    }
                    ids.push(...messageIds);
                    totalMessagesFetched = ids.length;
                    nextPageTokenFromSync = nextPageToken;
                    if (estimateFromSync && (isInitialImport || isDeepSync)) {
                        const percent = Math.min(100, Math.round((totalMessagesFetched / estimateFromSync) * 100));
                        if (lastProgressPercent === null || percent >= lastProgressPercent + 5) {
                            lastProgressPercent = percent;
                            await updateSyncState({ initial_import_progress: percent });
                        }
                    }
                    const timeRemaining = TIME_BUDGET_MS - (Date.now() - syncStartMs);
                    if (!nextPageToken) break;
                    if (totalMessagesFetched >= maxTotalMessages) break;
                    if (timeRemaining < 10_000) break;
                    pageToken = nextPageToken;
                }
                if (hardSync) {
                    const isFreshBackfill =
                        !pageTokenFromClient &&
                        !connection?.backfill_page_token &&
                        !connection?.backfill_started_at;
                    const nextProcessedCount =
                        (isFreshBackfill ? 0 : (connection?.backfill_processed_count || 0)) + ids.length;
                    backfillProcessedCount = nextProcessedCount;
                    if (nextPageTokenFromSync) {
                        await admin
                            .from('gmail_connections')
                            .update({
                                backfill_page_token: nextPageTokenFromSync,
                                backfill_started_at: connection?.backfill_started_at || new Date().toISOString(),
                                backfill_completed_at: null,
                                backfill_total_estimate: estimateFromSync ?? connection?.backfill_total_estimate ?? null,
                                backfill_processed_count: nextProcessedCount,
                            })
                            .eq('user_id', user.id)
                            .eq('provider', connection.provider || 'google');
                        if (isDeepSync) {
                            const deepEstimate = estimateFromSync ?? connection?.backfill_total_estimate ?? null;
                            const deepProgress = deepEstimate
                                ? Math.min(99, Math.round((nextProcessedCount / deepEstimate) * 100))
                                : null;
                            await updateSyncState({
                                initial_import_progress: deepProgress,
                            });
                        }
                    } else {
                        await admin
                            .from('gmail_connections')
                            .update({
                                backfill_page_token: null,
                                backfill_started_at: connection?.backfill_started_at || new Date().toISOString(),
                                backfill_completed_at: new Date().toISOString(),
                                backfill_total_estimate: estimateFromSync ?? connection?.backfill_total_estimate ?? null,
                                backfill_processed_count: nextProcessedCount,
                            })
                            .eq('user_id', user.id)
                            .eq('provider', connection.provider || 'google');
                        if (isDeepSync) {
                            await updateSyncState({
                                initial_import_progress: 100,
                            });
                        }
                    }
                }
            }

            totalMessagesFetched = ids.length;
            const messages: GmailMessage[] = [];
            const appResults: Array<{ gmail_message_id: string; action: 'inserted' | 'updated' | 'error'; error?: string }> = [];
            const notificationDedup = new Set<string>();
            const notificationCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const appCache = new Map<string, { status: string | null; company: string | null; role: string | null }>();
            let llmSampleLogs = 0;
            const LLM_SAMPLE_LIMIT = 10;

            async function createNotificationOnce(
                dedupKey: string,
                payload: Record<string, unknown>,
                options?: { statusTo?: string }
            ) {
                if (notificationDedup.has(dedupKey)) return;
                notificationDedup.add(dedupKey);
                let query = admin
                    .from('notifications')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('subtype', payload.subtype as string)
                    .gte('created_at', notificationCutoff)
                    .limit(1);
                if (payload.entity_id) {
                    query = query.eq('entity_id', payload.entity_id as string);
                }
                if (options?.statusTo) {
                    query = query.eq('metadata->>status_to', options.statusTo);
                }
                const { data: existingNotification, error: existingError } = await query;
                if (existingError) {
                    console.warn('gmail-sync-user failed to check notification dedup', existingError);
                    return;
                }
                if (existingNotification && existingNotification.length > 0) return;
                const { error: insertError } = await admin.from('notifications').insert([payload]);
                if (insertError) {
                    console.error('gmail-sync-user failed to insert notification', insertError);
                }
            }

            const messageIds = ids.map((item) => item.id);
            const existingAppsByMessage = new Map<string, any>();
            const existingEventsByMessage = new Map<string, any>();
            const pendingEventUpserts: Array<Record<string, unknown>> = [];
            const pendingTaskUpserts: Array<Record<string, unknown>> = [];

            if (messageIds.length > 0) {
                const { data: existingApps } = await admin
                    .from('applications')
                    .select('id, company, role, role_title, status, source_type, gmail_message_id')
                    .eq('user_id', user.id)
                    .in('gmail_message_id', messageIds);
                (existingApps || []).forEach((app: any) => {
                    if (app.gmail_message_id) {
                        existingAppsByMessage.set(app.gmail_message_id, app);
                    }
                });

                const { data: existingEvents } = await admin
                    .from('job_email_events')
                    .select('id, application_id, user_id, gmail_message_id, gmail_thread_id, parsed_company, parsed_role, parsed_status, event_type, llm_parsed_json')
                    .eq('user_id', user.id)
                    .in('gmail_message_id', messageIds);
                (existingEvents || []).forEach((event: any) => {
                    if (event.gmail_message_id) {
                        existingEventsByMessage.set(event.gmail_message_id, event);
                    }
                });
            }

            let latestMessageTime: string | null = null;
            const syncTimestamp = new Date().toISOString();

            for (const { id } of ids) {
                try {
                    const msg = await fetchMessageMetadata(accessToken, id);
                    messages.push(msg);
                    if (msg.internalDate && (!latestMessageTime || msg.internalDate > latestMessageTime)) {
                        latestMessageTime = msg.internalDate;
                    }
                    console.log('gmail-sync-user fetched', {
                        id: msg.id,
                        subject: msg.subject,
                        from: msg.from,
                        internalDate: msg.internalDate,
                    });

                    const existing = existingAppsByMessage.get(msg.id) || null;
                    if (existing?.id) {
                        appCache.set(existing.id, {
                            status: (existing as any).status ?? null,
                            company: (existing as any).company ?? null,
                            role: (existing as any).role ?? null,
                        });
                    }

                    const roleGuess = deriveRole(msg.subject, msg.from, msg.snippet, msg.bodyText) || 'Job application';

                    const receivedAt =
                        (msg.internalTimestamp && new Date(msg.internalTimestamp).toISOString()) ||
                        msg.internalDate ||
                        new Date().toISOString();

                    const existingEvent = existingEventsByMessage.get(msg.id) || null;

                    let classification = classifyJobEmailEvent(msg.subject, msg.from, msg.snippet, msg.bodyText);
                    let parsing = await parseCompanyAndRole(msg.subject, msg.from, msg.snippet, msg.bodyText);
                    let heuristicStatus = determineStatusHeuristic(msg.subject, msg.bodyText, msg.snippet);
                    const timeRemaining = TIME_BUDGET_MS - (Date.now() - syncStartMs);
                    const heuristicConfidence = Math.max(classification.confidence, parsing.confidence);
                    const allowLlmByHeuristic = enrichOnly ? true : heuristicConfidence < 0.95;
                    const shouldUsePromptA =
                        !lightSync &&
                        llmCalls < LLM_MAX_PER_SYNC &&
                        timeRemaining > LLM_MIN_TIME_REMAINING_MS &&
                        (allowLlmByHeuristic || !parsing.parsed_company || !parsing.parsed_role);

                    const needsFullFetch = parsing.confidence < 0.7 || !heuristicStatus || shouldUsePromptA;
                    if (!msg.bodyText && needsFullFetch && fullFetches < FULL_FETCH_MAX && timeRemaining > 10_000) {
                        const fullMsg = await fetchMessageFull(accessToken, id);
                        msg.bodyText = fullMsg.bodyText;
                        msg.snippet = fullMsg.snippet ?? msg.snippet;
                        msg.subject = fullMsg.subject ?? msg.subject;
                        msg.from = fullMsg.from ?? msg.from;
                        msg.internetMessageId = fullMsg.internetMessageId ?? msg.internetMessageId;
                        fullFetches += 1;
                        parsing = await parseCompanyAndRole(msg.subject, msg.from, msg.snippet, msg.bodyText);
                        heuristicStatus = determineStatusHeuristic(msg.subject, msg.bodyText, msg.snippet);
                        classification = classifyJobEmailEvent(msg.subject, msg.from, msg.snippet, msg.bodyText);
                    }

                    const cleanedBody = stripQuotedReplies(msg.bodyText);
                    const topLines = buildTopLines(cleanedBody || msg.bodyText);
                    const bodyForLlm = [topLines, cleanedBody].filter(Boolean).join('\n\n').trim();
                    const extractedUrls = extractUrlsFromText(bodyForLlm || msg.snippet || '');
                    const portalDomain = extractPortalDomain(extractedUrls);
                    const extractedJobId = extractJobIdFromUrls(extractedUrls);

                    let promptAResult: any | null = null;
                    if (shouldUsePromptA && bodyForLlm) {
                        promptAResult = await callOpenAI(PROMPT_A_SYSTEM, buildPromptAInput(msg.subject, msg.from, msg.snippet, bodyForLlm));
                        llmCalls += 1;
                        if (promptAResult && llmSampleLogs < LLM_SAMPLE_LIMIT) {
                            llmSampleLogs += 1;
                            console.log('gmail-sync-user llm sample', {
                                sample_index: llmSampleLogs,
                                gmail_message_id: msg.id,
                                thread_id: msg.threadId ?? null,
                                subject: msg.subject ?? null,
                                from: msg.from ?? null,
                                parsed: promptAResult,
                            });
                        }
                    }

                    const isJobRelated = promptAResult ? isJobRelatedFromPrompt(promptAResult) : true;
                    const promptCompany = promptAResult?.company_name ? String(promptAResult.company_name) : null;
                    const promptCompanyConfidence = promptAResult?.confidence || null;
                    const promptRole = promptAResult?.job_title ? String(promptAResult.job_title) : null;
                    const promptRoleConfidence = promptAResult?.confidence || null;
                    const promptEventType = promptAResult?.event_type || null;
                    const promptStatus = promptAResult?.status || null;
                    const promptJobId = null;
                    const promptReqId = null;
                    const promptAppId = null;
                    const promptPortalDomain = null;

                    let parsedCompany = promptCompany || parsing.parsed_company || (existingEvent as any)?.parsed_company || null;
                    let parsedRole = promptRole || parsing.parsed_role || (existingEvent as any)?.parsed_role || null;
                    if (parsedCompany && isAtsName(parsedCompany)) {
                        parsedCompany = null;
                    }
                    if (parsedRole && JobUtils.isLikelyNotRole(parsedRole)) {
                        parsedRole = null;
                    }

                    const companyConfidence =
                        parsedCompany === promptCompany && promptCompanyConfidence !== null
                            ? promptCompanyConfidence
                            : (parsedCompany ? parsing.confidence : 0);
                    const roleConfidence =
                        parsedRole === promptRole && promptRoleConfidence !== null
                            ? promptRoleConfidence
                            : (parsedRole ? parsing.confidence : 0);

                    const resolvedPortalDomain = promptPortalDomain || portalDomain;
                    const resolvedJobId = promptJobId || extractedJobId;
                    const canonicalKey = buildCanonicalKey({
                        company: parsedCompany,
                        role: parsedRole,
                        companyConfidence,
                        roleConfidence,
                        portalDomain: resolvedPortalDomain,
                        jobId: resolvedJobId,
                    });

                    const eventType = promptEventType || classification.event_type;
                    const statusFromEvent = statusFromEventType(eventType);
                    const parsedStatus = pickHigherStatus(
                        promptStatus,
                        statusFromEvent,
                        heuristicStatus,
                        (existingEvent as any)?.parsed_status || null,
                        existing?.status || null,
                    );

                    const canCreateApp = !!parsedCompany && (companyConfidence >= 0.5) &&
                        (!!parsedRole || !!roleGuess);

                    const resolvedCompany = parsedCompany ? capitalizeFirstLetter(parsedCompany) : null;
                    const resolvedRoleRaw = parsedRole || roleGuess;
                    const resolvedRole = JobUtils.cleanJobTitle(resolvedRoleRaw) || resolvedRoleRaw;

                    if (!isJobRelated) {
                        continue;
                    }

                    const duplicateInternetId =
                        msg.internetMessageId
                            ? await admin
                                .from('job_email_events')
                                .select('id, gmail_message_id, application_id')
                                .eq('user_id', user.id)
                                .eq('internet_message_id', msg.internetMessageId)
                                .maybeSingle()
                            : null;
                    if (duplicateInternetId?.data?.gmail_message_id && duplicateInternetId.data.gmail_message_id !== msg.id) {
                        continue;
                    }

                    let foundAppId: string | null = (existingEvent as any)?.application_id || null;

                    if (!foundAppId && promptAppId) {
                        const { data: appByExternal } = await admin
                            .from('applications')
                            .select('id, status, company, role, created_at, portal_domain')
                            .eq('user_id', user.id)
                            .eq('external_application_id', promptAppId)
                            .maybeSingle();
                        if (appByExternal?.id) foundAppId = appByExternal.id;
                    }
                    if (!foundAppId && promptReqId) {
                        const { data: appByReq } = await admin
                            .from('applications')
                            .select('id')
                            .eq('user_id', user.id)
                            .eq('requisition_id', promptReqId)
                            .maybeSingle();
                        if (appByReq?.id) foundAppId = appByReq.id;
                    }
                    if (!foundAppId && promptJobId) {
                        const { data: appByJob } = await admin
                            .from('applications')
                            .select('id')
                            .eq('user_id', user.id)
                            .eq('job_id', promptJobId)
                            .maybeSingle();
                        if (appByJob?.id) foundAppId = appByJob.id;
                    }
                    if (!foundAppId && msg.threadId) {
                        const { data: appByThread } = await admin
                            .from('applications')
                            .select('id')
                            .eq('user_id', user.id)
                            .eq('gmail_thread_id', msg.threadId)
                            .maybeSingle();
                        if (appByThread?.id) foundAppId = appByThread.id;
                    }
                    if (!foundAppId && canonicalKey) {
                        const { data: appByCanonical } = await admin
                            .from('applications')
                            .select('id')
                            .eq('user_id', user.id)
                            .eq('canonical_key', canonicalKey)
                            .maybeSingle();
                        if (appByCanonical?.id) foundAppId = appByCanonical.id;
                    }
                    if (!foundAppId && parsedCompany && parsedRole && companyConfidence >= 0.5 && roleConfidence >= 0.4) {
                        const { data: fuzzyApps } = await admin
                            .from('applications')
                            .select('id, company, role, created_at, portal_domain, job_id')
                            .eq('user_id', user.id)
                            .order('created_at', { ascending: false })
                            .limit(20);
                        const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
                        const match = (fuzzyApps || []).find((app: any) => {
                            const companyMatch = app.company ? areSameCompany(parsedCompany, app.company) : false;
                            if (!companyMatch) return false;
                            const roleMatch = app.role ? areSameRole(parsedRole, app.role) : false;
                            if (!roleMatch) return false;
                            const dateOk = app.created_at ? new Date(app.created_at).getTime() >= sixMonthsAgo : false;
                            const portalOk = resolvedPortalDomain && app.portal_domain ?
                                resolvedPortalDomain === app.portal_domain : false;
                            const jobIdOk = resolvedJobId && app.job_id ?
                                resolvedJobId === app.job_id : false;
                            return dateOk || portalOk || jobIdOk;
                        });
                        if (match?.id) foundAppId = match.id;
                    }

                    const eventPayload: Record<string, unknown> = {
                        user_id: user.id,
                        gmail_message_id: msg.id,
                        gmail_thread_id: msg.threadId ?? null,
                        internet_message_id: msg.internetMessageId ?? null,
                        raw_subject: msg.subject ?? null,
                        raw_from: msg.from ?? null,
                        raw_snippet: msg.snippet ?? null,
                        received_at: receivedAt,
                        event_type: eventType,
                        confidence: Math.max(
                            classification.confidence,
                            parsing.confidence,
                            promptCompanyConfidence || 0,
                            promptRoleConfidence || 0
                        ),
                        parsed_company: resolvedCompany || null,
                        parsed_role: resolvedRole || null,
                        parsed_status: parsedStatus || null,
                        portal_domain: resolvedPortalDomain,
                        canonical_key: canonicalKey,
                        job_id: promptJobId,
                        requisition_id: promptReqId,
                        external_application_id: promptAppId,
                        llm_parsed_json: promptAResult
                            ? { prompt_a: promptAResult }
                            : (existingEvent as any)?.llm_parsed_json || null,
                    };

                    const { data: upsertedEvent, error: eventUpsertError } = await admin
                        .from('job_email_events')
                        .upsert([eventPayload], { onConflict: 'user_id,gmail_message_id' })
                        .select('id, application_id, user_id, gmail_thread_id, parsed_company, parsed_role, event_type');
                    if (eventUpsertError) {
                        console.error('gmail-sync-user failed to upsert job_email_event', {
                            message_id: msg.id,
                            error: eventUpsertError,
                        });
                    } else if (existingEvent?.id) {
                        eventUpdated += 1;
                    } else {
                        eventInserted += 1;
                    }

                    const eventRow = (upsertedEvent && upsertedEvent[0]) || eventPayload;

                    if (foundAppId && eventRow?.id) {
                        await admin
                            .from('job_email_events')
                            .update({ application_id: foundAppId })
                            .eq('id', eventRow.id);
                    }

                    const shouldUpdateAppFields = (value: string | null | undefined, existingValue: string | null | undefined) => {
                        if (!value) return false;
                        if (!existingValue) return true;
                        const lower = existingValue.toLowerCase();
                        return lower.includes('unknown');
                    };

                    if (foundAppId) {
                        let cachedApp = appCache.get(foundAppId);
                        if (!cachedApp) {
                            const { data: appRow } = await admin
                                .from('applications')
                                .select('status, company, role, role_title, gmail_thread_id, canonical_key, portal_domain')
                                .eq('id', foundAppId)
                                .maybeSingle();
                            if (appRow) {
                                cachedApp = {
                                    status: (appRow as any).status ?? null,
                                    company: (appRow as any).company ?? null,
                                    role: (appRow as any).role ?? null,
                                };
                                appCache.set(foundAppId, cachedApp);
                            }
                        }
                        const nextStatus = pickHigherStatus(parsedStatus || null, cachedApp?.status || null);
                        const updatePayload: Record<string, unknown> = {
                            last_synced_at: syncTimestamp,
                        };
                        if (resolvedCompany && shouldUpdateAppFields(resolvedCompany, cachedApp?.company || null)) {
                            updatePayload.company = resolvedCompany;
                        }
                        if (resolvedRole && shouldUpdateAppFields(resolvedRole, cachedApp?.role || null)) {
                            updatePayload.role = resolvedRole;
                            updatePayload.role_title = resolvedRole;
                        }
                        if (msg.threadId) {
                            updatePayload.gmail_thread_id = msg.threadId;
                        }
                        if (canonicalKey) {
                            updatePayload.canonical_key = canonicalKey;
                        }
                        if (resolvedPortalDomain) {
                            updatePayload.portal_domain = resolvedPortalDomain;
                        }
                        if (promptReqId) {
                            updatePayload.requisition_id = promptReqId;
                        }
                        if (promptJobId) {
                            updatePayload.job_id = promptJobId;
                        }
                        if (promptAppId) {
                            updatePayload.external_application_id = promptAppId;
                        }
                        if (nextStatus && nextStatus !== cachedApp?.status) {
                            updatePayload.status = nextStatus;
                        }

                        const { error: updateError } = await admin.from('applications').update(updatePayload).eq('id', foundAppId);
                        if (updateError) {
                            console.error('gmail-sync-user failed to update application', { id: foundAppId, error: updateError });
                            appResults.push({ gmail_message_id: msg.id, action: 'error', error: updateError.message });
                        } else {
                            appUpdated += 1;
                            appResults.push({ gmail_message_id: msg.id, action: 'updated' });
                            if (nextStatus && nextStatus !== cachedApp?.status) {
                                await createNotificationOnce(`status:${foundAppId}:${nextStatus}`, {
                                    user_id: user.id,
                                    type: 'update',
                                    subtype: 'status_change',
                                    title: `Update: ${nextStatus} for ${resolvedCompany || cachedApp?.company || 'Application'}`,
                                    body: resolvedRole || cachedApp?.role || null,
                                    entity_type: 'application',
                                    entity_id: foundAppId,
                                    metadata: {
                                        status_from: cachedApp?.status || null,
                                        status_to: nextStatus,
                                        company: resolvedCompany || cachedApp?.company || null,
                                        role: resolvedRole || cachedApp?.role || null,
                                    },
                                    channel: 'both',
                                    priority: 'normal',
                                    scheduled_for: syncTimestamp,
                                }, { statusTo: nextStatus });
                            }
                        }
                    }

                    if (!foundAppId && canCreateApp) {
                        const initialStatus = pickHigherStatus(parsedStatus || null, statusFromEvent || null, 'Applied');
                        const { data: newApp, error: insertError } = await admin
                            .from('applications')
                            .insert([{
                                user_id: user.id,
                                company: resolvedCompany || 'Unknown',
                                role: resolvedRole || 'Unknown',
                                role_title: resolvedRole || 'Unknown',
                                source_type: 'gmail',
                                gmail_message_id: msg.id,
                                gmail_thread_id: msg.threadId ?? null,
                                email_snippet: msg.snippet ?? null,
                                status: initialStatus,
                                last_synced_at: syncTimestamp,
                                canonical_key: canonicalKey,
                                portal_domain: resolvedPortalDomain,
                                requisition_id: promptReqId,
                                job_id: promptJobId,
                                external_application_id: promptAppId,
                            }])
                            .select('id, company, role, status')
                            .maybeSingle();
                        if (insertError) {
                            console.error('gmail-sync-user failed to insert application', { message_id: msg.id, error: insertError });
                            appResults.push({ gmail_message_id: msg.id, action: 'error', error: insertError.message });
                        } else {
                            appInserted += 1;
                            appResults.push({ gmail_message_id: msg.id, action: 'inserted' });
                            if (newApp?.id) {
                                foundAppId = newApp.id;
                                appCache.set(newApp.id, {
                                    status: (newApp as any).status ?? null,
                                    company: (newApp as any).company ?? null,
                                    role: (newApp as any).role ?? null,
                                });
                                await admin
                                    .from('job_email_events')
                                    .update({ application_id: newApp.id })
                                    .eq('id', eventRow.id);
                                await createNotificationOnce(`new_app:${newApp.id}`, {
                                    user_id: user.id,
                                    type: 'update',
                                    subtype: 'new_application',
                                    title: `New job detected: ${(newApp as any).company || 'Application'}`,
                                    body: (newApp as any).role || null,
                                    entity_type: 'application',
                                    entity_id: newApp.id,
                                    metadata: {
                                        company: (newApp as any).company || null,
                                        role: (newApp as any).role || null,
                                    },
                                    channel: 'both',
                                    priority: 'normal',
                                    scheduled_for: syncTimestamp,
                                });
                            }
                        }
                    }

                    let promptBResult: any | null = null;
                    // Also check for existing Prompt B data from a previous sync
                    if (!promptBResult && existingEvent?.llm_parsed_json?.prompt_b) {
                        promptBResult = existingEvent.llm_parsed_json.prompt_b;
                    }
                    const shouldUsePromptB =
                        bodyForLlm &&
                        llmCalls < LLM_MAX_PER_SYNC &&
                        !promptBResult &&
                        (eventType === 'interview_invite' ||
                            eventType === 'assessment' ||
                            eventType === 'offer' ||
                            ((companyConfidence < 0.7 || roleConfidence < 0.7) && isJobRelated));
                    if (shouldUsePromptB && bodyForLlm) {
                        promptBResult = await callOpenAIRaw(PROMPT_B_SYSTEM, buildPromptBInput(msg.subject, msg.from, msg.snippet, bodyForLlm));
                        llmCalls += 1;
                        if (promptBResult) {
                            await admin
                                .from('job_email_events')
                                .update({
                                    llm_parsed_json: {
                                        prompt_a: promptAResult,
                                        prompt_b: promptBResult,
                                    },
                                })
                                .eq('id', eventRow.id);

                            // Backfill app with better company/role from Prompt B if available
                            if (foundAppId) {
                                const pbCompany = promptBResult.company_name ? String(promptBResult.company_name) : null;
                                const pbRole = promptBResult.job_title ? String(promptBResult.job_title) : null;
                                const appUpdate: Record<string, unknown> = {};
                                if (pbCompany && !isAtsName(pbCompany)) {
                                    const cached = appCache.get(foundAppId);
                                    if (!cached?.company || cached.company === 'Unknown') {
                                        appUpdate.company = capitalizeFirstLetter(pbCompany);
                                    }
                                }
                                if (pbRole && !JobUtils.isLikelyNotRole(pbRole)) {
                                    const cached = appCache.get(foundAppId);
                                    if (!cached?.role || cached.role === 'Unknown' || cached.role === 'Job application') {
                                        appUpdate.role = pbRole;
                                        appUpdate.role_title = pbRole;
                                    }
                                }
                                if (Object.keys(appUpdate).length > 0) {
                                    await admin.from('applications').update(appUpdate).eq('id', foundAppId);
                                }
                            }
                        }
                    }

                    // ── Generate Events & Tasks ────────────────────────────────
                    if (foundAppId) {
                        // --- Interview events ---
                        // Source 1: Prompt B nested interview data (highest fidelity)
                        const pbInterviewRequested = !!promptBResult?.interview?.requested;
                        const pbInterviewStart = safeParseDate(
                            promptBResult?.interview?.date_time_candidates?.[0] || null
                        );
                        const pbInterviewMeeting =
                            promptBResult?.interview?.meeting_link ||
                            promptBResult?.interview?.scheduling_link ||
                            null;

                        // Source 2: Prompt B flat interview_date field
                        const pbFlatInterviewDate = safeParseDate(promptBResult?.interview_date || null);

                        // Source 3: Prompt A interview_date (fallback when Prompt B didn't run)
                        const paInterviewDate = safeParseDate(promptAResult?.interview_date || null);

                        // Determine the best interview start time
                        const interviewStart = pbInterviewStart || pbFlatInterviewDate || paInterviewDate;

                        // Determine if this is actually an interview event
                        const isInterviewEvent =
                            pbInterviewRequested ||
                            eventType === 'interview_invite';

                        if (isInterviewEvent) {
                            // Create event only if we have a date
                            if (interviewStart) {
                                pendingEventUpserts.push({
                                    user_id: user.id,
                                    application_id: foundAppId,
                                    event_type: 'interview',
                                    title: `${resolvedCompany || 'Application'} interview`,
                                    provider: null,
                                    meeting_link: pbInterviewMeeting,
                                    start_at: interviewStart,
                                    end_at: null,
                                    location: null,
                                    source_type: 'gmail',
                                });
                            }

                            // Always create a preparation task for the interview
                            pendingTaskUpserts.push({
                                user_id: user.id,
                                application_id: foundAppId,
                                title: 'Prepare for interview',
                                description: pbInterviewMeeting
                                    ? `Meeting link: ${pbInterviewMeeting}`
                                    : null,
                                due_at: interviewStart,
                                status: 'open',
                                completed_at: null,
                                origin: 'gmail',
                                source_message_id: msg.id,
                            });
                        }

                        // --- Assessment events ---
                        const assessmentInvited = !!promptBResult?.assessment?.invited;
                        const assessmentDeadline = safeParseDate(
                            promptBResult?.assessment?.deadline || null
                        );
                        const assessmentLink =
                            promptBResult?.assessment?.assessment_link || null;

                        // Fallback: if heuristic/Prompt A detected assessment but Prompt B
                        // didn't have structured data
                        const isAssessmentEvent =
                            assessmentInvited ||
                            eventType === 'assessment';
                        const assessmentStart = assessmentDeadline || paInterviewDate;

                        if (isAssessmentEvent) {
                            if (assessmentStart) {
                                pendingEventUpserts.push({
                                    user_id: user.id,
                                    application_id: foundAppId,
                                    event_type: 'assessment',
                                    title: `${resolvedCompany || 'Application'} assessment`,
                                    provider: null,
                                    meeting_link: assessmentLink,
                                    start_at: assessmentStart,
                                    end_at: null,
                                    location: null,
                                    source_type: 'gmail',
                                });
                            }
                            pendingTaskUpserts.push({
                                user_id: user.id,
                                application_id: foundAppId,
                                title: 'Complete assessment',
                                description: assessmentLink
                                    ? `Assessment link: ${assessmentLink}`
                                    : null,
                                due_at: assessmentStart,
                                status: 'open',
                                completed_at: null,
                                origin: 'gmail',
                                source_message_id: msg.id,
                            });
                        }

                        // --- Offer events ---
                        if (eventType === 'offer') {
                            const offerDate = paInterviewDate || new Date().toISOString();
                            pendingEventUpserts.push({
                                user_id: user.id,
                                application_id: foundAppId,
                                event_type: 'follow_up',
                                title: `${resolvedCompany || 'Application'} offer received`,
                                provider: null,
                                meeting_link: null,
                                start_at: offerDate,
                                end_at: null,
                                location: null,
                                source_type: 'gmail',
                            });
                            pendingTaskUpserts.push({
                                user_id: user.id,
                                application_id: foundAppId,
                                title: 'Review and respond to offer',
                                description: `Offer from ${resolvedCompany || 'company'}`,
                                due_at: offerDate,
                                status: 'open',
                                completed_at: null,
                                origin: 'gmail',
                                source_message_id: msg.id,
                            });
                        }
                    }
                } catch (msgErr) {
                    console.error('Failed to fetch message', id, msgErr);
                }
            }

            if (pendingEventUpserts.length > 0) {
                await admin
                    .from('events')
                    .upsert(pendingEventUpserts, { onConflict: 'user_id,application_id,event_type,start_at' });
            }
            if (pendingTaskUpserts.length > 0) {
                await admin
                    .from('tasks')
                    .upsert(pendingTaskUpserts, { onConflict: 'user_id,application_id,title,due_at' });
            }

            if (syncLogId) {
                const { error: finishError } = await admin
                    .from('gmail_sync_logs')
                    .update({
                        status: 'success',
                        finished_at: new Date().toISOString(),
                        sync_type: resolvedSyncType,
                        total_messages_fetched: totalMessagesFetched,
                        job_email_events_created: eventInserted,
                        job_email_events_updated: eventUpdated,
                        applications_created: appInserted,
                        applications_updated: appUpdated,
                        messages_processed: messages.length,
                    })
                    .eq('id', syncLogId);
                if (finishError) {
                    console.error('gmail-sync-user failed to finalize sync log', finishError);
                }
            }

            if (connection && !nextPageTokenFromSync && !enrichOnly) {
                const newSyncTime = latestMessageTime || new Date().toISOString();
                await admin
                    .from('gmail_connections')
                    .update({ last_synced_at: newSyncTime })
                    .eq('user_id', user.id)
                    .eq('provider', connection.provider || 'google');
            }

            if (isInitialImport) {
                await updateSyncState({
                    initial_import_status: 'phase1_done',
                    initial_import_progress: 100,
                    last_phase1_result_count: appInserted,
                    last_sync_summary: `Phase 1 imported ${appInserted} applications.`,
                });
                const enqueueUrl = `${SUPABASE_URL}/functions/v1/gmail-sync-user`;
                try {
                    await fetch(enqueueUrl, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ hard_sync: true }),
                    });
                    await updateSyncState({
                        initial_import_status: 'deep_running',
                        last_sync_summary: 'Deep sync queued.',
                    });
                } catch (enqueueErr) {
                    console.error('gmail-sync-user failed to enqueue deep sync', enqueueErr);
                }
            }

            if (isDeepSync && nextPageTokenFromSync) {
                await updateSyncState({
                    initial_import_status: 'deep_running',
                    last_deep_result_count: appInserted,
                    last_sync_summary: 'Deep sync continuing.',
                });
                if ((backfillProcessedCount ?? 0) < DEEP_SYNC_TOTAL_LIMIT) {
                    const enqueueUrl = `${SUPABASE_URL}/functions/v1/gmail-sync-user`;
                    try {
                        await fetch(enqueueUrl, {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                hard_sync: true,
                                page_token: nextPageTokenFromSync,
                                max_messages: maxMessages,
                            }),
                        });
                    } catch (enqueueErr) {
                        console.error('gmail-sync-user failed to enqueue deep sync continuation', enqueueErr);
                    }
                } else {
                    await updateSyncState({
                        initial_import_status: 'deep_done',
                        last_sync_summary: 'Deep sync stopped at safety limit.',
                    });
                }
            }

            if (isDeepSync && !nextPageTokenFromSync) {
                await updateSyncState({
                    initial_import_status: 'deep_done',
                    last_deep_result_count: appInserted,
                    last_sync_summary: `Deep sync added ${appInserted} applications.`,
                });
            }

            return jsonResponse({
                ok: true,
                user_id: user.id,
                email: gmail.email ?? user.email,
                provider: gmail.provider ?? 'google',
                processed: messages.length,
                next_page_token: nextPageTokenFromSync ?? null,
                debug: {
                    had_connection: !!connection,
                    inserted: appInserted,
                    updated: appUpdated,
                    eventInserted,
                    eventUpdated,
                    llm_used: llmCalls,
                    max_messages: maxMessages,
                    app_results: appResults.slice(0, 10),
                },
            });
        } catch (err: any) {
            if (isInitialImport || isDeepSync) {
                await updateSyncState({
                    initial_import_status: 'failed',
                    last_sync_summary: err?.message || 'Gmail sync failed',
                });
            }
            if (syncLogId) {
                const { error: finishError } = await admin
                    .from('gmail_sync_logs')
                    .update({
                        status: 'error',
                        finished_at: new Date().toISOString(),
                        sync_type: resolvedSyncType,
                        total_messages_fetched: totalMessagesFetched,
                        job_email_events_created: eventInserted,
                        job_email_events_updated: eventUpdated,
                        applications_created: appInserted,
                        applications_updated: appUpdated,
                        error_message: err?.message || 'Gmail sync failed',
                    })
                    .eq('id', syncLogId);
                if (finishError) {
                    console.error('gmail-sync-user failed to mark sync error', finishError);
                }
            } else {
                await writeSyncLogError(err?.message || 'Gmail sync failed');
            }
            return jsonResponse({ error: err?.message || 'Gmail sync failed' }, 500);
        }
    } catch (err: any) {
        console.error('gmail-sync-user unhandled error', err);
        return jsonResponse({ error: err?.message || 'Unhandled error' }, 500);
    }
});
