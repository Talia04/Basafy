// Stage 3: Batch write parsed results to DB
import { SupabaseClient } from '@supabase/supabase-js';
import { ParsedEmail } from './types';

export interface WriteOpts {
    userId: string;
    admin: SupabaseClient;
}

export async function writeResults(parsed: ParsedEmail[], opts: WriteOpts): Promise<void> {
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

    for (const p of parsed) {
        const key = p.canonical_key;
        const existing = key ? appsByKey.get(key) : undefined;
        // If existing app is rejected and new status is Interview/Assessment/Offer, create new app
        if (existing && existing.status === 'Rejected' && ['Interview', 'Assessment', 'Offer'].includes(p.status)) {
            newApps.push({
                user_id: userId,
                company: p.company,
                role: p.role,
                role_title: p.role,
                status: p.status,
                source_type: 'gmail',
                gmail_message_id: p.gmail_message_id,
                gmail_thread_id: p.gmail_thread_id,
                email_snippet: p.raw_snippet,
                last_synced_at: p.received_at,
                canonical_key: p.canonical_key,
                portal_domain: p.portal_domain,
                requisition_id: p.requisition_id,
                job_id: p.job_id,
                external_application_id: p.external_application_id,
            });
        } else if (existing) {
            // Update status if new status is higher
            const statusPriority = { 'Applied': 1, 'Assessment': 2, 'Interview': 3, 'Offer': 4, 'Rejected': 0 };
            if (statusPriority[p.status] > statusPriority[existing.status]) {
                updatedApps.push({
                    id: existing.id,
                    status: p.status,
                    last_synced_at: p.received_at,
                });
            }
        } else {
            // New app
            newApps.push({
                user_id: userId,
                company: p.company,
                role: p.role,
                role_title: p.role,
                status: p.status,
                source_type: 'gmail',
                gmail_message_id: p.gmail_message_id,
                gmail_thread_id: p.gmail_thread_id,
                email_snippet: p.raw_snippet,
                last_synced_at: p.received_at,
                canonical_key: p.canonical_key,
                portal_domain: p.portal_domain,
                requisition_id: p.requisition_id,
                job_id: p.job_id,
                external_application_id: p.external_application_id,
            });
        }
    }

    if (newApps.length) {
        await admin.from('applications').insert(newApps);
    }
    if (updatedApps.length) {
        for (const app of updatedApps) {
            await admin.from('applications').update({ status: app.status, last_synced_at: app.last_synced_at }).eq('id', app.id);
        }
    }

    // 3. Batch upsert job_email_events
    const emailEvents = parsed.map(p => ({
        user_id: userId,
        gmail_message_id: p.gmail_message_id,
        gmail_thread_id: p.gmail_thread_id,
        raw_subject: p.raw_subject,
        raw_from: p.raw_from,
        raw_snippet: p.raw_snippet,
        received_at: p.received_at,
        event_type: p.event_type,
        parsed_company: p.company,
        parsed_role: p.role,
        parsed_status: p.status,
        confidence: p.confidence,
        llm_parsed_json: p.llm_parsed_json,
        canonical_key: p.canonical_key,
        portal_domain: p.portal_domain,
        requisition_id: p.requisition_id,
        job_id: p.job_id,
        external_application_id: p.external_application_id,
    }));
    await admin.from('job_email_events').upsert(emailEvents, { onConflict: ['user_id', 'gmail_message_id'] });

    // 4. Batch upsert applications, events, tasks, notifications (placeholder)
    // ...existing code...
}
