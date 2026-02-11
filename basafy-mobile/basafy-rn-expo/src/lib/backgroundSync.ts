/**
 * Background Sync Service
 * Handles periodic Gmail sync in the background using Expo Task Manager
 */
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@backend/supabase/client';

// Task identifiers
export const BACKGROUND_SYNC_TASK = 'BASAFY_BACKGROUND_SYNC';
export const BACKGROUND_SYNC_STORAGE_KEY = '@basafy_background_sync';

// Sync configuration
export interface BackgroundSyncConfig {
    /** Whether background sync is enabled */
    enabled: boolean;
    /** Minimum interval between syncs in minutes (iOS minimum is 15) */
    intervalMinutes: number;
    /** Last sync timestamp */
    lastSyncAt: string | null;
    /** Last sync result */
    lastSyncResult: 'success' | 'failed' | 'no-data' | null;
    /** Error message if failed */
    lastError: string | null;
}

const DEFAULT_CONFIG: BackgroundSyncConfig = {
    enabled: true,
    intervalMinutes: 30, // 30 minutes default
    lastSyncAt: null,
    lastSyncResult: null,
    lastError: null,
};

/**
 * Get the current background sync configuration
 */
export async function getBackgroundSyncConfig(): Promise<BackgroundSyncConfig> {
    try {
        const stored = await AsyncStorage.getItem(BACKGROUND_SYNC_STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
        }
        return DEFAULT_CONFIG;
    } catch {
        return DEFAULT_CONFIG;
    }
}

/**
 * Save background sync configuration
 */
export async function saveBackgroundSyncConfig(
    config: Partial<BackgroundSyncConfig>
): Promise<void> {
    try {
        const current = await getBackgroundSyncConfig();
        const updated = { ...current, ...config };
        await AsyncStorage.setItem(BACKGROUND_SYNC_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
        console.warn('[BackgroundSync] Failed to save config:', error);
    }
}

/**
 * Perform the actual sync operation
 */
async function performSync(): Promise<BackgroundFetch.BackgroundFetchResult> {
    console.log('[BackgroundSync] Starting background sync...');

    try {
        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.log('[BackgroundSync] No active session, skipping sync');
            await saveBackgroundSyncConfig({
                lastSyncAt: new Date().toISOString(),
                lastSyncResult: 'no-data',
                lastError: null,
            });
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // Check if Gmail is connected
        const { data: gmailConnection } = await supabase
            .from('gmail_connections')
            .select('id, provider')
            .eq('provider', 'google')
            .maybeSingle();

        if (!gmailConnection) {
            console.log('[BackgroundSync] No Gmail connection, skipping sync');
            await saveBackgroundSyncConfig({
                lastSyncAt: new Date().toISOString(),
                lastSyncResult: 'no-data',
                lastError: null,
            });
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // Call the Gmail sync edge function
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/gmail-sync-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                // Incremental sync - keep it light to avoid worker limits
                hard_sync: false,
                light_sync: true,
                max_messages: 20,
                lookback_months: '1',
                use_pipeline: true,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            const status = response.status;
            const isWorkerLimit = status === 546 || errorText.includes('WORKER_LIMIT');
            const isTimeout = status === 504;
            const errorMessage = `Sync failed: ${status} - ${errorText}`;

            // Treat infra/compute limits as no-data to avoid OS penalizing the task.
            if (isWorkerLimit || isTimeout) {
                await saveBackgroundSyncConfig({
                    lastSyncAt: new Date().toISOString(),
                    lastSyncResult: 'failed',
                    lastError: errorMessage,
                });
                console.warn('[BackgroundSync] Sync skipped due to infra limits:', errorMessage);
                return BackgroundFetch.BackgroundFetchResult.NoData;
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('[BackgroundSync] Sync completed:', result);

        await saveBackgroundSyncConfig({
            lastSyncAt: new Date().toISOString(),
            lastSyncResult: 'success',
            lastError: null,
        });

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[BackgroundSync] Sync failed:', errorMessage);

        await saveBackgroundSyncConfig({
            lastSyncAt: new Date().toISOString(),
            lastSyncResult: 'failed',
            lastError: errorMessage,
        });

        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
}

/**
 * Define the background task
 * This must be called at the top level of your app (outside of components)
 */
export function defineBackgroundSyncTask(): void {
    TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
        console.log('[BackgroundSync] Task triggered');

        const config = await getBackgroundSyncConfig();
        if (!config.enabled) {
            console.log('[BackgroundSync] Background sync is disabled');
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        return performSync();
    });
}

/**
 * Register the background sync task
 */
export async function registerBackgroundSync(
    intervalMinutes?: number
): Promise<boolean> {
    try {
        const config = await getBackgroundSyncConfig();
        const interval = intervalMinutes ?? config.intervalMinutes;

        // Check if background fetch is available
        const status = await BackgroundFetch.getStatusAsync();

        if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
            console.warn('[BackgroundSync] Background fetch is restricted');
            return false;
        }

        if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
            console.warn('[BackgroundSync] Background fetch is denied');
            return false;
        }

        // Register the task
        await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
            minimumInterval: interval * 60, // Convert minutes to seconds
            stopOnTerminate: false, // Android: continue after app is terminated
            startOnBoot: true, // Android: start task after device reboot
        });

        await saveBackgroundSyncConfig({
            enabled: true,
            intervalMinutes: interval,
        });

        console.log(`[BackgroundSync] Registered with ${interval} minute interval`);
        return true;
    } catch (error) {
        console.error('[BackgroundSync] Registration failed:', error);
        return false;
    }
}

/**
 * Unregister the background sync task
 */
export async function unregisterBackgroundSync(): Promise<void> {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);

        if (isRegistered) {
            await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
            console.log('[BackgroundSync] Unregistered');
        }

        await saveBackgroundSyncConfig({ enabled: false });
    } catch (error) {
        console.error('[BackgroundSync] Unregistration failed:', error);
    }
}

/**
 * Check if background sync is registered
 */
export async function isBackgroundSyncRegistered(): Promise<boolean> {
    try {
        return await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    } catch {
        return false;
    }
}

/**
 * Get background fetch status
 */
export async function getBackgroundFetchStatus(): Promise<{
    available: boolean;
    status: BackgroundFetch.BackgroundFetchStatus;
    statusName: string;
}> {
    const rawStatus = await BackgroundFetch.getStatusAsync();
    const status = rawStatus ?? BackgroundFetch.BackgroundFetchStatus.Denied;

    const statusNames: Record<BackgroundFetch.BackgroundFetchStatus, string> = {
        [BackgroundFetch.BackgroundFetchStatus.Denied]: 'Denied',
        [BackgroundFetch.BackgroundFetchStatus.Restricted]: 'Restricted',
        [BackgroundFetch.BackgroundFetchStatus.Available]: 'Available',
    };

    return {
        available: status === BackgroundFetch.BackgroundFetchStatus.Available,
        status,
        statusName: statusNames[status] || 'Unknown',
    };
}

/**
 * Manually trigger a sync (useful for testing or user-initiated refresh)
 */
export async function triggerManualSync(): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        const result = await performSync();
        return {
            success: result === BackgroundFetch.BackgroundFetchResult.NewData,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

export default {
    defineBackgroundSyncTask,
    registerBackgroundSync,
    unregisterBackgroundSync,
    isBackgroundSyncRegistered,
    getBackgroundSyncConfig,
    saveBackgroundSyncConfig,
    getBackgroundFetchStatus,
    triggerManualSync,
    BACKGROUND_SYNC_TASK,
};
