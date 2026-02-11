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
    // (deduplication, status promotion, etc. — placeholder for now)

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
