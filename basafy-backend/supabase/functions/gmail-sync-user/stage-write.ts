// Stage 3: Batch write parsed results to DB
// @ts-ignore
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { ParsedEmailResult } from './types.ts';

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

    // 1. Batch-load all user's existing applications
    const { data: existingApps, error: appLoadError } = await admin
        .from('applications')
        .select('*')
        .eq('user_id', userId);
    if (appLoadError) throw appLoadError;

    // 2. Match parsed emails to applications in memory
    const appsByKey = new Map<string, any>();
    for (const app of existingApps) {
        if (app.canonical_key) appsByKey.set(app.canonical_key, app);
    }

    const newApps: any[] = [];
    const updatedApps: any[] = [];

    const statusPriority: Record<string, number> = {
        applied: 1,
        assessment: 2,
        interview: 3,
        offer: 4,
        rejected: 0,
    };

    for (const p of parsed) {
        const key = p.canonicalKey;
        const existing = key ? appsByKey.get(key) : undefined;
        const statusRaw = (p.status ?? 'Applied').toString();
        const status = statusRaw.toLowerCase();
        // If existing app is rejected and new status is Interview/Assessment/Offer, create new app
        const existingStatus = (existing?.status ?? '').toString().toLowerCase();
        if (existing && existingStatus === 'rejected' && ['interview', 'assessment', 'offer'].includes(status)) {
            newApps.push({
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
            newApps.push({
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
        }
    }

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
                .select('id, canonical_key');
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
                    .select('id, canonical_key');
                if (fallbackError) {
                    console.error('[writeResults] Fallback insert failed:', fallbackError);
                } else {
                    applicationsInserted = fallbackInserted?.length ?? 0;
                    (fallbackInserted || []).forEach((app: any) => {
                        if (app?.canonical_key) appsByKey.set(app.canonical_key, app);
                    });
                    console.info(`[writeResults] Fallback inserted ${applicationsInserted} applications.`);
                }
            } else {
                applicationsInserted = inserted?.length ?? 0;
                (inserted || []).forEach((app: any) => {
                    if (app?.canonical_key) appsByKey.set(app.canonical_key, app);
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
    const emailEvents = parsed.map(p => ({
        user_id: userId,
        gmail_message_id: p.gmailMessageId ?? null,
        gmail_thread_id: p.gmailThreadId ?? null,
        raw_subject: p.rawSubject ?? null,
        raw_from: p.rawFrom ?? null,
        raw_snippet: p.rawSnippet ?? null,
        received_at: p.receivedAt ?? syncTimestamp,
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
        application_id: p.canonicalKey ? (appsByKey.get(p.canonicalKey)?.id ?? null) : null,
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
                application_id: p.canonicalKey ? (appsByKey.get(p.canonicalKey)?.id ?? null) : null,
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
                application_id: p.canonicalKey ? (appsByKey.get(p.canonicalKey)?.id ?? null) : null,
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

    // Batch upsert notifications
    const notifications = parsed
        .filter(p => p.status === 'Offer' || p.status === 'Rejected')
        .map(p => ({
            user_id: userId,
            subtype: p.status,
            entity_id: p.canonicalKey ? (appsByKey.get(p.canonicalKey)?.id ?? null) : null,
            metadata: { status_to: p.status },
            created_at: new Date().toISOString(),
        }));
    if (notifications.length) {
        try {
            await admin.from('notifications').insert(notifications);
            notificationsInserted = notifications.length;
            console.info(`[writeResults] Inserted ${notificationsInserted} notifications.`);
        } catch (err) {
            console.error('[writeResults] Failed to upsert notifications:', err);
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
