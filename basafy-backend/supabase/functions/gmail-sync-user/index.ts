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
    PROMPT_B_SYSTEM,
    buildPromptBInput,
    callOpenAIRaw,
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
    getGmailPushSecret,
    getGmailPubSubTopic,
} from '../_shared/secrets.ts';
import {
    createLogger,
    generateRequestId,
} from '../_shared/logger.ts';
import { fetchEmails, fetchEmailsSinceHistory } from './stage-fetch.ts';
import { parseEmails } from './stage-parse.ts';
import { writeResults } from './stage-write.ts';
import { buildMockMessages } from './mock-data.ts';
import { setupGmailWatch } from './gmail-api.ts';

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const SUPABASE_SERVICE_ROLE_KEY = getSupabaseServiceRoleKey();
const GMAIL_PUSH_SECRET = getGmailPushSecret();
const GMAIL_PUBSUB_TOPIC = getGmailPubSubTopic();

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
// Main orchestrator (simplified)
async function syncGmailPipeline({
    accessToken,
    userId,
    admin,
    query,
    maxMessages,
    fetchFull,
    useLlm,
    pageToken,
}: {
    accessToken: string;
    userId: string;
    admin: any;
    query: string;
    maxMessages: number;
    fetchFull: boolean;
    useLlm: boolean;
    pageToken?: string | null;
}): Promise<{
    totalMessagesFetched: number;
    nextPageToken?: string;
    applicationsCreated: number;
    applicationsUpdated: number;
    jobEmailEventsUpserted: number;
    tasksUpserted: number;
    notificationsInserted: number;
    latestMessageTime: string | null;
}> {
    const fetchResult = await fetchEmails(accessToken, {
        query,
        maxResults: maxMessages,
        fetchFull,
        batchSize: 10,
        maxConcurrent: 3,
        pageToken,
    });
    const messages = fetchResult.messages;

    let latestMessageTime: string | null = null;
    for (const msg of messages) {
        if (msg.internalDate && (!latestMessageTime || msg.internalDate > latestMessageTime)) {
            latestMessageTime = msg.internalDate;
        }
    }

    const parsed = await parseEmails(messages, { useLlm });

    const writeSummary = await writeResults(parsed, { userId, admin });

    return {
        totalMessagesFetched: messages.length,
        nextPageToken: fetchResult.nextPageToken,
        applicationsCreated: writeSummary.applicationsInserted,
        applicationsUpdated: writeSummary.applicationsUpdated,
        jobEmailEventsUpserted: writeSummary.eventsUpserted,
        tasksUpserted: writeSummary.tasksUpserted,
        notificationsInserted: writeSummary.notificationsInserted,
        latestMessageTime,
    };
}

