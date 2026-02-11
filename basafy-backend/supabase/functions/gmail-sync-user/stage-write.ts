// Stage 3: Batch write parsed results to DB
import { SupabaseClient } from '@supabase/supabase-js';
import { ParsedEmailResult } from './types';

export interface WriteOpts {
    userId: string;
    admin: SupabaseClient;
}

export async function writeResults(parsed: ParsedEmailResult[], opts: WriteOpts): Promise<void> {
    const { userId, admin } = opts;

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
                gmail_message_id: null,
                gmail_thread_id: null,
                email_snippet: null,
                last_synced_at: null,
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
                    last_synced_at: null,
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
                gmail_message_id: null,
                gmail_thread_id: null,
                email_snippet: null,
                last_synced_at: null,
                canonical_key: p.canonicalKey,
                portal_domain: p.portalDomain,
                requisition_id: p.requisitionId,
                job_id: p.jobId,
                external_application_id: null,
            });
        }
    }

    if (newApps.length) {
        try {
            await admin.from('applications').insert(newApps);
            console.info(`[writeResults] Inserted ${newApps.length} new applications.`);
        } catch (err) {
            console.error('[writeResults] Failed to insert new applications:', err);
        }
    }
    if (updatedApps.length) {
        for (const app of updatedApps) {
            try {
                await admin.from('applications').update({ status: app.status, last_synced_at: app.last_synced_at }).eq('id', app.id);
                console.info(`[writeResults] Updated application ${app.id} to status ${app.status}.`);
            } catch (err) {
                console.error(`[writeResults] Failed to update application ${app.id}:`, err);
            }
        }
    }

    // 3. Batch upsert job_email_events
    const emailEvents = parsed.map(p => ({
        user_id: userId,
        gmail_message_id: null,
        gmail_thread_id: null,
        raw_subject: null,
        raw_from: null,
        raw_snippet: null,
        received_at: null,
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
    }));
    try {
        await admin.from('job_email_events').upsert(emailEvents, { onConflict: 'user_id' });
        console.info(`[writeResults] Upserted ${emailEvents.length} job_email_events.`);
    } catch (err) {
        console.error('[writeResults] Failed to upsert job_email_events:', err);
    }

    // 4. Batch upsert applications, events, tasks, notifications (placeholder)
    // Batch upsert tasks
    const tasks = parsed
        .filter(p => p.status === 'Interview' || p.status === 'Assessment')
        .map(p => ({
            user_id: userId,
            application_id: p.jobId ?? null,
            title: p.status === 'Interview' ? 'Interview Preparation' : 'Assessment Preparation',
            due_at: null,
            status: 'pending',
            created_at: new Date().toISOString(),
        }));
    if (tasks.length) {
        try {
            await admin.from('tasks').upsert(tasks, { onConflict: 'user_id,application_id,title,due_at' });
            console.info(`[writeResults] Upserted ${tasks.length} tasks.`);
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
            entity_id: p.jobId ?? null,
            metadata: { status_to: p.status },
            created_at: new Date().toISOString(),
        }));
    if (notifications.length) {
        try {
            await admin.from('notifications').upsert(notifications, { onConflict: 'user_id,subtype,entity_id' });
            console.info(`[writeResults] Upserted ${notifications.length} notifications.`);
        } catch (err) {
            console.error('[writeResults] Failed to upsert notifications:', err);
        }
    }

}
