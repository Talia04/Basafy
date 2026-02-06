import { useCallback, useRef } from 'react';
import { supabase } from '@backend/supabase/client';
import { useApp } from './AppContext';
import { performFullSync, syncGmailWithProgress } from './syncWithProgress';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hook that provides sync functionality with toast notifications
 * and sync status tracking via AppContext.
 */
export function useGmailSync() {
    const {
        startSync,
        updateSyncProgress,
        completeSync,
        failSync,
        showSuccessToast,
        showErrorToast,
        showInfoToast,
        syncStatus,
    } = useApp();

    const syncInProgress = useRef(false);

    /**
     * Perform a quick incremental sync
     */
    const quickSync = useCallback(async () => {
        if (syncInProgress.current) {
            showInfoToast('Sync already in progress');
            return { ok: false, reason: 'in_progress' };
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session?.access_token) {
            showErrorToast('Please sign in to sync');
            return { ok: false, reason: 'not_authenticated' };
        }

        syncInProgress.current = true;
        startSync('Syncing Gmail...');

        try {
            const result = await syncGmailWithProgress(
                session,
                {},
                (phase, message, progress) => {
                    updateSyncProgress(phase as any, message, progress);
                }
            );

            if (result.ok) {
                const message = result.processed > 0
                    ? `Synced ${result.processed} emails`
                    : 'Already up to date';
                completeSync(message);
                showSuccessToast(message);
                return { ok: true, processed: result.processed };
            } else {
                failSync(result.error || 'Sync failed');
                showErrorToast(result.error || 'Sync failed', () => quickSync());
                return { ok: false, error: result.error };
            }
        } catch (err: any) {
            const message = err?.message || 'Sync failed';
            failSync(message);
            showErrorToast(message, () => quickSync());
            return { ok: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    }, [startSync, updateSyncProgress, completeSync, failSync, showSuccessToast, showErrorToast, showInfoToast]);

    /**
     * Perform a full sync with enrichment
     */
    const fullSync = useCallback(async () => {
        if (syncInProgress.current) {
            showInfoToast('Sync already in progress');
            return { ok: false, reason: 'in_progress' };
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session?.access_token) {
            showErrorToast('Please sign in to sync');
            return { ok: false, reason: 'not_authenticated' };
        }

        const userId = session.user?.id;
        const storageKey = userId ? `basafy:auto-gmail-sync:${userId}` : null;

        syncInProgress.current = true;
        startSync('Starting full sync...');

        try {
            const { syncResult, enrichResult } = await performFullSync(
                session,
                (phase, message, progress) => {
                    updateSyncProgress(phase as any, message, progress);
                }
            );

            // Update last sync time
            if (storageKey && syncResult.ok) {
                await AsyncStorage.setItem(storageKey, new Date().toISOString());
            }

            if (syncResult.ok) {
                const totalProcessed = syncResult.processed + (enrichResult.processed || 0);
                const message = totalProcessed > 0
                    ? `Synced ${totalProcessed} items`
                    : 'Already up to date';
                completeSync(message);
                showSuccessToast(message);
                return { ok: true, syncResult, enrichResult };
            } else {
                failSync(syncResult.error || 'Sync failed');
                showErrorToast(syncResult.error || 'Sync failed', () => fullSync());
                return { ok: false, error: syncResult.error };
            }
        } catch (err: any) {
            const message = err?.message || 'Sync failed';
            failSync(message);
            showErrorToast(message, () => fullSync());
            return { ok: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    }, [startSync, updateSyncProgress, completeSync, failSync, showSuccessToast, showErrorToast, showInfoToast]);

    /**
     * Enrich existing applications with AI
     */
    const enrichOnly = useCallback(async () => {
        if (syncInProgress.current) {
            showInfoToast('Sync already in progress');
            return { ok: false, reason: 'in_progress' };
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session?.access_token) {
            showErrorToast('Please sign in to enrich');
            return { ok: false, reason: 'not_authenticated' };
        }

        syncInProgress.current = true;
        startSync('Enriching applications...');

        try {
            const result = await syncGmailWithProgress(
                session,
                { enrichOnly: true, maxMessages: 80 },
                (phase, message, progress) => {
                    updateSyncProgress(phase as any, message, progress);
                }
            );

            if (result.ok) {
                const message = result.processed > 0
                    ? `Enriched ${result.processed} applications`
                    : 'All applications already enriched';
                completeSync(message);
                showSuccessToast(message);
                return { ok: true, processed: result.processed };
            } else {
                failSync(result.error || 'Enrichment failed');
                showErrorToast(result.error || 'Enrichment failed', () => enrichOnly());
                return { ok: false, error: result.error };
            }
        } catch (err: any) {
            const message = err?.message || 'Enrichment failed';
            failSync(message);
            showErrorToast(message, () => enrichOnly());
            return { ok: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    }, [startSync, updateSyncProgress, completeSync, failSync, showSuccessToast, showErrorToast, showInfoToast]);

    return {
        quickSync,
        fullSync,
        enrichOnly,
        isActive: syncStatus.isActive,
        syncStatus,
    };
}
