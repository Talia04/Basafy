import { Session } from '@supabase/supabase-js';
import { syncGmailApplications } from './gmailIntegration';

// ============================================================================
// Sync Progress Types
// ============================================================================

export type SyncPhase =
    | 'idle'
    | 'connecting'
    | 'fetching'
    | 'processing'
    | 'enriching'
    | 'complete'
    | 'error';

export type SyncProgressCallback = (
    phase: SyncPhase,
    message?: string,
    progress?: number
) => void;

export interface SyncResult {
    ok: boolean;
    processed: number;
    inserted?: number;
    updated?: number;
    error?: string;
    next_page_token?: string | null;
}

// ============================================================================
// Enhanced Sync with Progress
// ============================================================================

/**
 * Performs Gmail sync with progress callbacks for UI updates
 */
export async function syncGmailWithProgress(
    session: Session,
    options?: {
        hardSync?: boolean;
        pageToken?: string | null;
        maxMessages?: number;
        enrichOnly?: boolean;
        lightSync?: boolean;
        lookback_months?: '1' | '3' | '6' | '12' | 'all';
    },
    onProgress?: SyncProgressCallback
): Promise<SyncResult> {
    if (!session?.access_token) {
        throw new Error('Not authenticated.');
    }

    try {
        // Report initial phase
        const phase: SyncPhase = options?.enrichOnly ? 'enriching' : 'fetching';
        const message = options?.enrichOnly
            ? 'Enriching application data with AI...'
            : 'Fetching emails from Gmail...';
        onProgress?.(phase, message, 10);

        // Perform the actual sync
        const result = await syncGmailApplications(session, options);

        // Narrow the union — syncGmailApplications returns different shapes
        const r = result as any;
        const processed = r?.processed ?? 0;
        const inserted = r?.debug?.inserted ?? 0;
        const updated = r?.debug?.updated ?? 0;

        // Report completion
        onProgress?.('complete', `Synced ${processed} emails`, 100);

        return {
            ok: r?.ok ?? true,
            processed,
            inserted,
            updated,
            next_page_token: r?.next_page_token ?? null,
        };
    } catch (error: any) {
        const errorMessage = 'Sync failed. Please try again.';
        onProgress?.('error', errorMessage, 0);

        return {
            ok: false,
            processed: 0,
            error: errorMessage,
        };
    }
}

/**
 * Performs a full sync cycle (fetch + enrich)
 */
export async function performFullSync(
    session: Session,
    onProgress?: SyncProgressCallback
): Promise<{ syncResult: SyncResult; enrichResult: SyncResult }> {
    // Phase 1: Fetch new emails
    onProgress?.('connecting', 'Connecting to Gmail...', 0);

    const syncResult = await syncGmailWithProgress(
        session,
        {},
        (phase, msg, progress) => {
            // Scale progress to 0-50%
            onProgress?.(phase, msg, progress ? progress / 2 : 0);
        }
    );

    if (!syncResult.ok) {
        return { syncResult, enrichResult: { ok: false, processed: 0 } };
    }

    // Phase 2: Enrich with AI
    onProgress?.('enriching', 'Enriching data with AI...', 50);

    const enrichResult = await syncGmailWithProgress(
        session,
        { enrichOnly: true, maxMessages: 80 },
        (phase, msg, progress) => {
            // Scale progress to 50-100%
            onProgress?.(phase, msg, progress ? 50 + progress / 2 : 50);
        }
    );

    if (enrichResult.ok) {
        const totalProcessed = syncResult.processed + enrichResult.processed;
        onProgress?.('complete', `Sync complete! ${totalProcessed} items processed.`, 100);
    }

    return { syncResult, enrichResult };
}
