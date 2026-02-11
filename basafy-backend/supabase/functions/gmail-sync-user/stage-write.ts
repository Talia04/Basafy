// Stage 3: Batch write parsed results to DB
import { SupabaseClient } from '@supabase/supabase-js';
import { ParsedEmailResult } from './types';

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

    const statusPriority = { 'Applied': 1, 'Assessment': 2, 'Interview': 3, 'Offer': 4, 'Rejected': 0 };

    for (const p of parsed) {
        const key = p.canonicalKey;
        const existing = key ? appsByKey.get(key) : undefined;
        const status = p.status ?? 'Applied';
        // If existing app is rejected and new status is Interview/Assessment/Offer, create new app
        if (existing && existing.status === 'Rejected' && ['Interview', 'Assessment', 'Offer'].includes(status)) {
            newApps.push({
                user_id: userId,
                company: p.company,
                role: p.role,
                role_title: p.role,
                status,
                source_type: 'gmail',
                gmail_message_id: p.gmailMessageId ?? null,
                gmail_thread_id: p.gmailThreadId ?? null,
                email_snippet: p.rawSnippet ?? null,
                last_synced_at: syncTimestamp,
                canonical_key: p.canonicalKey,
                portal_domain: p.portalDomain,
                requisition_id: p.requisitionId,
                job_id: p.jobId,
                external_application_id: null,
            });
        } else if (existing) {
            const validStatuses = ['Applied', 'Assessment', 'Interview', 'Offer', 'Rejected'] as const;
            type StatusType = typeof validStatuses[number];
            const currentStatus: StatusType = validStatuses.includes(status as StatusType) ? status as StatusType : 'Applied';
            const existingStatus: StatusType = validStatuses.includes((existing.status ?? 'Applied') as StatusType) ? (existing.status ?? 'Applied') as StatusType : 'Applied';
            if (statusPriority[currentStatus] > statusPriority[existingStatus]) {
                updatedApps.push({
                    id: existing.id,
                    status,
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
                gmail_message_id: p.gmailMessageId ?? null,
                gmail_thread_id: p.gmailThreadId ?? null,
                email_snippet: p.rawSnippet ?? null,
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
            const { data: inserted } = await admin
                .from('applications')
                .insert(newApps)
                .select('id, canonical_key');
            applicationsInserted = inserted?.length ?? newApps.length;
            (inserted || []).forEach((app: any) => {
                if (app?.canonical_key) appsByKey.set(app.canonical_key, app);
            });
            console.info(`[writeResults] Inserted ${applicationsInserted} new applications.`);
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
    // Batch upsert tasks
    const tasks = parsed
        .filter(p => p.status === 'Interview' || p.status === 'Assessment')
        .map(p => ({
            user_id: userId,
            application_id: p.canonicalKey ? (appsByKey.get(p.canonicalKey)?.id ?? null) : null,
            title: p.status === 'Interview' ? 'Interview Preparation' : 'Assessment Preparation',
            due_at: null,
            status: 'pending',
            created_at: new Date().toISOString(),
        }));
    if (tasks.length) {
        try {
            await admin.from('tasks').upsert(tasks, { onConflict: 'user_id,application_id,title,due_at' });
            tasksUpserted = tasks.length;
            console.info(`[writeResults] Upserted ${tasksUpserted} tasks.`);
        } catch (err) {
            console.error('[writeResults] Failed to upsert tasks:', err);
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