async function syncMockPipeline({
    userId,
    userEmail,
    admin,
    maxMessages,
}: {
    userId: string;
    userEmail: string | null;
    admin: any;
    maxMessages: number;
}): Promise<{
    totalMessagesFetched: number;
    applicationsCreated: number;
    applicationsUpdated: number;
    jobEmailEventsUpserted: number;
    tasksUpserted: number;
    notificationsInserted: number;
}> {
    const { count: existingCount } = await admin
        .from('mock_gmail_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (!existingCount) {
        const seedRows = buildMockMessages(userId);
        if (seedRows.length > 0) {
            await admin.from('mock_gmail_messages').upsert(seedRows, { onConflict: 'user_id,gmail_message_id' });
        }
    }

    const { data: mockRows } = await admin
        .from('mock_gmail_messages')
        .select('gmail_message_id, gmail_thread_id, internet_message_id, subject, from_address, snippet, body_text, received_at')
        .eq('user_id', userId)
        .order('received_at', { ascending: false })
        .limit(maxMessages);

    const messages: GmailMessage[] = (mockRows || []).map((row: any) => ({
        id: row.gmail_message_id,
        threadId: row.gmail_thread_id ?? undefined,
        subject: row.subject ?? undefined,
        from: row.from_address ?? undefined,
        internetMessageId: row.internet_message_id ?? null,
        internalDate: row.received_at ?? undefined,
        snippet: row.snippet ?? undefined,
        bodyText: row.body_text ?? null,
    }));

    console.info('[syncMockPipeline] loaded mock messages', {
        user_id: userId,
        total: messages.length,
        max: maxMessages,
    });
    const parsed = await parseEmails(messages, { useLlm: false });
    let parsedResults = parsed;
    if (parsedResults.length === 0 && messages.length > 0) {
        console.warn('[syncMockPipeline] parseEmails returned 0; using heuristic fallback', {
            user_id: userId,
            total: messages.length,
        });
        parsedResults = messages.map((msg) => {
            const companyResult = CompanyUtils.extractCompany(
                msg.subject ?? null,
                msg.bodyText ?? null,
                msg.from ?? null,
                msg.snippet ?? null
            );
            const roleResult = JobUtils.extractJobTitle(
                msg.subject ?? null,
                msg.bodyText ?? null,
                msg.from ?? null,
                msg.snippet ?? null
            );
            const status = determineStatusHeuristic(
                msg.subject ?? null,
                msg.bodyText ?? null,
                msg.snippet ?? null
            ) ?? 'Applied';
            const eventType =
                status === 'Interview'
                    ? 'interview_invite'
                    : status === 'Assessment'
                        ? 'assessment'
                        : status === 'Rejected'
                            ? 'rejection'
                            : status === 'Offer'
                                ? 'offer'
                                : status === 'Applied'
                                    ? 'application_received'
                                    : 'other';
            const urls = extractUrlsFromText(msg.bodyText ?? msg.snippet ?? '');
            const portalDomain = extractPortalDomain(urls);
            const jobId = extractJobIdFromUrls(urls);
            const canonicalKey = buildCanonicalKey({
                company: companyResult.value,
                role: roleResult.value,
                companyConfidence: null,
                roleConfidence: null,
                portalDomain,
                jobId,
            });
            return {
                company: companyResult.value,
                role: roleResult.value,
                status,
                eventType,
                confidence: 0.55,
                companyConfidence: null,
                roleConfidence: null,
                portalDomain,
                jobId,
                requisitionId: null,
                canonicalKey,
                gmailMessageId: msg.id,
                gmailThreadId: msg.threadId ?? null,
                internetMessageId: msg.internetMessageId ?? null,
                rawSubject: msg.subject ?? null,
                rawFrom: msg.from ?? null,
                rawSnippet: msg.snippet ?? null,
                receivedAt:
                    msg.internalDate ||
                    (msg.internalTimestamp ? new Date(msg.internalTimestamp).toISOString() : null) ||
                    null,
            };
        });
    }
    const writeSummary = await writeResults(parsedResults, { userId, admin });

    await admin
        .from('gmail_connections')
        .upsert({
            user_id: userId,
            provider: 'google',
            email: userEmail ?? 'reviewer@basafy.app',
            refresh_token: 'mock',
            last_synced_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' });

    return {
        totalMessagesFetched: messages.length,
        applicationsCreated: writeSummary.applicationsInserted,
        applicationsUpdated: writeSummary.applicationsUpdated,
        jobEmailEventsUpserted: writeSummary.eventsUpserted,
        tasksUpserted: writeSummary.tasksUpserted,
        notificationsInserted: writeSummary.notificationsInserted,
    };
}

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

        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // ── Push-secret service-to-service auth (gmail-push-handler → gmail-sync-user) ──
        // When the push handler calls us with X-Push-Secret it bypasses JWT auth and supplies user_id directly.
        const pushSecret = req.headers.get('X-Push-Secret');
        if (pushSecret) {
            if (!GMAIL_PUSH_SECRET || pushSecret !== GMAIL_PUSH_SECRET) {
                return jsonResponse({ error: 'Forbidden' }, 403);
            }
            const rawBody = await req.json().catch(() => ({}));
            const internalUserId = (rawBody as any)?.user_id as string | undefined;
            if (!internalUserId) {
                return jsonResponse({ error: 'user_id required for internal calls' }, 400);
            }
            // Run a light sync for this user, scoped to recent messages since the given history ID
            const sinceHistoryId = (rawBody as any)?.since_history_id as string | undefined;
            const { data: conn } = await admin
                .from('gmail_connections')
                .select('refresh_token, last_history_id')
                .eq('user_id', internalUserId)
                .maybeSingle();
            if (!conn?.refresh_token) {
                return jsonResponse({ ok: false, error: 'No Gmail connection for user' }, 200);
            }
            const accessToken = await getAccessToken(conn.refresh_token);
            const startId = sinceHistoryId ?? conn.last_history_id ?? null;
            if (!startId) {
                return jsonResponse({ ok: false, skipped: 'no_history_id' }, 200);
            }
            const { messages, latestHistoryId } = await fetchEmailsSinceHistory(accessToken, startId);
            if (messages.length > 0) {
                const parsed = await parseEmails(messages, { useLlm: true });
                await writeResults(parsed, { userId: internalUserId, admin });
            }
            if (latestHistoryId) {
                await admin
                    .from('gmail_connections')
                    .update({ last_history_id: latestHistoryId, last_synced_at: new Date().toISOString() })
                    .eq('user_id', internalUserId);
            }
            console.info('[push-sync] done', { user_id: internalUserId, new_messages: messages.length, latestHistoryId });
            return jsonResponse({ ok: true, messages_processed: messages.length });
        }

        // ── Normal user JWT auth ──────────────────────────────────────────────
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

        // Parse and validate request body
        const rawBody = await req.json().catch(() => ({}));

        // ── Setup Gmail Push Watch action ────────────────────────────────────
        if ((rawBody as any)?.action === 'setup_watch') {
            if (!GMAIL_PUBSUB_TOPIC) {
                return jsonResponse({ error: 'GMAIL_PUBSUB_TOPIC not configured' }, 500);
            }
            const { data: conn } = await admin
                .from('gmail_connections')
                .select('refresh_token')
                .eq('user_id', user.id)
                .maybeSingle();
            if (!conn?.refresh_token) {
                return jsonResponse({ error: 'No Gmail connection found' }, 400);
            }
            const accessToken = await getAccessToken(conn.refresh_token);
            const watchResult = await setupGmailWatch(accessToken, GMAIL_PUBSUB_TOPIC);
            await admin
                .from('gmail_connections')
                .update({
                    watch_resource_id: null, // Google doesn't return resourceId from watch()
                    watch_expiry: Number(watchResult.expiration),
                    last_history_id: watchResult.historyId,
                })
                .eq('user_id', user.id);
            return jsonResponse({
                ok: true,
                history_id: watchResult.historyId,
                expiration: watchResult.expiration,
                expires_at: new Date(Number(watchResult.expiration)).toISOString(),
            });
        }

        const validationResult = validateSyncRequest(rawBody, user.email ?? null);

        if (!validationResult.success) {
            console.warn('gmail-sync-user invalid request', {
                user_id: user.id,
                error: validationResult.error,
            });
            return jsonResponse({ error: validationResult.error }, 400);
        }

        const params = validationResult.data;
        const runningCutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
        const isMockFlag = Boolean((user.user_metadata as any)?.is_mock);
        const userEmail = (user.email ?? (user.user_metadata as any)?.email ?? '').toLowerCase();
        const isMockEmail = userEmail === 'reviewer@basafy.app';
        const forceMock = Boolean((rawBody as any)?.mock_sync);
        const isMockUser = isMockFlag || isMockEmail || (forceMock && isMockEmail);

        if (!params.seedOnly) {
            const { data: runningSync } = await admin
                .from('gmail_sync_logs')
                .select('id, started_at, sync_type')
                .eq('user_id', user.id)
                .eq('status', 'running')
                .gte('started_at', runningCutoff)
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (runningSync?.id) {
                return jsonResponse({
                    ok: true,
                    skipped: 'sync_in_progress',
                    running_sync: {
                        id: (runningSync as any).id,
                        started_at: (runningSync as any).started_at,
                        sync_type: (runningSync as any).sync_type ?? null,
                    },
                }, 202);
            }
        }
        const usePipeline = Boolean(
            (rawBody as any)?.use_pipeline ||
            (rawBody as any)?.pipeline_mode === 'v2'
        );

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

        // Calculate appropriate bounds based on sync type
        let defaultMax = 100;
        if (hardSync) defaultMax = 800; // Allow deep syncs to fetch plenty of emails
        else defaultMax = 300; // Safe default for incremental and initial imports

        let effectiveMaxMessages = typeof maxMessages === 'number' ? maxMessages : defaultMax;
        if (lightSync) effectiveMaxMessages = Math.min(effectiveMaxMessages, 50);

        const mockMaxMessages = Math.min(effectiveMaxMessages, 30);
        const syncStartMs = Date.now();
        const LLM_MAX_PER_SYNC = lightSync ? 0 : effectiveMaxMessages;
        let llmCalls = 0;
        let fullFetches = 0;
        const FULL_FETCH_MAX = enrichOnly ? 50 : (hardSync ? 200 : 60);
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

        if (isMockUser && seedOnly) {
            return jsonResponse({
                ok: true,
                seed_only: true,
                mock: true,
                has_refresh_token: true,
                provider: 'google',
                email: user.email,
            });
        }

        if (isMockUser && !seedOnly) {
            let syncLogId: number | null = null;
            const { data: syncLog } = await admin
                .from('gmail_sync_logs')
                .insert([{
                    user_id: user.id,
                    status: 'running',
                    sync_type: 'incremental',
                    started_at: new Date().toISOString(),
                }])
                .select('id')
                .maybeSingle();
            syncLogId = (syncLog as any)?.id ?? null;

            const mockSummary = await syncMockPipeline({
                userId: user.id,
                userEmail: user.email ?? null,
                admin,
                maxMessages: mockMaxMessages,
            });

            if (syncLogId) {
                await admin
                    .from('gmail_sync_logs')
                    .update({
                        status: 'success',
                        finished_at: new Date().toISOString(),
                        messages_processed: mockSummary.totalMessagesFetched,
                        total_messages_fetched: mockSummary.totalMessagesFetched,
                        applications_created: mockSummary.applicationsCreated,
                        applications_updated: mockSummary.applicationsUpdated,
                        job_email_events_created: mockSummary.jobEmailEventsUpserted,
                        job_email_events_updated: 0,
                        last_sync_summary: `Mock parse: ${mockSummary.applicationsCreated} apps, ${mockSummary.jobEmailEventsUpserted} events`,
                    })
                    .eq('id', syncLogId);
            }

            await admin.from('gmail_sync_state').upsert({
                user_id: user.id,
                initial_import_status: 'phase1_done',
                last_sync_summary: 'Demo data loaded.',
                last_deep_result_count: mockSummary.applicationsCreated,
            }, { onConflict: 'user_id' });

            return jsonResponse({
                ok: true,
                mock: true,
                total_messages_fetched: mockSummary.totalMessagesFetched,
                applications_created: mockSummary.applicationsCreated,
                applications_updated: mockSummary.applicationsUpdated,
                job_email_events_created: mockSummary.jobEmailEventsUpserted,
            });
        }

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
            let priorityDomains: string[] | null = params.priorityDomains ?? null;
            if (!priorityDomains) {
                const { data: profileRow } = await admin
                    .from('profiles')
                    .select('gmail_priority_domains')
                    .eq('id', user.id)
                    .maybeSingle();
                const domains = (profileRow as any)?.gmail_priority_domains;
                priorityDomains = Array.isArray(domains) ? domains : null;
            }
            query = buildOptimizedGmailQuery({
                hardSync,
                lightSync,
                lookbackMonths,
                lastSyncedAt: connection?.last_synced_at || null,
                isInitialImport,
                priorityDomains,
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

            if (usePipeline && query) {
                const pipelineResult = await syncGmailPipeline({
                    accessToken,
                    userId: user.id,
                    admin,
                    query,
                    maxMessages: effectiveMaxMessages ?? 100,
                    fetchFull: !lightSync,
                    useLlm: !lightSync,
                    pageToken: pageTokenFromClient ?? null,
                });

                if (syncLogId) {
                    await admin
                        .from('gmail_sync_logs')
                        .update({
                            status: 'success',
                            finished_at: new Date().toISOString(),
                            messages_processed: pipelineResult.totalMessagesFetched,
                            total_messages_fetched: pipelineResult.totalMessagesFetched,
                            applications_created: pipelineResult.applicationsCreated,
                            applications_updated: pipelineResult.applicationsUpdated,
                            job_email_events_created: pipelineResult.jobEmailEventsUpserted,
                            job_email_events_updated: 0,
                        })
                        .eq('id', syncLogId);
                }

                // Update last_synced_at checkpoint and backfill_page_token for resumable sync.
                const connectionUpdates: Record<string, unknown> = {};
                if (pipelineResult.latestMessageTime) {
                    connectionUpdates.last_synced_at = pipelineResult.latestMessageTime;
                }
                // Persist page token so the next call can resume from where we stopped.
                // Clear it when we've exhausted the result set (no more pages).
                connectionUpdates.backfill_page_token = pipelineResult.nextPageToken ?? null;
                if (Object.keys(connectionUpdates).length > 0) {
                    await admin
                        .from('gmail_connections')
                        .update(connectionUpdates)
                        .eq('user_id', user.id)
                        .eq('provider', gmail.provider || 'google');
                }

                if (!enrichOnly) {
                    await updateSyncState({
                        last_sync_summary: pipelineResult.applicationsCreated
                            ? `Imported ${pipelineResult.applicationsCreated} applications.`
                            : 'Gmail sync complete.',
                    });
                }

                return jsonResponse({
                    ok: true,
                    pipeline: true,
                    next_page_token: pipelineResult.nextPageToken ?? null,
                    total_messages_fetched: pipelineResult.totalMessagesFetched,
                    applications_created: pipelineResult.applicationsCreated,
                    applications_updated: pipelineResult.applicationsUpdated,
                    job_email_events_created: pipelineResult.jobEmailEventsUpserted,
                });
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
                    .order('created_at', { ascending: false })
                    .limit(effectiveMaxMessages);
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
                        ? (lightSync ? 150 : 300)
                        : 600;
                while (true) {
                    const { messages: messageIds, nextPageToken, resultSizeEstimate } = await listMessages(
                        accessToken,
                        query,
                        effectiveMaxMessages,
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
            const pendingNotifications: Array<{
                payload: Record<string, unknown>;
                bundleGroup?: 'new_application' | 'status_change';
            }> = [];
            const notificationCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const appCache = new Map<string, { status: string | null; company: string | null; role: string | null; role_title: string | null }>();
            let llmSampleLogs = 0;
            const LLM_SAMPLE_LIMIT = 10;
            const BULK_PUSH_THRESHOLD = 5;

            async function createNotificationOnce(
                dedupKey: string,
                payload: Record<string, unknown>,
                options?: { statusTo?: string; bundleGroup?: 'new_application' | 'status_change' }
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
                pendingNotifications.push({ payload, bundleGroup: options?.bundleGroup });
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

            // Batch-fetch all metadata in parallel instead of one-by-one
            const allMetadata = await fetchMessagesParallel(accessToken, ids, {
                batchSize: 15,
                maxConcurrent: 4,
                format: 'metadata',
            });

            for (const msg of allMetadata) {
                try {
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
                            role_title: (existing as any).role_title ?? null,
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
                    const shouldUseLlm =
                        !lightSync &&
                        llmCalls < LLM_MAX_PER_SYNC &&
                        timeRemaining > LLM_MIN_TIME_REMAINING_MS;

                    const needsFullFetch = parsing.confidence < 0.7 || !heuristicStatus || shouldUseLlm;
                    if (!msg.bodyText && needsFullFetch && fullFetches < FULL_FETCH_MAX && timeRemaining > 10_000) {
                        const fullMsg = await fetchMessageFull(accessToken, msg.id);
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
                    if (shouldUseLlm && bodyForLlm) {
                        promptAResult = await callOpenAIRaw(
                            PROMPT_B_SYSTEM,
                            buildPromptBInput(msg.subject, msg.from, msg.snippet, bodyForLlm)
                        );
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

                    const eventType =
                        promptEventType && promptEventType !== 'other'
                            ? promptEventType
                            : classification.event_type;
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

                    // Note: raw_subject, raw_from, raw_snippet, received_at were dropped in schema cleanup (2026-02-10).
                    const eventPayload: Record<string, unknown> = {
                        user_id: user.id,
                        gmail_message_id: msg.id,
                        gmail_thread_id: msg.threadId ?? null,
                        internet_message_id: msg.internetMessageId ?? null,
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
                            ? {
                                prompt_a: promptAResult,
                                prompt_b: (existingEvent as any)?.llm_parsed_json?.prompt_b ?? null,
                            }
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
                                    role_title: (appRow as any).role_title ?? null,
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
                        if (resolvedRole) {
                            if (shouldUpdateAppFields(resolvedRole, cachedApp?.role || null)) {
                                updatePayload.role = resolvedRole;
                            }
                            if (shouldUpdateAppFields(resolvedRole, cachedApp?.role_title || null)) {
                                updatePayload.role_title = resolvedRole;
                            }
                        } else if (cachedApp?.role && shouldUpdateAppFields(cachedApp.role, cachedApp?.role_title || null)) {
                            updatePayload.role_title = cachedApp.role;
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
                                }, { statusTo: nextStatus, bundleGroup: 'status_change' });
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
                                    role_title: (newApp as any).role_title ?? null,
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
                                }, { bundleGroup: 'new_application' });
                            }
                        }
                    }

                    const promptBResult = existingEvent?.llm_parsed_json?.prompt_b ?? null;

                    // ── Generate Events & Tasks ────────────────────────────────
                    if (foundAppId) {
                        const detailResult = promptAResult || promptBResult;
                        // --- Interview events ---
                        // Source 1: LLM nested interview data (highest fidelity)
                        const pbInterviewRequested = !!detailResult?.interview?.requested;
                        const pbInterviewStart = safeParseDate(
                            detailResult?.interview?.date_time_candidates?.[0] || null
                        );
                        const pbInterviewMeeting =
                            detailResult?.interview?.meeting_link ||
                            detailResult?.interview?.scheduling_link ||
                            null;

                        // Source 2: LLM flat interview_date field
                        const pbFlatInterviewDate = safeParseDate(detailResult?.interview_date || null);

                        // Source 3: Prompt A interview_date (fallback when LLM didn't return details)
                        const paInterviewDate = safeParseDate(promptAResult?.interview_date || null);

                        // Determine the best interview start time
                        const interviewStart = pbInterviewStart || pbFlatInterviewDate || paInterviewDate;

                        // Determine if this is actually an interview event
                        const isInterviewEvent =
                            pbInterviewRequested ||
                            eventType === 'interview_invite';

                        if (isInterviewEvent) {
                            // Create event even if we don't have a date, use receivedAt as fallback
                            let eventStart = interviewStart || msg.internalDate || promptAResult?.receivedAt || null;
                            if (!eventStart) {
                                // Log skipped event for debugging
                                const logger = createLogger('gmail-sync-user');
                                logger.warn('Skipped interview event: no date found', {
                                    userId: user.id,
                                    application_id: foundAppId,
                                    company: resolvedCompany,
                                    role: resolvedRole,
                                    subject: msg.subject,
                                    snippet: msg.snippet,
                                    eventType,
                                    interviewRequested: pbInterviewRequested,
                                    interviewStart,
                                    pbInterviewMeeting,
                                    msgId: msg.id,
                                });
                            } else {
                                pendingEventUpserts.push({
                                    user_id: user.id,
                                    application_id: foundAppId,
                                    event_type: 'interview',
                                    title: `${resolvedCompany || 'Application'} interview`,
                                    provider: null,
                                    meeting_link: pbInterviewMeeting,
                                    start_at: eventStart,
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
                                due_at: eventStart,
                                status: 'open',
                                completed_at: null,
                                origin: 'gmail',
                                source_message_id: msg.id,
                            });
                        }

                        // --- Assessment events ---
                        const assessmentInvited = !!detailResult?.assessment?.invited;
                        const assessmentDeadline = safeParseDate(
                            detailResult?.assessment?.deadline || null
                        );
                        const assessmentLink =
                            detailResult?.assessment?.assessment_link || null;

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
                    console.error('Failed to fetch message', msg.id, msgErr);
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
                                max_messages: effectiveMaxMessages,
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

            if (pendingNotifications.length > 0) {
                const pushCandidates = pendingNotifications.filter((n) => n.bundleGroup);
                const shouldBundlePush = pushCandidates.length >= BULK_PUSH_THRESHOLD;
                const notificationsToInsert: Record<string, unknown>[] = [];

                for (const entry of pendingNotifications) {
                    const payload = { ...entry.payload } as Record<string, unknown>;
                    if (shouldBundlePush && entry.bundleGroup) {
                        const channel = payload.channel as string | undefined;
                        if (channel === 'both' || channel === 'push') {
                            payload.channel = 'in_app';
                        }
                    }
                    notificationsToInsert.push(payload);
                }

                if (shouldBundlePush) {
                    const newAppCount = pushCandidates.filter((n) => n.bundleGroup === 'new_application').length;
                    const statusChangeCount = pushCandidates.filter((n) => n.bundleGroup === 'status_change').length;
                    const total = newAppCount + statusChangeCount;
                    const parts: string[] = [];
                    if (newAppCount > 0) {
                        parts.push(`${newAppCount} new application${newAppCount === 1 ? '' : 's'}`);
                    }
                    if (statusChangeCount > 0) {
                        parts.push(`${statusChangeCount} status update${statusChangeCount === 1 ? '' : 's'}`);
                    }
                    const title = parts.length > 0 ? `Gmail sync: ${parts.join(', ')}` : 'Gmail sync updates';
                    notificationsToInsert.push({
                        user_id: user.id,
                        type: 'update',
                        subtype: 'sync_summary',
                        title,
                        body: `Tap to review ${total} update${total === 1 ? '' : 's'}.`,
                        entity_type: null,
                        entity_id: null,
                        metadata: {
                            bundled: true,
                            source: 'gmail_sync',
                            new_application_count: newAppCount,
                            status_change_count: statusChangeCount,
                            total_count: total,
                            sync_started_at: syncTimestamp,
                        },
                        channel: 'push',
                        priority: 'normal',
                        scheduled_for: syncTimestamp,
                    });
                }

                const { error: insertError } = await admin.from('notifications').insert(notificationsToInsert);
                if (insertError) {
                    console.error('gmail-sync-user failed to insert notifications', insertError);
                }
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
                    max_messages: effectiveMaxMessages,
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
