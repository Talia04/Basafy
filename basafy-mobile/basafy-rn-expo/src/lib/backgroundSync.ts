/**
 * Background Sync Service
 * Handles periodic Gmail sync in the background using Expo Task Manager
 */
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@backend/supabase/client';
import { scheduleAllReminders } from './localReminders';

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
    /** Current run status */
    currentStatus: 'idle' | 'running';
    /** Unique ID of the current or last run */
    currentRunId: string | null;
    /** Last time the background task was triggered */
    lastTriggerAt: string | null;
    /** When the current run started */
    currentRunStartedAt: string | null;
    /** Heartbeat written while the current run is progressing */
    currentRunHeartbeatAt: string | null;
    /** When the current or last run finished */
    currentRunFinishedAt: string | null;
    /** Latest processed count from the most recent run */
    lastProcessedCount: number | null;
    /** Latest inserted count from the most recent run */
    lastInsertedCount: number | null;
    /** Latest updated count from the most recent run */
    lastUpdatedCount: number | null;
    /** Last known app lifecycle state */
    appState: 'active' | 'background' | 'inactive' | 'unknown';
    /** Timestamp of the last app lifecycle update */
    appStateUpdatedAt: string | null;
}

const DEFAULT_CONFIG: BackgroundSyncConfig = {
    enabled: true,
    intervalMinutes: 30, // 30 minutes default
    lastSyncAt: null,
    lastSyncResult: null,
    lastError: null,
    currentStatus: 'idle',
    currentRunId: null,
    lastTriggerAt: null,
    currentRunStartedAt: null,
    currentRunHeartbeatAt: null,
    currentRunFinishedAt: null,
    lastProcessedCount: null,
    lastInsertedCount: null,
    lastUpdatedCount: null,
    appState: 'unknown',
    appStateUpdatedAt: null,
};

const RUN_STALE_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 85 * 1000;

