// Input validation schemas using Zod
// @ts-ignore
import { z } from 'https://esm.sh/zod@3.22.4';

// ============================================================================
// Request Body Schema
// ============================================================================

/**
 * Accept any value for lookback_months — the query-builder sanitizes it.
 */
const LookbackMonthsSchema = z.any();
export const SyncModeSchema = z.enum([
    'light_preview',
    'wrapped_deep_sync',
    'app_background_sync',
    'manual_full_sync',
    'mobile_onboarding_sync',
    'mobile_incremental_sync',
    'mobile_manual_refresh',
    'mobile_recovery_sync',
]);
export type SyncMode = z.infer<typeof SyncModeSchema>;
export const SyncContextSchema = z.enum([
    'wrapped',
    'mobile_onboarding',
    'mobile_incremental',
    'mobile_manual_refresh',
    'mobile_recovery',
]);
export type SyncContext = z.infer<typeof SyncContextSchema>;

/**
 * Base request body schema for gmail-sync-user endpoint
 */
const GmailSyncRequestBaseSchema = z.object({
    // OAuth/Connection fields
    refresh_token: z.string().min(1).max(2048).nullable().optional(),
    email: z.string().email().max(320).nullable().optional(),
    server_auth_code: z.string().min(1).max(2048).nullable().optional(),
    provider: z.string().max(50).nullable().optional(),
    sync_mode: SyncModeSchema.nullable().optional(),
    sync_context: SyncContextSchema.nullable().optional(),
    gmail_sync_session_id: z.string().uuid().nullable().optional(),
    wrapped_session_id: z.string().uuid().nullable().optional(),

    // Sync mode flags (mutually exclusive ideally)
    hard_sync: z.boolean().optional().default(false),
    light_sync: z.boolean().optional().default(false),
    enrich_only: z.boolean().optional().default(false),
    seed_only: z.boolean().optional().default(false),
    bucketed_retrieval: z.boolean().optional().default(false),

    // Pagination and limits
    page_token: z.string().max(2048).nullable().optional(),
    max_messages: z.number().int().min(1).max(500).nullable().optional(),
    max_pages: z.number().int().min(1).max(20).nullable().optional(),
    lookback_months: LookbackMonthsSchema,
    priority_domains: z.array(z.string().min(1).max(253)).max(50).nullable().optional(),
}).passthrough(); // Allow unknown fields for backwards compatibility

type GmailSyncRequestBase = z.infer<typeof GmailSyncRequestBaseSchema>;

/**
 * Main request body schema with refinement for mutual exclusivity
 */
export const GmailSyncRequestSchema = GmailSyncRequestBaseSchema.refine(
    (data: GmailSyncRequestBase) => {
        // Ensure mutually exclusive sync modes
        const modes = [data.hard_sync, data.light_sync, data.enrich_only, data.seed_only].filter(Boolean);
        return modes.length <= 1;
    },
    {
        message: 'Only one sync mode can be enabled at a time (hard_sync, light_sync, enrich_only, or seed_only)',
    }
);

export type GmailSyncRequest = z.infer<typeof GmailSyncRequestSchema>;

// ============================================================================
// Validated Request Type
// ============================================================================

export interface ValidatedSyncParams {
    refreshToken: string | null;
    email: string | null;
    serverAuthCode: string | null;
    provider: string | null;
    hardSync: boolean;
    lightSync: boolean;
    enrichOnly: boolean;
    seedOnly: boolean;
    pageToken: string | null;
    maxMessages: number;
    lookbackMonths: string | number | null;
    priorityDomains: string[] | null;
    bucketedRetrieval: boolean;
    maxPages: number;
    syncMode: SyncMode;
    syncContext: SyncContext | null;
    gmailSyncSessionId: string | null;
}

// ============================================================================
// Validation Function
// ============================================================================

