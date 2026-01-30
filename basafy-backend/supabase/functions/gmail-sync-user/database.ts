// Database operations for Gmail sync

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { GmailConnection, ParsedEmailResult, ApplicationStatus } from './types.ts';
import {
    normalizeCompanyForKey,
    normalizeRoleForKey,
    buildCanonicalKey,
    areSameCompany,
    areSameRole,
    computeTokenSimilarity,
} from './utils.ts';
import { pickHigherStatus, statusFromEventType } from './parsers.ts';

// ============================================================================
// Supabase Client
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export function getSupabaseClient(): SupabaseClient {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export function getSupabaseAdminClient(): SupabaseClient {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

// ============================================================================
// Gmail Connection Operations
// ============================================================================

export async function getGmailConnection(
    supabase: SupabaseClient,
    userId: string
): Promise<GmailConnection | null> {
    const { data, error } = await supabase
        .from('gmail_connections')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        console.error('Failed to get Gmail connection:', error?.message);
        return null;
    }

    return data as GmailConnection;
}

export async function updateGmailConnection(
    supabase: SupabaseClient,
    userId: string,
    updates: Partial<GmailConnection>
): Promise<boolean> {
    const { error } = await supabase
        .from('gmail_connections')
        .update(updates)
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to update Gmail connection:', error.message);
        return false;
    }

    return true;
}

export async function updateTokens(
    supabase: SupabaseClient,
    userId: string,
    accessToken: string,
    refreshToken?: string
): Promise<boolean> {
    const updates: Partial<GmailConnection> = {
        access_token: accessToken,
        updated_at: new Date().toISOString(),
    };

    if (refreshToken) {
        updates.refresh_token = refreshToken;
    }

    return updateGmailConnection(supabase, userId, updates);
}

export async function recordSyncTimestamp(
    supabase: SupabaseClient,
    userId: string
): Promise<boolean> {
    return updateGmailConnection(supabase, userId, {
        last_synced_at: new Date().toISOString(),
    });
}

// ============================================================================
// Job Email Events Operations
// ============================================================================

export async function getExistingEmailEvents(
    supabase: SupabaseClient,
    userId: string,
    messageIds: string[]
): Promise<Set<string>> {
    if (messageIds.length === 0) return new Set();

    const { data, error } = await supabase
        .from('job_email_events')
        .select('gmail_message_id')
        .eq('user_id', userId)
        .in('gmail_message_id', messageIds);

    if (error) {
        console.error('Failed to get existing email events:', error.message);
        return new Set();
    }

    return new Set(data?.map((e) => e.gmail_message_id) || []);
}

export async function insertEmailEvent(
    supabase: SupabaseClient,
    userId: string,
    messageId: string,
    parsed: ParsedEmailResult,
    subject: string | null,
    from: string | null,
    snippet: string | null,
    receivedAt: Date,
    applicationId?: string
): Promise<string | null> {
    const { data, error } = await supabase
        .from('job_email_events')
        .insert({
            user_id: userId,
            gmail_message_id: messageId,
            event_type: parsed.event_type,
            company_name: parsed.company_name,
            job_title: parsed.job_title,
            subject: subject,
            sender: from,
            snippet: snippet,
            received_at: receivedAt.toISOString(),
            status: parsed.status,
            interview_date: parsed.interview_date,
            confidence: parsed.confidence,
            application_id: applicationId || null,
        })
        .select('id')
        .single();

    if (error) {
        console.error('Failed to insert email event:', error.message);
        return null;
    }

    return data?.id || null;
}

// ============================================================================
// Application Operations
// ============================================================================

export interface ApplicationRecord {
    id: string;
    user_id: string;
    company_name: string | null;
    role: string | null;
    status: string | null;
    portal_domain: string | null;
    job_id: string | null;
    created_at: string;
    updated_at: string;
}

export async function getUserApplications(
    supabase: SupabaseClient,
    userId: string
): Promise<ApplicationRecord[]> {
    const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to get user applications:', error.message);
        return [];
    }

    return data || [];
}

