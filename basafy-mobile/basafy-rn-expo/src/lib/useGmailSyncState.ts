/**
 * useGmailSyncState
 *
 * Replaces the polling intervals in MainScreen with Supabase Realtime subscriptions.
 * Subscribes to `gmail_sync_state` (progress rows) and `gmail_sync_logs` (completed runs)
 * for the current user. Updates arrive instantly when the Edge Function writes to the DB
 * instead of waiting for the next poll tick.
 *
 * Usage:
 *   const { phase, setPhase, refresh } = useGmailSyncState(userId, loadHomeData);
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@backend/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GmailSyncPhase = {
  status: string | null;
  progress: number | null;      // 0-100 from initial_import_progress
  lastDeepCount: number | null; // applications created in last deep sync
  summary: string | null;       // human-readable summary string
  isRunning: boolean;           // currently syncing
  isComplete: boolean;          // just finished successfully
  hasFailed: boolean;           // sync errored
  isPaused?: boolean;
  needsReconnect?: boolean;
  lastSyncedAt?: string | null;
};

const DEFAULT_PHASE: GmailSyncPhase = {
  status: null,
  progress: null,
  lastDeepCount: null,
  summary: null,
  isRunning: false,
  isComplete: false,
  hasFailed: false,
  isPaused: false,
  needsReconnect: false,
  lastSyncedAt: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToPhase(row: Record<string, any>): GmailSyncPhase {
  const status: string | null = row.initial_import_status ?? null;
  return {
    status,
    progress: typeof row.initial_import_progress === 'number' ? row.initial_import_progress : null,
    lastDeepCount: typeof row.last_deep_result_count === 'number' ? row.last_deep_result_count : null,
    summary: row.last_sync_summary ?? null,
    isRunning: ['phase1_running', 'deep_running'].includes(status ?? ''),
    isComplete: ['phase1_done', 'deep_done'].includes(status ?? ''),
    hasFailed: status === 'failed',
    isPaused: status === 'paused',
    needsReconnect: status === 'needs_reconnect',
    lastSyncedAt: row.last_successful_checkpoint ?? row.completed_at ?? null,
  };
}

function sessionToPhase(row: Record<string, any>): GmailSyncPhase {
  const status = row.status as string | null;
  const processed = typeof row.messages_processed === 'number' ? row.messages_processed : 0;
  return {
    status,
    progress: null,
    lastDeepCount: processed,
    summary: status === 'complete'
      ? 'Gmail sync complete.'
      : status === 'paused'
        ? 'Gmail sync paused. Tap sync to continue.'
        : status === 'failed'
          ? 'Gmail sync failed. Tap to retry.'
          : 'Updating your pipeline...',
    isRunning: status === 'running',
    isComplete: status === 'complete',
    hasFailed: status === 'failed',
    isPaused: status === 'paused',
    needsReconnect: row.failure_reason === 'needs_reconnect',
    lastSyncedAt: row.last_successful_checkpoint ?? row.completed_at ?? null,
  };
}

function logToPhase(log: Record<string, any>): GmailSyncPhase {
  const logStatus: string = log.status ?? '';
  const syncType: string = log.sync_type ?? '';
  const status =
    logStatus === 'running'
      ? 'phase1_running'
      : logStatus === 'error'
        ? 'failed'
        : syncType === 'full'
          ? 'deep_done'
          : 'phase1_done';
  const created: number | null = log.applications_created ?? null;
  return rowToPhase({
    initial_import_status: status,
    last_deep_result_count: created,
    last_sync_summary:
      logStatus === 'error'
        ? 'Gmail sync failed.'
        : created
          ? `Imported ${created} application${created !== 1 ? 's' : ''}.`
          : 'Gmail sync complete.',
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGmailSyncState(
  userId: string | null,
  onDataChange?: () => void,
): {
  phase: GmailSyncPhase;
  setPhase: React.Dispatch<React.SetStateAction<GmailSyncPhase>>;
  refresh: () => Promise<void>;
} {
  const [phase, setPhase] = useState<GmailSyncPhase>(DEFAULT_PHASE);
  const onDataChangeRef = useRef(onDataChange);
  onDataChangeRef.current = onDataChange;

  // Initial state load — reads the current row from the DB.
  // Falls back to the most recent sync log if no state row exists.
  const loadInitial = useCallback(async (uid: string) => {
    const { data: sessionRow } = await (supabase as any)
      .from('gmail_sync_sessions')
      .select('status,messages_processed,failure_reason,last_successful_checkpoint,completed_at')
      .eq('user_id', uid)
      .in('context', ['mobile_onboarding', 'mobile_incremental', 'mobile_manual_refresh', 'mobile_recovery'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionRow) {
      setPhase(sessionToPhase(sessionRow as Record<string, any>));
      return;
    }

    const { data: stateRow } = await supabase
      .from('gmail_sync_state')
      .select('initial_import_status, initial_import_progress, last_deep_result_count, last_sync_summary')
      .eq('user_id', uid)
      .maybeSingle();

    if (stateRow) {
      setPhase(rowToPhase(stateRow as Record<string, any>));
      return;
    }

    // Fallback: derive phase from the last sync log entry
    const { data: log } = await supabase
      .from('gmail_sync_logs')
      .select('status, sync_type, applications_created')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (log) {
      setPhase(logToPhase(log as Record<string, any>));
    }
  }, []);

  const refresh = useCallback(async () => {
    if (userId) await loadInitial(userId);
  }, [userId, loadInitial]);

  useEffect(() => {
    if (!userId) {
      setPhase(DEFAULT_PHASE);
      return;
    }

    // Seed state immediately on userId becoming available
    loadInitial(userId);

    const channel = supabase
      .channel(`gmail-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gmail_sync_sessions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row || row.context === 'wrapped') return;
          const next = sessionToPhase(row);
          setPhase(next);
          if (next.isComplete || next.hasFailed || next.isPaused) {
            onDataChangeRef.current?.();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gmail_sync_state',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row) return;
          const next = rowToPhase(row);
          setPhase(next);
          // Trigger a home-data refresh when sync finishes or fails
          if (next.isComplete || next.hasFailed) {
            onDataChangeRef.current?.();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gmail_sync_logs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const log = payload.new as Record<string, any> | null;
          if (log) setPhase(logToPhase(log));
          // A new sync log means fresh application data landed — refresh home
          onDataChangeRef.current?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadInitial]);

  return { phase, setPhase, refresh };
}
