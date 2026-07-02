// Stage 3: Batch write parsed results to DB
// @ts-ignore
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { ApplicationMatchDecision, ParsedEmailResult } from './types.ts';
import { normalizeCompanyForKey, areSameCompany, areSameRole } from './utils.ts';

export interface WriteOpts {
    userId: string;
    admin: SupabaseClient;
    notificationMode?: 'summary_push' | 'in_app_only';
}

export interface WriteSummary {
    applicationsInserted: number;
    applicationsUpdated: number;
    eventsUpserted: number;
    tasksUpserted: number;
    notificationsInserted: number;
    matchDecisions: ApplicationMatchDecision[];
}

/** Strip surrounding angle brackets from a raw RFC 822 Message-ID header value. */
function normalizeMessageId(raw: string | null | undefined): string | null {
    if (!raw) return null;
    return raw.trim().replace(/^<|>$/g, '');
}

export async function writeResults(parsed: ParsedEmailResult[], opts: WriteOpts): Promise<WriteSummary> {
    const { userId, admin, notificationMode = 'summary_push' } = opts;
    const syncTimestamp = new Date().toISOString();
    const { data: profileRow } = await admin
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
    const profileId = (profileRow as any)?.id ?? null;
    const ownerIds = Array.from(new Set([userId, profileId].filter(Boolean))) as string[];

    // 1a. Pre-load existing gmail_message_ids so we can skip notifications for already-seen emails.
    //     Also capture application_id so we can do a Tier-0 exact-message match in findExistingApp.
    const incomingMessageIds = parsed
        .map(p => p.gmailMessageId)
        .filter((id): id is string => Boolean(id));
    const existingMessageIdSet = new Set<string>();
    const existingEventAppMap = new Map<string, string>(); // gmailMessageId → applicationId
    if (incomingMessageIds.length > 0) {
        const { data: existingEvents } = await admin
            .from('job_email_events')
            .select('gmail_message_id, application_id')
            .eq('user_id', userId)
            .in('gmail_message_id', incomingMessageIds);
        for (const row of existingEvents || []) {
            if (row.gmail_message_id) {
                existingMessageIdSet.add(row.gmail_message_id);
                if (row.application_id) existingEventAppMap.set(row.gmail_message_id, row.application_id);
            }
        }
    }

    // 1b. Batch-load all user's existing applications
    const { data: existingApps, error: appLoadError } = await admin
        .from('applications')
        .select('*')
        .eq('user_id', userId);
    if (appLoadError) throw appLoadError;
    const allApps = [...(existingApps ?? [])];
    const { data: historicalLinkedEvents, error: linkedEventsError } = await admin
        .from('job_email_events')
        .select('application_id, gmail_thread_id, canonical_key, parsed_company, parsed_role, parsed_status, internet_message_id, received_at')
        .eq('user_id', userId)
        .not('application_id', 'is', null)
        .order('received_at', { ascending: false })
        .limit(2000);
    if (linkedEventsError) throw linkedEventsError;

    // 2. Build lookup indexes for application matching
    const appsByKey = new Map<string, any>();           // canonical_key -> app (exact)
    const appsByNormCompany = new Map<string, any[]>(); // normalizedCompany -> apps[] (fuzzy)
    const existingAppsById = new Map<string, any>();    // id -> app
    const appsByMessageId = new Map<string, any>();     // gmail_message_id -> app
    const appsByInternetMessageId = new Map<string, any>(); // internet_message_id -> app
    const appsByThreadId = new Map<string, any>();      // gmail_thread_id -> app (Tier 0.5)
    const eventsByCanonicalKey = new Map<string, any[]>(); // canonical_key -> prior linked events
    const eventsByNormCompany = new Map<string, any[]>();  // normalizedCompany -> prior linked events
    const eventsByThreadId = new Map<string, any>();       // gmail_thread_id -> prior linked event
    const eventsByInternetMessageId = new Map<string, any>(); // internet_message_id -> prior linked event
    const matchDecisionsByMessage = new Map<string, ApplicationMatchDecision>();

    function registerApp(app: any) {
        existingAppsById.set(app.id, app);
        if (app.canonical_key) appsByKey.set(app.canonical_key, app);
        if (app.gmail_message_id) appsByMessageId.set(app.gmail_message_id, app);
        if (app.internet_message_id) {
            const normalizedInternetMessageId = normalizeMessageId(app.internet_message_id);
            if (normalizedInternetMessageId) appsByInternetMessageId.set(normalizedInternetMessageId, app);
        }
        if (app.gmail_thread_id) appsByThreadId.set(app.gmail_thread_id, app);
        if (app.company) {
            const normKey = normalizeCompanyForKey(app.company);
            if (!appsByNormCompany.has(normKey)) appsByNormCompany.set(normKey, []);
            appsByNormCompany.get(normKey)!.push(app);
        }
    }

    for (const app of allApps) {
        registerApp(app);
    }

    for (const linkedEvent of historicalLinkedEvents || []) {
        if (linkedEvent.canonical_key) {
            if (!eventsByCanonicalKey.has(linkedEvent.canonical_key)) eventsByCanonicalKey.set(linkedEvent.canonical_key, []);
            eventsByCanonicalKey.get(linkedEvent.canonical_key)!.push(linkedEvent);
        }
        if (linkedEvent.parsed_company) {
            const normCompany = normalizeCompanyForKey(linkedEvent.parsed_company);
            if (!eventsByNormCompany.has(normCompany)) eventsByNormCompany.set(normCompany, []);
            eventsByNormCompany.get(normCompany)!.push(linkedEvent);
        }
        if (linkedEvent.gmail_thread_id && !eventsByThreadId.has(linkedEvent.gmail_thread_id)) {
            eventsByThreadId.set(linkedEvent.gmail_thread_id, linkedEvent);
        }
        if (linkedEvent.internet_message_id) {
            const normalizedInternetMessageId = normalizeMessageId(linkedEvent.internet_message_id);
            if (normalizedInternetMessageId && !eventsByInternetMessageId.has(normalizedInternetMessageId)) {
                eventsByInternetMessageId.set(normalizedInternetMessageId, linkedEvent);
            }
        }
    }

    // Returns true if receiving `newStatus` is a logical follow-up to `existingStatus`.
    // Prevents a stale "Applied" email from overwriting a more advanced state,
    // and prevents creating a duplicate app when the hiring team sends a follow-up.
    function isStatusFollowUp(existingStatus: string, newStatus: string): boolean {
        const priority: Record<string, number> = {
            applied: 1, assessment: 2, interview: 3, rejected: 4, offer: 5,
        };
        const ep = priority[existingStatus] ?? 0;
        const np = priority[newStatus] ?? 0;
        // Rejections are always valid follow-ups regardless of current state.
        if (newStatus === 'rejected') return true;
        // "Applied" after interview/offer/rejection is a fresh cycle, not a follow-up.
        if (newStatus === 'applied' && ep >= priority['interview']) return false;
        // Everything else: a same or higher-priority status is a follow-up.
        return np >= ep;
    }

    // 3-tier matching: canonical key → company+role fuzzy → company-only with progression check
    function findExistingApp(p: ParsedEmailResult): any | undefined {
        // Tier 0: This exact email was already processed — look up its application directly.
        // Prevents re-matching (and failing) on emails whose company/role couldn't be parsed.
        if (p.gmailMessageId && existingEventAppMap.has(p.gmailMessageId)) {
            const appId = existingEventAppMap.get(p.gmailMessageId)!;
            const app = existingAppsById.get(appId);
            if (app) return app;
        }
        if (p.gmailMessageId) {
            const byMessage = appsByMessageId.get(p.gmailMessageId);
            if (byMessage) return byMessage;
        }
        const normalizedInternetMessageId = normalizeMessageId(p.internetMessageId);
        if (normalizedInternetMessageId) {
            const byInternetMessageId = appsByInternetMessageId.get(normalizedInternetMessageId);
            if (byInternetMessageId) return byInternetMessageId;
            const historicalByInternetMessageId = eventsByInternetMessageId.get(normalizedInternetMessageId);
            if (historicalByInternetMessageId?.application_id) {
                const app = existingAppsById.get(historicalByInternetMessageId.application_id);
                if (app) return app;
            }
        }
        // Tier 0.5: Same Gmail thread → same application.
        // Handles follow-up emails in the same thread that don't repeat the company/role.
        if (p.gmailThreadId) {
            const byThread = appsByThreadId.get(p.gmailThreadId);
            if (byThread) return byThread;
            const historicalByThread = eventsByThreadId.get(p.gmailThreadId);
            if (historicalByThread?.application_id) {
                const app = existingAppsById.get(historicalByThread.application_id);
                if (app) return app;
            }
        }
        // Tier 1: Exact canonical key (company + role + portal/job suffix)
        if (p.canonicalKey) {
            const byKey = appsByKey.get(p.canonicalKey);
            if (byKey) return byKey;
            const historicalByKey = eventsByCanonicalKey.get(p.canonicalKey) ?? [];
            for (const historicalEvent of historicalByKey) {
                const app = existingAppsById.get(historicalEvent.application_id);
                if (app) return app;
            }
        }

        if (!p.company) return undefined;

        const normCompany = normalizeCompanyForKey(p.company);
        const companyApps = appsByNormCompany.get(normCompany) ?? [];
        const companyEvents = eventsByNormCompany.get(normCompany) ?? [];

        // Tier 2: Company + role fuzzy match
        // Catches the same canonical key when suffix differs (portal domain present on one email but not the other)
        if (p.role) {
            for (const app of companyApps) {
                if (app.role && areSameCompany(p.company, app.company) && areSameRole(p.role, app.role)) {
                    return app;
                }
            }
            // Wider scan: catch companies whose normalized form differs slightly
            for (const app of allApps) {
                if (!app.company || !app.role) continue;
                if (areSameCompany(p.company, app.company) && areSameRole(p.role, app.role)) {
                    return app;
                }
            }
            for (const historicalEvent of companyEvents) {
                const app = existingAppsById.get(historicalEvent.application_id);
                if (!app || !historicalEvent.parsed_company || !historicalEvent.parsed_role) continue;
                if (areSameCompany(p.company, historicalEvent.parsed_company) && areSameRole(p.role, historicalEvent.parsed_role)) {
                    return app;
                }
            }
        }

        // Tier 3: Company-only match when unambiguous and status is a logical follow-up.
        // If user has exactly one application at this company, a rejection/interview from
        // that company almost certainly belongs to that application.
        const validCompanyApps = companyApps.filter(app => areSameCompany(p.company!, app.company));
        for (const historicalEvent of companyEvents) {
            const app = existingAppsById.get(historicalEvent.application_id);
            if (app && areSameCompany(p.company!, historicalEvent.parsed_company ?? app.company)) {
                if (!validCompanyApps.some((candidate) => candidate.id === app.id)) {
                    validCompanyApps.push(app);
                }
            }
        }
        const newStatus = (p.status ?? 'other').toLowerCase();

        if (validCompanyApps.length === 1) {
            const candidate = validCompanyApps[0];
            const existingStatus = (candidate.status ?? '').toLowerCase();
            if (isStatusFollowUp(existingStatus, newStatus)) return candidate;
        } else if (validCompanyApps.length > 1 && !p.role) {
            // Multiple (likely duplicate) apps exist for this company and the incoming email
            // has no role — collapse onto the highest-priority-status app rather than spawning
            // another duplicate. This self-heals accumulations from earlier syncs.
            const eligible = validCompanyApps.filter(app => {
                const es = (app.status ?? '').toLowerCase();
                return isStatusFollowUp(es, newStatus);
            });
            if (eligible.length > 0) {
                eligible.sort(
                    (a, b) => (statusPriority[(b.status ?? '').toLowerCase()] ?? 0)
                             - (statusPriority[(a.status ?? '').toLowerCase()] ?? 0)
                );
                return eligible[0];
            }
        }

        return undefined;
    }

    function explainMatch(p: ParsedEmailResult, app: any | undefined): ApplicationMatchDecision | null {
        if (!p.gmailMessageId) return null;
        const normalizedCompany = p.company ? normalizeCompanyForKey(p.company) : null;
        const candidates = normalizedCompany
            ? (appsByNormCompany.get(normalizedCompany) ?? []).map((candidate) => candidate.id)
            : [];
        if (!app) {
            return {
                gmailMessageId: p.gmailMessageId,
                matchedApplicationId: null,
                matchType: 'none',
                matchScore: 0,
                companyScore: p.company ? 0.5 : 0,
                roleScore: p.role ? 0.5 : 0,
                threadScore: 0,
                domainScore: 0,
                timelineScore: 0,
                decision: 'create_new',
                reason: 'No existing application satisfied the current deterministic matching rules.',
                candidateApplicationIds: candidates,
            };
        }

        const exactMessage = existingEventAppMap.get(p.gmailMessageId) === app.id || appsByMessageId.get(p.gmailMessageId)?.id === app.id;
        const internetMessage = !!p.internetMessageId && normalizeMessageId(app.internet_message_id) === normalizeMessageId(p.internetMessageId);
        const thread = !!p.gmailThreadId && app.gmail_thread_id === p.gmailThreadId;
        const canonical = !!p.canonicalKey && app.canonical_key === p.canonicalKey;
        const company = !!p.company && !!app.company && areSameCompany(p.company, app.company);
        const role = !!p.role && !!app.role && areSameRole(p.role, app.role);
        const domain = !!p.portalDomain && !!app.portal_domain && p.portalDomain === app.portal_domain;
        const timeline = isStatusFollowUp((app.status ?? '').toLowerCase(), (p.status ?? 'other').toLowerCase());
        const matchType = exactMessage
            ? 'exact_message'
            : internetMessage
                ? 'internet_message_id'
                : thread
                    ? 'gmail_thread'
                    : canonical
                        ? 'canonical_key'
                        : company && role
                            ? 'company_role'
                            : 'company_only';
        const score = exactMessage || internetMessage || thread || canonical ? 1 : company && role ? 0.85 : 0.65;
        return {
            gmailMessageId: p.gmailMessageId,
            matchedApplicationId: app.id,
            matchType,
            matchScore: score,
            companyScore: company ? 1 : 0,
            roleScore: role ? 1 : 0,
            threadScore: thread ? 1 : 0,
            domainScore: domain ? 1 : 0,
            timelineScore: timeline ? 1 : 0,
            decision: 'match_existing',
            reason: `Matched by ${matchType.replaceAll('_', ' ')} using the existing deterministic matcher.`,
            candidateApplicationIds: Array.from(new Set([app.id, ...candidates])),
        };
    }

    const updatedApps: any[] = [];

    // Status priority mirrors constants.ts STATUS_PRIORITY.
    // Higher score = should take precedence over lower score when deciding whether to update.
    // "rejected" is 4 so that a late "applied" email (priority 1) cannot revert a rejection.
    const statusPriority: Record<string, number> = {
        applied: 1,
        assessment: 2,
        interview: 3,
        offer: 5,
        rejected: 4,
    };

    // Track new apps within this batch to prevent in-batch duplicates.
    // Keyed by "company::role" to also catch canonical_key suffix drift.
    const newAppsInBatch = new Map<string, any>(); // "company::role" -> app record
    // Secondary index: gmailThreadId → batchKey, so follow-up emails in the same thread
    // (which may not repeat company/role) collapse into the same new-app record.
    const threadToBatchKey = new Map<string, string>(); // gmailThreadId → batchKey

    for (const p of parsed) {
        const existing = findExistingApp(p);
        const initialMatchDecision = explainMatch(p, existing);
        if (initialMatchDecision) matchDecisionsByMessage.set(initialMatchDecision.gmailMessageId, initialMatchDecision);
        const statusRaw = (p.status ?? 'Applied').toString();
        const status = statusRaw.toLowerCase();
        const existingStatus = (existing?.status ?? '').toString().toLowerCase();

        const appRecord = () => ({
            user_id: userId,
            company: p.company,
            role: p.role,
            role_title: p.role,
            status,
            source_type: 'gmail',
            is_hidden: false,
            gmail_message_id: p.gmailMessageId ?? null,
            gmail_thread_id: p.gmailThreadId ?? null,
            internet_message_id: normalizeMessageId(p.internetMessageId),
            email_snippet: p.rawSnippet ?? null,
            applied_at: p.receivedAt ?? syncTimestamp,
            last_synced_at: syncTimestamp,
            canonical_key: p.canonicalKey,
            portal_domain: p.portalDomain,
            requisition_id: p.requisitionId,
            job_id: p.jobId,
            external_application_id: null,
        });

        // If existing app is rejected and new activity arrives, treat as a fresh cycle.
        const normalizedIncomingInternetId = normalizeMessageId(p.internetMessageId);
        const sameMessage =
            !!existing?.gmail_message_id &&
            !!p.gmailMessageId &&
            existing.gmail_message_id === p.gmailMessageId;
        const sameInternetMessage =
            !!existing?.internet_message_id &&
            !!normalizedIncomingInternetId &&
            normalizeMessageId(existing.internet_message_id) === normalizedIncomingInternetId;
        const sameThread =
            !!existing?.gmail_thread_id &&
            !!p.gmailThreadId &&
            existing.gmail_thread_id === p.gmailThreadId;

        if (
            existing &&
            existingStatus === 'rejected' &&
            ['applied', 'interview', 'assessment', 'offer'].includes(status) &&
            !sameMessage &&
            !sameInternetMessage &&
            !sameThread
        ) {
            if (p.gmailMessageId) {
                matchDecisionsByMessage.set(p.gmailMessageId, {
                    ...matchDecisionsByMessage.get(p.gmailMessageId)!,
                    matchedApplicationId: null,
                    matchType: 'new_cycle_after_rejection',
                    matchScore: 0,
                    decision: 'create_new',
                    reason: 'Existing application was rejected and the incoming activity was treated as a new application cycle.',
                });
            }
            const batchKey = `${(p.company ?? '').toLowerCase()}::${(p.role ?? '').toLowerCase()}::new`;
            const inBatch = newAppsInBatch.get(batchKey);
            if (inBatch) {
                if ((statusPriority[status] ?? 0) > (statusPriority[inBatch.status] ?? 0)) inBatch.status = status;
            } else {
                newAppsInBatch.set(batchKey, appRecord());
            }
        } else if (existing) {
            const validStatuses = ['applied', 'assessment', 'interview', 'offer', 'rejected'];
            const currentStatus = validStatuses.includes(status) ? status : 'applied';
            const normalizedExisting = validStatuses.includes(existingStatus) ? existingStatus : 'applied';
            const update: Record<string, unknown> = { id: existing.id, last_synced_at: syncTimestamp };
            if ((statusPriority[currentStatus] ?? 0) > (statusPriority[normalizedExisting] ?? 0)) {
                update.status = currentStatus;
            }
            // Backfill internet_message_id on existing apps that predate the column
            if (!existing.internet_message_id && p.internetMessageId) {
                update.internet_message_id = normalizeMessageId(p.internetMessageId);
            }
            if (!existing.gmail_message_id && p.gmailMessageId) {
                update.gmail_message_id = p.gmailMessageId;
            }
            if (!existing.gmail_thread_id && p.gmailThreadId) {
                update.gmail_thread_id = p.gmailThreadId;
            }
            if (!existing.canonical_key && p.canonicalKey) {
                update.canonical_key = p.canonicalKey;
            }
            if (!existing.portal_domain && p.portalDomain) {
                update.portal_domain = p.portalDomain;
            }
            if (!existing.requisition_id && p.requisitionId) {
                update.requisition_id = p.requisitionId;
            }
            if (!existing.job_id && p.jobId) {
                update.job_id = p.jobId;
            }
            if (!existing.role_title && p.role) {
                update.role_title = p.role;
            }
            if (!existing.company && p.company) {
                update.company = p.company;
            }
            if (!existing.role && p.role) {
                update.role = p.role;
            }
            // Keep applied_at as the earliest known email date.
            // If this email is older than the stored applied_at (or applied_at is missing),
            // update it — handles apps that were incorrectly stamped with syncTimestamp.
            if (p.receivedAt) {
                const currentApplied = existing.applied_at ? new Date(existing.applied_at).getTime() : Infinity;
                if (new Date(p.receivedAt).getTime() < currentApplied) {
                    update.applied_at = p.receivedAt;
                }
            }
            if (Object.keys(update).length > 1) updatedApps.push(update);
        } else {
            // New application — deduplicate within this batch by company+role.
            // Also collapse emails from the same Gmail thread into one record even if
            // the company/role fields differ (e.g., recruiter follow-up has no subject).
            const batchKey = `${(p.company ?? '').toLowerCase()}::${(p.role ?? '').toLowerCase()}`;
            const threadKey = p.gmailThreadId ? threadToBatchKey.get(p.gmailThreadId) : undefined;
            const effectiveBatchKey = threadKey ?? batchKey;
            const inBatch = newAppsInBatch.get(effectiveBatchKey);
            if (inBatch) {
                // Already queued — upgrade status if this email has a higher-priority one
                if ((statusPriority[status] ?? 0) > (statusPriority[inBatch.status] ?? 0)) inBatch.status = status;
                // Keep the EARLIEST known email date as applied_at
                if (p.receivedAt && inBatch.applied_at) {
                    if (new Date(p.receivedAt).getTime() < new Date(inBatch.applied_at).getTime()) {
                        inBatch.applied_at = p.receivedAt;
                    }
                }
                // Prefer the canonical_key with the most information
                if (!inBatch.canonical_key && p.canonicalKey) inBatch.canonical_key = p.canonicalKey;
                if (!inBatch.portal_domain && p.portalDomain) inBatch.portal_domain = p.portalDomain;
            } else {
                newAppsInBatch.set(batchKey, appRecord());
                if (p.gmailThreadId) threadToBatchKey.set(p.gmailThreadId, batchKey);
            }
        }
    }

    const newApps = Array.from(newAppsInBatch.values());

    let applicationsInserted = 0;
    let applicationsUpdated = 0;
    let eventsUpserted = 0;
    let tasksUpserted = 0;
    let notificationsInserted = 0;

    async function hydrateAppsByColumn(
        column: 'gmail_message_id' | 'internet_message_id' | 'gmail_thread_id',
        values: string[],
    ) {
        if (!values.length) return;
        const { data, error } = await admin
            .from('applications')
            .select('*')
            .eq('user_id', userId)
            .in(column, values);
        if (error) throw error;
        for (const app of data || []) {
            const existingRegistered = existingAppsById.get(app.id);
            if (existingRegistered) {
                Object.assign(existingRegistered, app);
                registerApp(existingRegistered);
                continue;
            }
            allApps.push(app);
            registerApp(app);
        }
    }

    if (newApps.length) {
        try {
            const appsByMessage = newApps.filter((app) => !!app.gmail_message_id);
            const appsByInternetMessage = newApps.filter((app) => !app.gmail_message_id && !!app.internet_message_id);
            const appsByThread = newApps.filter((app) => !app.gmail_message_id && !app.internet_message_id && !!app.gmail_thread_id);
            const plainApps = newApps.filter((app) => !app.gmail_message_id && !app.internet_message_id && !app.gmail_thread_id);

            if (appsByMessage.length) {
                const { data: insertedByMessage, error: byMessageError } = await admin
                    .from('applications')
                    .upsert(appsByMessage, { onConflict: 'user_id,gmail_message_id', ignoreDuplicates: true })
                    .select('id');
                if (byMessageError) throw byMessageError;
                applicationsInserted += insertedByMessage?.length ?? 0;
                await hydrateAppsByColumn(
                    'gmail_message_id',
                    Array.from(new Set(appsByMessage.map((app) => app.gmail_message_id).filter(Boolean))),
                );
            }

            if (appsByInternetMessage.length) {
                const { data: insertedByInternetMessage, error: byInternetMessageError } = await admin
                    .from('applications')
                    .upsert(appsByInternetMessage, { onConflict: 'user_id,internet_message_id', ignoreDuplicates: true })
                    .select('id');
                if (byInternetMessageError) throw byInternetMessageError;
                applicationsInserted += insertedByInternetMessage?.length ?? 0;
                await hydrateAppsByColumn(
                    'internet_message_id',
                    Array.from(new Set(
                        appsByInternetMessage
                            .map((app) => normalizeMessageId(app.internet_message_id))
                            .filter((value): value is string => Boolean(value)),
                    )),
                );
            }

            if (appsByThread.length) {
                const { data: insertedByThread, error: byThreadError } = await admin
                    .from('applications')
                    .upsert(appsByThread, { onConflict: 'user_id,gmail_thread_id', ignoreDuplicates: true })
                    .select('id');
                if (byThreadError) throw byThreadError;
                applicationsInserted += insertedByThread?.length ?? 0;
                await hydrateAppsByColumn(
                    'gmail_thread_id',
                    Array.from(new Set(appsByThread.map((app) => app.gmail_thread_id).filter(Boolean))),
                );
            }

            if (plainApps.length) {
                const { data: insertedPlain, error: plainInsertError } = await admin
                    .from('applications')
                    .insert(plainApps)
                    .select('*');
                if (plainInsertError) throw plainInsertError;
                applicationsInserted += insertedPlain?.length ?? 0;
                for (const app of insertedPlain || []) {
                    allApps.push(app);
                    registerApp(app);
                }
            }

            console.info(`[writeResults] Inserted ${applicationsInserted} new applications.`);
        } catch (err) {
            console.error('[writeResults] Failed to insert new applications:', err);
        }
    }
    if (updatedApps.length) {
        for (const app of updatedApps) {
            try {
                const { id, ...fields } = app;
                await admin.from('applications').update(fields).eq('id', id);
                console.info(`[writeResults] Updated application ${app.id} to status ${app.status}.`);
                applicationsUpdated += 1;
            } catch (err) {
                console.error(`[writeResults] Failed to update application ${app.id}:`, err);
            }
        }
    }

    // 3. Batch upsert job_email_events
    // Note: raw_subject and raw_snippet were dropped in schema cleanup (2026-02-10).
    // received_at was restored in 20260315000000_restore_received_at.sql.
    const emailEvents = parsed.map(p => ({
        user_id: userId,
        gmail_message_id: p.gmailMessageId ?? null,
        gmail_thread_id: p.gmailThreadId ?? null,
        event_type: p.eventType,
        parsed_company: p.company,
        parsed_role: p.role,
        parsed_status: p.status,
        confidence: p.confidence,
        llm_parsed_json: p.llmParsedJson ?? null,
        canonical_key: p.canonicalKey,
        portal_domain: p.portalDomain,
        requisition_id: p.requisitionId,
        job_id: p.jobId,
        external_application_id: null,
        internet_message_id: normalizeMessageId(p.internetMessageId),
        received_at: p.receivedAt ?? null,
        application_id: findExistingApp(p)?.id ?? null,
    }));
    try {
        await admin.from('job_email_events').upsert(emailEvents, { onConflict: 'user_id,gmail_message_id' });
        eventsUpserted = emailEvents.length;
        console.info(`[writeResults] Upserted ${eventsUpserted} job_email_events.`);
    } catch (err) {
        console.error('[writeResults] Failed to upsert job_email_events:', err);
    }

    // 3c. Correct applied_at for ALL of this user's apps using the DB function.
    // Joins via application_id FK, gmail_thread_id, and gmail_message_id so that
    // historical apps (where the FK may be null) are also fixed. Runs on every sync
    // so that as received_at gets populated in job_email_events, applied_at is
    // progressively corrected. No-op if received_at is still null everywhere.
    try {
        const { data: corrected, error: rpcErr } = await admin
            .rpc('correct_applied_at_for_user', { p_user_id: userId });
        if (rpcErr) throw rpcErr;
        const fixed = Number(corrected) || 0;
        if (fixed > 0) {
            applicationsUpdated += fixed;
            console.info(`[writeResults] correct_applied_at_for_user: fixed ${fixed} apps`);
        }
    } catch (err) {
        console.warn('[writeResults] applied_at correction RPC failed (non-fatal):', err);
    }

    // 4. Batch upsert applications, events, tasks, notifications (placeholder)
    // Only create tasks for recent emails — scheduling tasks for 3-week-old interviews
    // is unhelpful and clutters the home screen.
    const TASK_CUTOFF_MS = 21 * 24 * 60 * 60 * 1000; // 21 days
    const taskCutoffDate = new Date(Date.now() - TASK_CUTOFF_MS);

    // Batch upsert tasks for emails missing explicit dates or for explicitly scheduling
    const tasksBase = parsed
        .filter(p => {
            const normalized = (p.status ?? '').toString();
            // Create scheduling task if it's an interview/assessment but we have NO date
            if (!((normalized === 'Interview' || normalized === 'Assessment') && !p.interviewDate)) return false;
            // Skip tasks from emails older than the cutoff window
            if (p.receivedAt && new Date(p.receivedAt) < taskCutoffDate) return false;
            // null application_id doesn't participate in Postgres unique constraints —
            // every upsert would INSERT a duplicate instead of updating the existing row.
            if (!findExistingApp(p)?.id) return false;
            return true;
        })
        .map(p => {
            const isInterview = (p.status ?? '') === 'Interview';
            let title = '';
            if (isInterview) {
                title = `Schedule Interview: ${p.company ? p.company + ' - ' : ''}${p.role || ''}`.trim();
            } else {
                title = `Schedule Assessment: ${p.company ? p.company + ' - ' : ''}${p.role || ''}`.trim();
            }
            // Give the candidate a nudge deadline: 2 days for interview scheduling,
            // 5 days for assessment completion (no exact deadline was found in the email).
            let due_at: string | null = null;
            if (p.receivedAt) {
                const base = new Date(p.receivedAt);
                base.setDate(base.getDate() + (isInterview ? 2 : 5));
                due_at = base.toISOString();
            }
            return {
                application_id: findExistingApp(p)?.id ?? null,
                title,
                due_at,
                status: 'open',
                origin: 'gmail',
                created_at: new Date().toISOString(),
            };
        });
    if (tasksBase.length) {
        let taskError: any = null;
        for (const ownerId of ownerIds) {
            try {
                await admin.from('tasks').upsert(
                    tasksBase.map((task) => ({ ...task, user_id: ownerId })),
                    { onConflict: 'user_id,application_id,title' },
                );
                tasksUpserted = tasksBase.length;
                console.info(`[writeResults] Upserted ${tasksUpserted} tasks.`);
                taskError = null;
                break;
            } catch (err) {
                taskError = err;
            }
        }
        if (taskError) {
            console.error('[writeResults] Failed to upsert tasks:', taskError);
        }
    }

    // Batch upsert events (interview/assessment) so history is preserved
    const eventsBase = parsed
        .filter(p => {
            if (p.eventType !== 'interview_invite' && p.eventType !== 'assessment') return false;
            // null application_id doesn't participate in Postgres unique constraints —
            // every upsert would INSERT a duplicate instead of updating the existing row.
            if (!findExistingApp(p)?.id) return false;
            return true;
        })
        .map(p => {
            let start_at = p.interviewDate || p.receivedAt || new Date().toISOString();

            // Try to extract meeting link/provider from rawSnippet or rawSubject
            let meeting_link = null;
            let provider = null;
            const linkMatch = (p.rawSnippet || p.rawSubject || '').match(/https?:\/\/(zoom\.us|meet\.google\.com|teams\.microsoft\.com|calendly\.com|goodtime\.io)[^\s]*/i);
            if (linkMatch) {
                meeting_link = linkMatch[0];
                if (linkMatch[1]) provider = linkMatch[1];
            }
            return {
                application_id: findExistingApp(p)?.id ?? null,
                event_type: p.eventType === 'interview_invite' ? 'interview' : 'assessment',
                title: p.eventType === 'interview_invite'
                    ? `Interview: ${p.company ? p.company + ' - ' : ''}${p.role || ''}`.trim()
                    : `Assessment: ${p.company ? p.company + ' - ' : ''}${p.role || ''}`.trim(),
                provider,
                meeting_link,
                start_at,
                end_at: null,
                location: null,
                source_type: 'gmail',
                created_at: new Date().toISOString(),
            };
        });
    if (eventsBase.length) {
        let eventsError: any = null;
        for (const ownerId of ownerIds) {
            try {
                await admin.from('events').upsert(
                    eventsBase.map((event) => ({ ...event, user_id: ownerId })),
                    { onConflict: 'user_id,application_id,event_type,start_at' },
                );
                eventsUpserted = eventsBase.length;
                console.info(`[writeResults] Upserted ${eventsUpserted} events.`);
                eventsError = null;
                break;
            } catch (err) {
                eventsError = err;
            }
        }
        if (eventsError) {
            console.error('[writeResults] Failed to upsert events:', eventsError);
        }
    }

    // Batch insert notifications — only for events that are NEW to the DB.
    // We pre-loaded existingMessageIdSet above to avoid re-notifying on re-syncs.
    const NOTIFY_EVENT_TYPES = new Set(['interview_invite', 'assessment', 'offer', 'rejection']);

    function notificationContent(p: ParsedEmailResult): { title: string; body: string | null } {
        const company = p.company ?? 'a company';
        const role = p.role ? ` for ${p.role}` : '';
        switch (p.eventType) {
            case 'interview_invite':
                return { title: `Interview invite from ${company}`, body: `You received an interview invitation${role}.` };
            case 'assessment':
                return { title: `Assessment from ${company}`, body: `Complete your assessment${role}.` };
            case 'offer':
                return { title: `Offer from ${company}!`, body: `You received an offer${role}. Congratulations!` };
            case 'rejection':
                return { title: `Update from ${company}`, body: `Your application${role} did not move forward.` };
            default:
                return { title: `New update from ${company}`, body: null };
        }
    }

    const notifications = parsed
        .filter(p => {
            if (!NOTIFY_EVENT_TYPES.has(p.eventType)) return false;
            // Skip if this gmail message was already in job_email_events before this run.
            if (p.gmailMessageId && existingMessageIdSet.has(p.gmailMessageId)) return false;
            return true;
        })
        .map(p => {
            const { title, body } = notificationContent(p);
            return {
                user_id: userId,
                type: 'update',
                subtype: p.eventType,
                title,
                body,
                channel: 'in_app',
                entity_type: 'application',
                entity_id: findExistingApp(p)?.id ?? null,
                metadata: { status_to: p.status, event_type: p.eventType },
                created_at: new Date().toISOString(),
            };
        });
    if (notifications.length) {
        try {
            const notificationsToInsert: Record<string, unknown>[] = [...notifications];

            if (notificationMode === 'summary_push') {
                const countsByType = notifications.reduce<Record<string, number>>((acc, item) => {
                    const key = String(item.subtype ?? 'other');
                    acc[key] = (acc[key] ?? 0) + 1;
                    return acc;
                }, {});

                const total = notifications.length;
                const parts: string[] = [];
                if (countsByType.interview_invite) {
                    parts.push(`${countsByType.interview_invite} interview update${countsByType.interview_invite === 1 ? '' : 's'}`);
                }
                if (countsByType.assessment) {
                    parts.push(`${countsByType.assessment} assessment${countsByType.assessment === 1 ? '' : 's'}`);
                }
                if (countsByType.offer) {
                    parts.push(`${countsByType.offer} offer${countsByType.offer === 1 ? '' : 's'}`);
                }
                if (countsByType.rejection) {
                    parts.push(`${countsByType.rejection} application update${countsByType.rejection === 1 ? '' : 's'}`);
                }

                notificationsToInsert.push({
                    user_id: userId,
                    type: 'update',
                    subtype: 'sync_summary',
                    title: parts.length > 0 ? `Gmail sync: ${parts.join(', ')}` : 'Gmail sync updates',
                    body: `Tap to review ${total} new Gmail update${total === 1 ? '' : 's'}.`,
                    channel: 'push',
                    entity_type: null,
                    entity_id: null,
                    metadata: {
                        source: 'gmail_sync',
                        bundled: true,
                        total_count: total,
                        counts_by_type: countsByType,
                    },
                    created_at: new Date().toISOString(),
                });
            }

            await admin.from('notifications').insert(notificationsToInsert);
            notificationsInserted = notificationsToInsert.length;
            console.info(`[writeResults] Inserted ${notificationsInserted} notifications.`);
        } catch (err) {
            console.error('[writeResults] Failed to insert notifications:', err);
        }
    }

    for (const p of parsed) {
        if (!p.gmailMessageId) continue;
        const decision = matchDecisionsByMessage.get(p.gmailMessageId);
        if (!decision || decision.matchedApplicationId) continue;
        const resolved = findExistingApp(p);
        if (resolved?.id) decision.matchedApplicationId = resolved.id;
    }

    return {
        applicationsInserted,
        applicationsUpdated,
        eventsUpserted,
        tasksUpserted,
        notificationsInserted,
        matchDecisions: Array.from(matchDecisionsByMessage.values()),
    };
}