export async function findMatchingApplication(
    applications: ApplicationRecord[],
    companyName: string | null,
    roleName: string | null,
    portalDomain?: string | null,
    jobId?: string | null
): Promise<ApplicationRecord | null> {
    if (!companyName && !roleName && !portalDomain && !jobId) {
        return null;
    }

    // First try exact job_id match (highest confidence)
    if (jobId) {
        const jobIdMatch = applications.find(app => app.job_id === jobId);
        if (jobIdMatch) return jobIdMatch;
    }

    // Then try portal_domain + role match
    if (portalDomain && roleName) {
        const portalMatch = applications.find(app =>
            app.portal_domain === portalDomain && areSameRole(app.role, roleName)
        );
        if (portalMatch) return portalMatch;
    }

    // Then try company + role match
    if (companyName && roleName) {
        // Try exact company match first
        const exactMatch = applications.find(app =>
            areSameCompany(app.company_name, companyName) && areSameRole(app.role, roleName)
        );
        if (exactMatch) return exactMatch;

        // Try fuzzy company match
        const fuzzyMatch = applications.find(app => {
            if (!app.company_name) return false;
            const similarity = computeTokenSimilarity(
                normalizeCompanyForKey(app.company_name),
                normalizeCompanyForKey(companyName)
            );
            return similarity > 0.7 && areSameRole(app.role, roleName);
        });
        if (fuzzyMatch) return fuzzyMatch;
    }

    // Try company-only match if no role
    if (companyName && !roleName) {
        const companyOnlyMatch = applications.find(app =>
            areSameCompany(app.company_name, companyName)
        );
        if (companyOnlyMatch) return companyOnlyMatch;
    }

    return null;
}

export async function createApplication(
    supabase: SupabaseClient,
    userId: string,
    companyName: string | null,
    role: string | null,
    status: ApplicationStatus,
    portalDomain?: string | null,
    jobId?: string | null
): Promise<ApplicationRecord | null> {
    const { data, error } = await supabase
        .from('applications')
        .insert({
            user_id: userId,
            company_name: companyName,
            role: role,
            status: status || 'Applied',
            portal_domain: portalDomain || null,
            job_id: jobId || null,
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create application:', error.message);
        return null;
    }

    return data;
}

export async function updateApplicationStatus(
    supabase: SupabaseClient,
    applicationId: string,
    newStatus: ApplicationStatus,
    currentStatus: string | null
): Promise<boolean> {
    // Only update if new status is higher priority
    const shouldUpdate = pickHigherStatus(newStatus, currentStatus) === newStatus &&
        newStatus !== currentStatus;

    if (!shouldUpdate) {
        return true; // No update needed, but not an error
    }

    const { error } = await supabase
        .from('applications')
        .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

    if (error) {
        console.error('Failed to update application status:', error.message);
        return false;
    }

    return true;
}

export async function linkEmailToApplication(
    supabase: SupabaseClient,
    emailEventId: string,
    applicationId: string
): Promise<boolean> {
    const { error } = await supabase
        .from('job_email_events')
        .update({ application_id: applicationId })
        .eq('id', emailEventId);

    if (error) {
        console.error('Failed to link email to application:', error.message);
        return false;
    }

    return true;
}

// ============================================================================
// Notification Operations
// ============================================================================

export async function createNotification(
    supabase: SupabaseClient,
    userId: string,
    type: string,
    title: string,
    body: string,
    applicationId?: string
): Promise<boolean> {
    const { error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            type: type,
            title: title,
            body: body,
            application_id: applicationId || null,
            read: false,
        });

    if (error) {
        console.error('Failed to create notification:', error.message);
        return false;
    }

    return true;
}

export function buildNotificationContent(
    eventType: string,
    companyName: string | null,
    jobTitle: string | null
): { title: string; body: string } {
    const company = companyName || 'a company';
    const role = jobTitle || 'a position';

    switch (eventType) {
        case 'application_received':
            return {
                title: 'Application Received',
                body: `Your application for ${role} at ${company} has been received.`,
            };
        case 'interview_invite':
            return {
                title: 'Interview Invitation',
                body: `Great news! You've been invited to interview for ${role} at ${company}.`,
            };
        case 'assessment':
            return {
                title: 'Assessment Request',
                body: `${company} has sent you an assessment for the ${role} position.`,
            };
        case 'rejection':
            return {
                title: 'Application Update',
                body: `${company} has provided an update on your ${role} application.`,
            };
        case 'offer':
            return {
                title: 'Job Offer!',
                body: `Congratulations! You've received an offer for ${role} at ${company}.`,
            };
        default:
            return {
                title: 'Application Update',
                body: `You have a new update from ${company} regarding ${role}.`,
            };
    }
}

// ============================================================================
// Deduplication
// ============================================================================

export interface DeduplicationResult {
    isNew: boolean;
    existingApplication?: ApplicationRecord;
    canonicalKey: string;
}