function createRunId() {
    return `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseTimestamp(value: string | null | undefined): number | null {
    if (!value) return null;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
}

async function updateCurrentRunHeartbeat(runId: string): Promise<void> {
    const config = await getBackgroundSyncConfig();
    if (config.currentRunId !== runId || config.currentStatus !== 'running') return;
    await saveBackgroundSyncConfig({
        currentRunHeartbeatAt: new Date().toISOString(),
    });
}

async function finishBackgroundSyncRun(
    runId: string,
    config: Partial<BackgroundSyncConfig>,
): Promise<void> {
    const current = await getBackgroundSyncConfig();
    if (current.currentRunId && current.currentRunId !== runId) return;
    await saveBackgroundSyncConfig({
        currentStatus: 'idle',
        currentRunId: runId,
        currentRunFinishedAt: new Date().toISOString(),
        currentRunHeartbeatAt: new Date().toISOString(),
        ...config,
    });
}

async function beginBackgroundSyncRun(): Promise<{ ok: true; runId: string } | { ok: false }> {
    const config = await getBackgroundSyncConfig();
    const now = Date.now();
    const startedAtMs = parseTimestamp(config.currentRunStartedAt);
    const heartbeatMs = parseTimestamp(config.currentRunHeartbeatAt);
    const referenceMs = heartbeatMs ?? startedAtMs;

    if (
        config.currentStatus === 'running' &&
        referenceMs &&
        now - referenceMs < RUN_STALE_MS
    ) {
        console.log('[BackgroundSync] Existing run still in progress, skipping duplicate trigger');
        await saveBackgroundSyncConfig({
            lastTriggerAt: new Date(now).toISOString(),
        });
        return { ok: false };
    }

    if (config.currentStatus === 'running') {
        console.warn('[BackgroundSync] Recovering stale run lock');
        await saveBackgroundSyncConfig({
            currentStatus: 'idle',
            currentRunFinishedAt: new Date(now).toISOString(),
            lastSyncResult: 'failed',
            lastError: 'Previous background sync timed out before completion.',
        });
    }

    const runId = createRunId();
    const nowIso = new Date(now).toISOString();
    await saveBackgroundSyncConfig({
        currentStatus: 'running',
        currentRunId: runId,
        lastTriggerAt: nowIso,
        currentRunStartedAt: nowIso,
        currentRunHeartbeatAt: nowIso,
        currentRunFinishedAt: null,
        lastError: null,
    });

    return { ok: true, runId };
}

async function shouldNotifyBackgroundSyncCompletion(userId: string): Promise<boolean> {
    const config = await getBackgroundSyncConfig();
    if (config.appState === 'active') return false;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return false;

    const { data: settings } = await supabase
        .from('user_notification_settings')
        .select('push_enabled, updates_enabled')
        .eq('user_id', userId)
        .maybeSingle();

    return Boolean((settings?.push_enabled ?? false) && (settings?.updates_enabled ?? true));
}

async function notifyBackgroundSyncComplete(
    userId: string,
    counts: {
        processed: number;
        inserted: number;
        updated: number;
    },
): Promise<void> {
    if (!(await shouldNotifyBackgroundSyncCompletion(userId))) return;

    const changedCount = counts.inserted + counts.updated;
    const title = changedCount > 0 ? 'Gmail sync complete' : 'Gmail checked in';
    const body =
        changedCount > 0
            ? changedCount === 1
                ? 'Background sync updated 1 item in your pipeline.'
                : `Background sync updated ${changedCount} items in your pipeline.`
            : counts.processed === 1
                ? 'Background sync processed 1 email while you were away.'
                : `Background sync processed ${counts.processed} emails while you were away.`;

    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true,
            data: {
                type: 'background_sync_complete',
                entity_type: 'background_sync',
                processed: counts.processed,
                inserted: counts.inserted,
                updated: counts.updated,
            },
        },
        trigger: {
            type: SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
            repeats: false,
        },
    });
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

export async function setBackgroundSyncAppState(
    state: 'active' | 'background' | 'inactive' | 'unknown',
): Promise<void> {
    await saveBackgroundSyncConfig({
        appState: state,
        appStateUpdatedAt: new Date().toISOString(),
    });
}

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
    const run = await beginBackgroundSyncRun();
    if (!run.ok) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    const runId = run.runId;

    try {
        await updateCurrentRunHeartbeat(runId);

        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.log('[BackgroundSync] No active session, skipping sync');
            await finishBackgroundSyncRun(runId, {
                lastSyncAt: new Date().toISOString(),
                lastSyncResult: 'no-data',
                lastError: null,
                lastProcessedCount: 0,
                lastInsertedCount: 0,
                lastUpdatedCount: 0,
            });
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // Check if Gmail is connected
        const { data: gmailConnection } = await supabase
            .from('gmail_connections')
            .select('id, provider')
            .eq('user_id', session.user.id)
            .eq('provider', 'google')
            .maybeSingle();

        if (!gmailConnection) {
            console.log('[BackgroundSync] No Gmail connection, skipping sync');
            await finishBackgroundSyncRun(runId, {
                lastSyncAt: new Date().toISOString(),
                lastSyncResult: 'no-data',
                lastError: null,
                lastProcessedCount: 0,
                lastInsertedCount: 0,
                lastUpdatedCount: 0,
            });
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // Call the Gmail sync edge function
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/gmail-sync-user`, {
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
        }, FETCH_TIMEOUT_MS);

        await updateCurrentRunHeartbeat(runId);

        if (!response.ok) {
            const errorText = await response.text();
            const status = response.status;
            const isWorkerLimit = status === 546 || errorText.includes('WORKER_LIMIT');
            const isTimeout = status === 504;
            const errorMessage = `Sync failed: ${status} - ${errorText}`;

            // Treat infra/compute limits as no-data to avoid OS penalizing the task.
            if (isWorkerLimit || isTimeout) {
                await finishBackgroundSyncRun(runId, {
                    lastSyncAt: new Date().toISOString(),
                    lastSyncResult: 'failed',
                    lastError: errorMessage,
                    lastProcessedCount: 0,
                    lastInsertedCount: 0,
                    lastUpdatedCount: 0,
                });
                console.warn('[BackgroundSync] Sync skipped due to infra limits:', errorMessage);
                return BackgroundFetch.BackgroundFetchResult.NoData;
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('[BackgroundSync] Sync completed:', result);
        const processed = Number(result?.processed ?? 0);
        const inserted = Number(result?.debug?.inserted ?? result?.inserted ?? 0);
        const updated = Number(result?.debug?.updated ?? result?.updated ?? 0);
        const changed = processed > 0 || inserted > 0 || updated > 0;

        await finishBackgroundSyncRun(runId, {
            lastSyncAt: new Date().toISOString(),
            lastSyncResult: 'success',
            lastError: null,
            lastProcessedCount: processed,
            lastInsertedCount: inserted,
            lastUpdatedCount: updated,
        });

        // Reschedule local reminders with fresh event/task data
        await scheduleAllReminders();

        if (changed) {
            await notifyBackgroundSyncComplete(session.user.id, {
                processed,
                inserted,
                updated,
            });
        }

        return changed
            ? BackgroundFetch.BackgroundFetchResult.NewData
            : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
        const errorMessage =
            error instanceof Error && error.name === 'AbortError'
                ? 'Background sync timed out before the request completed.'
                : error instanceof Error
                    ? error.message
                    : 'Unknown error';
        console.error('[BackgroundSync] Sync failed:', errorMessage);

        await finishBackgroundSyncRun(runId, {
            lastSyncAt: new Date().toISOString(),
            lastSyncResult: 'failed',
            lastError: errorMessage,
            lastProcessedCount: 0,
            lastInsertedCount: 0,
            lastUpdatedCount: 0,
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
        const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);

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

        if (!alreadyRegistered) {
            await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
                minimumInterval: interval * 60, // Convert minutes to seconds
                stopOnTerminate: false, // Android: continue after app is terminated
                startOnBoot: true, // Android: start task after device reboot
            });
        }

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