export function validateSyncRequest(
    rawBody: unknown,
    userEmail: string | null
): { success: true; data: ValidatedSyncParams } | { success: false; error: string } {
    // Handle empty/null body or empty object
    if (rawBody === null || rawBody === undefined ||
        (typeof rawBody === 'object' && Object.keys(rawBody as object).length === 0)) {
        return {
            success: true,
            data: {
                refreshToken: null,
                email: userEmail,
                serverAuthCode: null,
                provider: null,
                hardSync: false,
                lightSync: false,
                enrichOnly: false,
                seedOnly: false,
                pageToken: null,
                maxMessages: 100,
                lookbackMonths: null,
                priorityDomains: null,
                bucketedRetrieval: false,
                maxPages: 10,
                syncMode: 'app_background_sync',
                syncContext: null,
                gmailSyncSessionId: null,
            },
        };
    }

    // Validate against schema
    const result = GmailSyncRequestSchema.safeParse(rawBody);

    if (!result.success) {
        const errors = result.error.issues.map((issue: z.ZodIssue) => {
            const path = issue.path.join('.');
            return path ? `${path}: ${issue.message}` : issue.message;
        });
        return {
            success: false,
            error: `Invalid request: ${errors.join('; ')}`,
        };
    }

    const data = result.data;
    const syncMode: SyncMode = data.sync_mode ?? (
        data.hard_sync
            ? 'manual_full_sync'
            : data.light_sync
                ? 'light_preview'
                : 'app_background_sync'
    );
    const inferredContext: SyncContext | null = data.sync_context ?? (
        syncMode === 'wrapped_deep_sync'
            ? 'wrapped'
            : syncMode === 'mobile_onboarding_sync'
                ? 'mobile_onboarding'
                : syncMode === 'mobile_incremental_sync'
                    ? 'mobile_incremental'
                    : syncMode === 'mobile_manual_refresh'
                        ? 'mobile_manual_refresh'
                        : syncMode === 'mobile_recovery_sync'
                            ? 'mobile_recovery'
                            : null
    );

    // Calculate effective max_messages based on sync mode
    const defaultMaxMessages = syncMode === 'manual_full_sync'
        ? 200
        : inferredContext
            ? 10
            : syncMode === 'light_preview'
                ? 40
                : 100;
    const requestedMaxMessages = data.max_messages ?? defaultMaxMessages;
    const maxMessages = inferredContext
        ? Math.min(requestedMaxMessages, 10)
        : requestedMaxMessages;

    return {
        success: true,
        data: {
            refreshToken: data.refresh_token ?? null,
            email: data.email ?? userEmail,
            serverAuthCode: data.server_auth_code ?? null,
            provider: data.provider ?? null,
            hardSync: syncMode === 'manual_full_sync' || (data.hard_sync ?? false),
            lightSync: syncMode === 'light_preview' || (data.light_sync ?? false),
            enrichOnly: data.enrich_only ?? false,
            seedOnly: data.seed_only ?? false,
            pageToken: data.page_token ?? null,
            maxMessages,
            lookbackMonths: data.lookback_months ?? null,
            priorityDomains: data.priority_domains ?? null,
            bucketedRetrieval: Boolean(inferredContext) || syncMode === 'manual_full_sync' || (data.bucketed_retrieval ?? false),
            maxPages: data.max_pages ?? 10,
            syncMode,
            syncContext: inferredContext,
            gmailSyncSessionId: data.gmail_sync_session_id ?? data.wrapped_session_id ?? null,
        },
    };
}

// ============================================================================
// Sanitization Helpers
// ============================================================================

/**
 * Sanitize a string to prevent log injection attacks
 */
export function sanitizeForLog(input: string | null | undefined, maxLength = 100): string {
    if (!input) return '[empty]';
    // Remove control characters and newlines
    const sanitized = input
        .replace(/[\x00-\x1F\x7F]/g, '')
        .substring(0, maxLength);
    return sanitized.length < input.length ? `${sanitized}...` : sanitized;
}

/**
 * Validate that a string looks like a valid Gmail message ID
 */
export function isValidGmailMessageId(id: string | null | undefined): boolean {
    if (!id) return false;
    // Gmail message IDs are base64url encoded, typically 16+ chars
    return /^[A-Za-z0-9_-]{10,}$/.test(id);
}

/**
 * Validate that a string looks like a valid page token
 */
export function isValidPageToken(token: string | null | undefined): boolean {
    if (!token) return true; // null/undefined is valid (no pagination)
    // Page tokens are typically base64 encoded
    return /^[A-Za-z0-9+/=_-]+$/.test(token) && token.length <= 2048;
}
