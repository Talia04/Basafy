// Stage 3: Batch write parsed results to DB
// @ts-ignore
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { ParsedEmailResult } from './types.ts';
import { normalizeCompanyForKey, areSameCompany, areSameRole } from './utils.ts';

export interface WriteOpts {
    userId: string;
    admin: SupabaseClient;
}

export interface WriteSummary {
    applicationsInserted: number;
    applicationsUpdated: number;
    eventsUpserted: number;
    tasksUpserted: number;
    notificationsInserted: number;
}

export async function writeResults(parsed: ParsedEmailResult[], opts: WriteOpts): Promise<WriteSummary> {
    const { userId, admin } = opts;
    const syncTimestamp = new Date().toISOString();
    const { data: profileRow } = await admin
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
    const profileId = (profileRow as any)?.id ?? null;
    const ownerIds = Array.from(new Set([userId, profileId].filter(Boolean))) as string[];

    // 1a. Pre-load existing gmail_message_ids so we can skip notifications for already-seen emails.
    const incomingMessageIds = parsed
        .map(p => p.gmailMessageId)
        .filter((id): id is string => Boolean(id));
    const existingMessageIdSet = new Set<string>();
    if (incomingMessageIds.length > 0) {
        const { data: existingEvents } = await admin
            .from('job_email_events')
            .select('gmail_message_id')
            .eq('user_id', userId)
            .in('gmail_message_id', incomingMessageIds);
        for (const row of existingEvents || []) {
            if (row.gmail_message_id) existingMessageIdSet.add(row.gmail_message_id);
        }
    }

    // 1b. Batch-load all user's existing applications
    const { data: existingApps, error: appLoadError } = await admin
        .from('applications')
        .select('*')
        .eq('user_id', userId);
    if (appLoadError) throw appLoadError;

    // 2. Build lookup indexes for application matching
    const appsByKey = new Map<string, any>();          // canonical_key -> app (exact)
    const appsByNormCompany = new Map<string, any[]>(); // normalizedCompany -> apps[] (fuzzy)
    const existingAppsById = new Map<string, any>();   // id -> app

    for (const app of existingApps) {
        existingAppsById.set(app.id, app);
        if (app.canonical_key) appsByKey.set(app.canonical_key, app);
        if (app.company) {
            const normKey = normalizeCompanyForKey(app.company);
            if (!appsByNormCompany.has(normKey)) appsByNormCompany.set(normKey, []);
            appsByNormCompany.get(normKey)!.push(app);
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
        // Tier 1: Exact canonical key (company + role + portal/job suffix)
        if (p.canonicalKey) {
            const byKey = appsByKey.get(p.canonicalKey);
            if (byKey) return byKey;
        }

        if (!p.company) return undefined;

        const normCompany = normalizeCompanyForKey(p.company);
        const companyApps = appsByNormCompany.get(normCompany) ?? [];

        // Tier 2: Company + role fuzzy match
        // Catches the same canonical key when suffix differs (portal domain present on one email but not the other)
        if (p.role) {
            for (const app of companyApps) {
                if (app.role && areSameCompany(p.company, app.company) && areSameRole(p.role, app.role)) {
                    return app;
                }
            }
            // Wider scan: catch companies whose normalized form differs slightly
            for (const app of existingApps) {
                if (!app.company || !app.role) continue;
                if (areSameCompany(p.company, app.company) && areSameRole(p.role, app.role)) {
                    return app;
                }
            }
        }

        // Tier 3: Company-only match when unambiguous and status is a logical follow-up.
        // If user has exactly one application at this company, a rejection/interview from
        // that company almost certainly belongs to that application.
        const validCompanyApps = companyApps.filter(app => areSameCompany(p.company!, app.company));
        if (validCompanyApps.length === 1) {
            const candidate = validCompanyApps[0];
            const existingStatus = (candidate.status ?? '').toLowerCase();
            const newStatus = (p.status ?? 'other').toLowerCase();
            if (isStatusFollowUp(existingStatus, newStatus)) {
                return candidate;
            }
        }

        return undefined;
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

    for (const p of parsed) {
        const existing = findExistingApp(p);
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
        if (existing && existingStatus === 'rejected' && ['applied', 'interview', 'assessment', 'offer'].includes(status)) {
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
            if ((statusPriority[currentStatus] ?? 0) > (statusPriority[normalizedExisting] ?? 0)) {
                updatedApps.push({
                    id: existing.id,
                    status: currentStatus,
                    last_synced_at: syncTimestamp,
                });
            }
        } else {
            // New application — deduplicate within this batch by company+role
            const batchKey = `${(p.company ?? '').toLowerCase()}::${(p.role ?? '').toLowerCase()}`;
            const inBatch = newAppsInBatch.get(batchKey);
            if (inBatch) {
                // Already queued — upgrade status if this email has a higher-priority one
                if ((statusPriority[status] ?? 0) > (statusPriority[inBatch.status] ?? 0)) inBatch.status = status;
                // Prefer the canonical_key with the most information
                if (!inBatch.canonical_key && p.canonicalKey) inBatch.canonical_key = p.canonicalKey;
                if (!inBatch.portal_domain && p.portalDomain) inBatch.portal_domain = p.portalDomain;
            } else {
                newAppsInBatch.set(batchKey, appRecord());
            }
        }
    }

    const newApps = Array.from(newAppsInBatch.values());

    let applicationsInserted = 0;
    let applicationsUpdated = 0;
    let eventsUpserted = 0;
    let tasksUpserted = 0;
    let notificationsInserted = 0;

    if (newApps.length) {
        try {
            const { data: inserted, error: insertError } = await admin
                .from('applications')
                .insert(newApps)
                .select('id, canonical_key, company, role');
            if (insertError) {
                console.error('[writeResults] Failed to insert new applications:', insertError);
                const minimalApps = newApps.map((app) => ({
                    user_id: app.user_id,
                    company: app.company ?? null,
                    role: app.role ?? null,
                    status: app.status ?? null,
                    is_hidden: app.is_hidden ?? false,
                    applied_at: app.applied_at ?? syncTimestamp,
                }));
                const { data: fallbackInserted, error: fallbackError } = await admin
                    .from('applications')
                    .insert(minimalApps)
                    .select('id, canonical_key, company, role');
                if (fallbackError) {
                    console.error('[writeResults] Fallback insert failed:', fallbackError);
                } else {
                    applicationsInserted = fallbackInserted?.length ?? 0;
                    (fallbackInserted || []).forEach((app: any) => {
                        existingAppsById.set(app.id, app);
                        if (app?.canonical_key) appsByKey.set(app.canonical_key, app);
                        if (app?.company) {
                            const normKey = normalizeCompanyForKey(app.company);
                            if (!appsByNormCompany.has(normKey)) appsByNormCompany.set(normKey, []);
                            appsByNormCompany.get(normKey)!.push(app);
                        }
                    });
                    console.info(`[writeResults] Fallback inserted ${applicationsInserted} applications.`);
                }
            } else {
                applicationsInserted = inserted?.length ?? 0;
                (inserted || []).forEach((app: any) => {
                    existingAppsById.set(app.id, app);
                    if (app?.canonical_key) appsByKey.set(app.canonical_key, app);
                    if (app?.company) {
                        const normKey = normalizeCompanyForKey(app.company);
                        if (!appsByNormCompany.has(normKey)) appsByNormCompany.set(normKey, []);
                        appsByNormCompany.get(normKey)!.push(app);
                    }
                });
                console.info(`[writeResults] Inserted ${applicationsInserted} new applications.`);
            }
        } catch (err) {
            console.error('[writeResults] Failed to insert new applications:', err);
        }
    }
    if (updatedApps.length) {
        for (const app of updatedApps) {
            try {
                await admin.from('applications').update({ status: app.status, last_synced_at: app.last_synced_at }).eq('id', app.id);
                console.info(`[writeResults] Updated application ${app.id} to status ${app.status}.`);
                applicationsUpdated += 1;
            } catch (err) {
                console.error(`[writeResults] Failed to update application ${app.id}:`, err);
            }
        }
    }

    // 3. Batch upsert job_email_events
    // Note: raw_subject, raw_snippet, received_at were dropped in schema cleanup (2026-02-10).
    const emailEvents = parsed.map(p => ({
        user_id: userId,
        gmail_message_id: p.gmailMessageId ?? null,
        gmail_thread_id: p.gmailThreadId ?? null,
        event_type: p.eventType,
        parsed_company: p.company,
        parsed_role: p.role,
        parsed_status: p.status,
        confidence: p.confidence,
        llm_parsed_json: null,
        canonical_key: p.canonicalKey,
        portal_domain: p.portalDomain,
        requisition_id: p.requisitionId,
        job_id: p.jobId,
        external_application_id: null,
        internet_message_id: p.internetMessageId ?? null,
        application_id: findExistingApp(p)?.id ?? null,
    }));
    try {
        await admin.from('job_email_events').upsert(emailEvents, { onConflict: 'user_id,gmail_message_id' });
        eventsUpserted = emailEvents.length;
        console.info(`[writeResults] Upserted ${eventsUpserted} job_email_events.`);
    } catch (err) {
        console.error('[writeResults] Failed to upsert job_email_events:', err);
    }

    // 4. Batch upsert applications, events, tasks, notifications (placeholder)
    // Batch upsert tasks for emails missing explicit dates or for explicitly scheduling
    const tasksBase = parsed
        .filter(p => {
            const normalized = (p.status ?? '').toString();
            // Create scheduling task if it's an interview/assessment but we have NO date
            return (normalized === 'Interview' || normalized === 'Assessment') && !p.interviewDate;
        })
        .map(p => {
            let title = '';
            if ((p.status ?? '') === 'Interview') {
                title = `Schedule Interview: ${p.company ? p.company + ' - ' : ''}${p.role || ''}`.trim();
            } else {
                title = `Schedule Assessment: ${p.company ? p.company + ' - ' : ''}${p.role || ''}`.trim();
            }
            return {
                application_id: findExistingApp(p)?.id ?? null,
                title,
                due_at: null, // Open task, no explicit deadline known
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
                    { onConflict: 'user_id,application_id,title,due_at' },
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
        .filter(p => p.eventType === 'interview_invite' || p.eventType === 'assessment')
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
    const notifications = parsed
        .filter(p => {
            if (!NOTIFY_EVENT_TYPES.has(p.eventType)) return false;
            // Skip if this gmail message was already in job_email_events before this run.
            if (p.gmailMessageId && existingMessageIdSet.has(p.gmailMessageId)) return false;
            return true;
        })
        .map(p => ({
            user_id: userId,
            subtype: p.eventType,
            entity_id: findExistingApp(p)?.id ?? null,
            metadata: { status_to: p.status, event_type: p.eventType },
            created_at: new Date().toISOString(),
        }));
    if (notifications.length) {
        try {
            await admin.from('notifications').insert(notifications);
            notificationsInserted = notifications.length;
            console.info(`[writeResults] Inserted ${notificationsInserted} notifications.`);
        } catch (err) {
            console.error('[writeResults] Failed to insert notifications:', err);
        }
    }

    return {
        applicationsInserted,
        applicationsUpdated,
        eventsUpserted,
        tasksUpserted,
        notificationsInserted,
    };
}
