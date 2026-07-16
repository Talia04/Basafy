// Database operations for Gmail sync

// @ts-ignore Remote Deno import is resolved at runtime by Supabase Edge Functions.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
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
            event_type: parsed.eventType,
            company_name: parsed.company,
            job_title: parsed.role,
            subject: subject,
            sender: from,
            snippet: snippet,
            received_at: receivedAt.toISOString(),
            status: parsed.status,
            interview_date: parsed.interviewDate,
            confidence: parsed.confidence,
            application_id: applicationId || null,
            message_features: parsed.message_features || {},
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
    parsedFeatures: {
        company_name?: string | null;
        roleName?: string | null;
        portalDomain?: string | null;
        jobId?: string | null;
        gmailThreadId?: string | null;
    }
): Promise<ApplicationRecord | null> {
    return findMatchingApplicationSync(applications, parsedFeatures);
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
    canonicalKey: string | null;
}

export function checkDeduplication(
    applications: ApplicationRecord[],
    parsedFeatures: {
        company_name?: string | null;
        roleName?: string | null;
        portalDomain?: string | null;
        jobId?: string | null;
        gmailThreadId?: string | null;
    }
): DeduplicationResult {
    const canonicalKey = buildCanonicalKey({
        company: parsedFeatures.company_name,
        role: parsedFeatures.roleName,
        portalDomain: parsedFeatures.portalDomain ?? undefined,
        jobId: parsedFeatures.jobId ?? undefined,
    });

    // Try to find existing application
    const existing = findMatchingApplicationSync(applications, parsedFeatures);

    return {
        isNew: !existing,
        existingApplication: existing || undefined,
        canonicalKey,
    };
}

function findMatchingApplicationSync(
    applications: ApplicationRecord[],
    features: {
        company_name?: string | null;
        roleName?: string | null;
        portalDomain?: string | null;
        jobId?: string | null;
        gmailThreadId?: string | null;
    }
): ApplicationRecord | null {
    if (!features.company_name && !features.roleName && !features.portalDomain && !features.jobId && !features.gmailThreadId) {
        return null;
    }

    let bestMatch: ApplicationRecord | null = null;
    let maxScore = -1;

    for (const app of applications) {
        let score = 0;

        // Strong signals
        if (features.jobId && app.job_id === features.jobId) score += 100;

        // Medium/Weak signals
        if (features.company_name && app.company_name) {
            if (areSameCompany(app.company_name, features.company_name)) {
                score += 25;
                if (features.roleName && app.role && areSameRole(app.role, features.roleName)) {
                    score += 25; // Boost if roles align
                }
            } else {
                const similarity = computeTokenSimilarity(
                    normalizeCompanyForKey(app.company_name),
                    normalizeCompanyForKey(features.company_name)
                );
                if (similarity > 0.7) {
                    score += 15;
                    if (features.roleName && app.role && areSameRole(app.role, features.roleName)) {
                        score += 20;
                    }
                }
            }
        }

        if (features.portalDomain && app.portal_domain === features.portalDomain) {
            score += 20;
            if (features.roleName && app.role && areSameRole(app.role, features.roleName)) {
                score += 25;
            }
        }

        if (score > maxScore) {
            maxScore = score;
            bestMatch = app;
        }
    }

    const MATCH_THRESHOLD = 20; // Needs at least a company match or strong domain match
    return maxScore >= MATCH_THRESHOLD ? bestMatch : null;
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
                {
                    company_name: parsed.company,
                    roleName: parsed.role,
                    portalDomain: parsed.portalDomain,
                    jobId: parsed.jobId,
                    gmailThreadId: parsed.gmailThreadId,
                }
            );

            let applicationId: string | undefined;
            const eventStatus = statusFromEventType(parsed.eventType);

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
            } else if (parsed.company || parsed.role) {
                // Create new application
                const newApp = await createApplication(
                    supabase,
                    userId,
                    parsed.company,
                    parsed.role,
                    eventStatus || 'Applied',
                    parsed.portalDomain,
                    parsed.jobId
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
                if (['interview_invite', 'offer', 'rejection'].includes(parsed.eventType)) {
                    const { title, body } = buildNotificationContent(
                        parsed.eventType,
                        parsed.company,
                        parsed.role
                    );
                    await createNotification(supabase, userId, parsed.eventType, title, body, applicationId);
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