export function checkDeduplication(
    applications: ApplicationRecord[],
    companyName: string | null,
    roleName: string | null,
    portalDomain?: string | null,
    jobId?: string | null
): DeduplicationResult {
    const canonicalKey = buildCanonicalKey(companyName, roleName, portalDomain, jobId);

    // Try to find existing application
    const existing = findMatchingApplicationSync(applications, companyName, roleName, portalDomain, jobId);

    return {
        isNew: !existing,
        existingApplication: existing || undefined,
        canonicalKey,
    };
}

function findMatchingApplicationSync(
    applications: ApplicationRecord[],
    companyName: string | null,
    roleName: string | null,
    portalDomain?: string | null,
    jobId?: string | null
): ApplicationRecord | null {
    if (!companyName && !roleName && !portalDomain && !jobId) {
        return null;
    }

    // Priority 1: Exact job_id match
    if (jobId) {
        const jobIdMatch = applications.find(app => app.job_id === jobId);
        if (jobIdMatch) return jobIdMatch;
    }

    // Priority 2: Portal domain + role
    if (portalDomain && roleName) {
        const portalMatch = applications.find(app =>
            app.portal_domain === portalDomain && areSameRole(app.role, roleName)
        );
        if (portalMatch) return portalMatch;
    }

    // Priority 3: Company + role
    if (companyName && roleName) {
        const exactMatch = applications.find(app =>
            areSameCompany(app.company_name, companyName) && areSameRole(app.role, roleName)
        );
        if (exactMatch) return exactMatch;
    }

    // Priority 4: Company only (for updates to existing applications)
    if (companyName && !roleName) {
        const companyMatch = applications.find(app => areSameCompany(app.company_name, companyName));
        if (companyMatch) return companyMatch;
    }

    return null;
}

// ============================================================================
// Batch Operations
// ============================================================================

export async function processEmailBatch(
    supabase: SupabaseClient,
    userId: string,
    emails: Array<{
        messageId: string;
        parsed: ParsedEmailResult;
        subject: string | null;
        from: string | null;
        snippet: string | null;
        receivedAt: Date;
    }>,
    existingApplications: ApplicationRecord[]
): Promise<{
    processedCount: number;
    newApplications: number;
    updatedApplications: number;
    errors: number;
}> {
    const results = {
        processedCount: 0,
        newApplications: 0,
        updatedApplications: 0,
        errors: 0,
    };

    // Track newly created applications in this batch
    const batchApplications = [...existingApplications];

    for (const email of emails) {
        try {
            const { parsed, messageId, subject, from, snippet, receivedAt } = email;

            // Check for duplicate
            const dedup = checkDeduplication(
                batchApplications,
                parsed.company_name,
                parsed.job_title,
                parsed.portal_domain,
                parsed.job_id
            );

            let applicationId: string | undefined;
            const eventStatus = statusFromEventType(parsed.event_type);

            if (dedup.existingApplication) {
                // Update existing application if status is higher
                applicationId = dedup.existingApplication.id;
                const updated = await updateApplicationStatus(
                    supabase,
                    applicationId,
                    eventStatus,
                    dedup.existingApplication.status
                );
                if (updated) {
                    results.updatedApplications++;
                }
            } else if (parsed.company_name || parsed.job_title) {
                // Create new application
                const newApp = await createApplication(
                    supabase,
                    userId,
                    parsed.company_name,
                    parsed.job_title,
                    eventStatus || 'Applied',
                    parsed.portal_domain,
                    parsed.job_id
                );
                if (newApp) {
                    applicationId = newApp.id;
                    batchApplications.push(newApp);
                    results.newApplications++;
                }
            }

            // Insert email event
            const eventId = await insertEmailEvent(
                supabase,
                userId,
                messageId,
                parsed,
                subject,
                from,
                snippet,
                receivedAt,
                applicationId
            );

            if (eventId) {
                results.processedCount++;

                // Create notification for significant events
                if (['interview_invite', 'offer', 'rejection'].includes(parsed.event_type)) {
                    const { title, body } = buildNotificationContent(
                        parsed.event_type,
                        parsed.company_name,
                        parsed.job_title
                    );
                    await createNotification(supabase, userId, parsed.event_type, title, body, applicationId);
                }
            } else {
                results.errors++;
            }
        } catch (error) {
            console.error('Error processing email:', error);
            results.errors++;
        }
    }

    return results;
}
