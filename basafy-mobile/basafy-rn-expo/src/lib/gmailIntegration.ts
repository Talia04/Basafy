import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@backend/supabase/client';
import type { Session } from '@supabase/supabase-js';

const GMAIL_ONBOARDING_KEY = 'basafy:gmail-onboarding-completed';
const DEMO_MODE_KEY = 'basafy:demo-mode';
export const BACKFILL_PERSIST_KEY = 'basafy:backfill-persist';
const IMPORT_REVIEW_KEY_PREFIX = 'basafy:gmail-import-review-pending';
const GMAIL_SYNC_SESSION_KEY_PREFIX = 'basafy:gmail-sync-session';

export type GmailSyncContext =
  | 'mobile_onboarding'
  | 'mobile_incremental'
  | 'mobile_manual_refresh'
  | 'mobile_recovery';

export type GmailSyncMode =
  | 'mobile_onboarding_sync'
  | 'mobile_incremental_sync'
  | 'mobile_manual_refresh'
  | 'mobile_recovery_sync';

export type GmailSyncSessionResult = {
  ok?: boolean;
  gmail_sync_session_id?: string;
  gmail_sync_session_complete?: boolean;
  gmail_sync_has_more?: boolean;
  gmail_sync_finalizing?: boolean;
  gmail_sync_context?: GmailSyncContext;
  messages_processed?: number;
  target_messages?: number;
  applications_created?: number;
  applications_updated?: number;
  deferred?: boolean;
  reason?: string;
};

export type PersistedBackfillState = {
  lookback: '1' | '3' | '6' | '12' | 'all';
  pagesProcessed: number;
};

export type ImportReviewPending = {
  completedAt: string;
  source: 'manual_backfill' | 'background_backfill';
};

function keyForUser(userId: string) {
  return `${GMAIL_ONBOARDING_KEY}:${userId}`;
}

function demoKeyForUser(userId: string) {
  return `${DEMO_MODE_KEY}:${userId}`;
}

function importReviewKey(userId: string) {
  return `${IMPORT_REVIEW_KEY_PREFIX}:${userId}`;
}

function syncSessionKey(userId: string, context: GmailSyncContext) {
  return `${GMAIL_SYNC_SESSION_KEY_PREFIX}:${userId}:${context}`;
}

async function getPersistedSyncSession(userId: string, context: GmailSyncContext) {
  return AsyncStorage.getItem(syncSessionKey(userId, context));
}

async function persistSyncSession(userId: string, context: GmailSyncContext, sessionId: string) {
  await AsyncStorage.setItem(syncSessionKey(userId, context), sessionId);
}

async function clearPersistedSyncSession(userId: string, context: GmailSyncContext) {
  await AsyncStorage.removeItem(syncSessionKey(userId, context));
}

async function getCurrentUser() {
  return (await supabase.auth.getSession()).data.session?.user;
}

export async function getDemoModeFlag(userId?: string | null) {
  if (!userId) return false;
  return (await AsyncStorage.getItem(demoKeyForUser(userId))) === 'true';
}

export async function setDemoModeFlag(userId: string, enabled: boolean) {
  if (enabled) {
    await AsyncStorage.setItem(demoKeyForUser(userId), 'true');
  } else {
    await AsyncStorage.removeItem(demoKeyForUser(userId));
  }
}

export async function clearDemoModeFlag(userId: string) {
  await AsyncStorage.removeItem(demoKeyForUser(userId));
}

export async function getPersistedBackfillState(): Promise<PersistedBackfillState | null> {
  try {
    const raw = await AsyncStorage.getItem(BACKFILL_PERSIST_KEY);
    return raw ? JSON.parse(raw) as PersistedBackfillState : null;
  } catch {
    return null;
  }
}

export async function setPersistedBackfillState(state: PersistedBackfillState): Promise<void> {
  try {
    await AsyncStorage.setItem(BACKFILL_PERSIST_KEY, JSON.stringify(state));
  } catch {
    // best-effort
  }
}

export async function clearPersistedBackfillState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BACKFILL_PERSIST_KEY);
  } catch {
    // best-effort
  }
}

export async function getPendingImportReview(userId: string): Promise<ImportReviewPending | null> {
  try {
    const raw = await AsyncStorage.getItem(importReviewKey(userId));
    return raw ? JSON.parse(raw) as ImportReviewPending : null;
  } catch {
    return null;
  }
}

export async function setPendingImportReview(userId: string, payload: ImportReviewPending): Promise<void> {
  try {
    await AsyncStorage.setItem(importReviewKey(userId), JSON.stringify(payload));
  } catch {
    // best-effort
  }
}

export async function clearPendingImportReview(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(importReviewKey(userId));
  } catch {
    // best-effort
  }
}

export async function consumePendingImportReview(userId: string): Promise<ImportReviewPending | null> {
  const pending = await getPendingImportReview(userId);
  if (pending) {
    await clearPendingImportReview(userId);
  }
  return pending;
}

export async function isMockReviewer(session?: Session | null) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  const user = resolvedSession?.user;
  const isMockFlag = Boolean((user as any)?.user_metadata?.is_mock);
  const email = user?.email?.toLowerCase() ?? (user?.user_metadata as any)?.email?.toLowerCase();
  const isMockEmail = email === 'reviewer@basafy.app';
  return isMockFlag || isMockEmail;
}

export async function syncMockInbox(session?: Session | null) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  if (!resolvedSession?.access_token) {
    throw new Error('Not authenticated.');
  }
  const { data, error } = await supabase.functions.invoke('gmail-sync-user', {
    headers: { Authorization: `Bearer ${resolvedSession.access_token}` },
    body: {
      mock_sync: true,
      light_sync: true,
      max_messages: 30,
      use_pipeline: true,
    },
  });
  if (error) {
    throw error;
  }
  return data as { ok?: boolean; mock?: boolean };
}

export async function markGmailOnboardingSeen(session?: Session | null) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  const user = resolvedSession?.user;
  if (user?.id) {
    await AsyncStorage.setItem(keyForUser(user.id), 'true');
    await supabase.from('profiles').update({ has_seen_gmail_onboarding: true }).eq('id', user.id);
  } else {
    await AsyncStorage.setItem(GMAIL_ONBOARDING_KEY, 'true');
  }
}

export async function persistGmailConnection(
  session: Session,
  refreshToken?: string | null,
  authTokenOverride?: string | null,
) {
  if (await isMockReviewer(session)) {
    await syncMockInbox(session);
    return {
      email: session.user.email ?? null,
      has_refresh_token: true,
      mock: true,
    };
  }
  const user = session.user;
  const email = user.email ?? (user.user_metadata as any)?.email;
  const provider = (user.app_metadata as any)?.provider ?? 'google';
  const resolvedRefresh = refreshToken || (session as any)?.provider_refresh_token || null;

  const { data, error } = await supabase.functions.invoke('gmail-sync-user', {
    body: { email, provider, refresh_token: resolvedRefresh, seed_only: true },
    headers: { Authorization: `Bearer ${authTokenOverride || session.access_token}` },
  });

  if (error) {
    throw error;
  }

  await markGmailOnboardingSeen(session);
  return {
    email,
    has_refresh_token: Boolean((data as any)?.has_refresh_token ?? resolvedRefresh),
  };
}

export async function persistGmailConnectionWithAuthCode(
  session: Session,
  serverAuthCode: string,
  authTokenOverride?: string | null,
) {
  if (await isMockReviewer(session)) {
    await syncMockInbox(session);
    return {
      email: session.user.email ?? null,
      has_refresh_token: true,
      mock: true,
    };
  }
  const user = session.user;
  const email = user.email ?? (user.user_metadata as any)?.email;
  const provider = (user.app_metadata as any)?.provider ?? 'google';

  const { data, error } = await supabase.functions.invoke('gmail-sync-user', {
    body: { email, provider, server_auth_code: serverAuthCode, seed_only: true },
    headers: { Authorization: `Bearer ${authTokenOverride || session.access_token}` },
  });

  if (error) {
    throw error;
  }

  await markGmailOnboardingSeen(session);
  return {
    email,
    has_refresh_token: Boolean((data as any)?.has_refresh_token),
  };
}

export async function hasCompletedGmailOnboarding() {
  const user = await getCurrentUser();
  if (user?.id) {
    const perUser = await AsyncStorage.getItem(keyForUser(user.id));
    if (perUser === 'true') return true;
    // migrate legacy flag once
    const legacy = await AsyncStorage.getItem(GMAIL_ONBOARDING_KEY);
    if (legacy === 'true') {
      await AsyncStorage.setItem(keyForUser(user.id), 'true');
      return true;
    }
    return false;
  }
  const legacy = await AsyncStorage.getItem(GMAIL_ONBOARDING_KEY);
  return legacy === 'true';
}

export async function syncGmailApplications(
  session?: Session | null,
  options?: {
    hardSync?: boolean;
    pageToken?: string | null;
    maxMessages?: number;
    enrichOnly?: boolean;
    lightSync?: boolean;
    lookback_months?: '1' | '3' | '6' | '12' | 'all';
    usePipeline?: boolean;
    force?: boolean;
    syncContext?: GmailSyncContext;
    syncMode?: GmailSyncMode;
    gmailSyncSessionId?: string | null;
  }
) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  if (!resolvedSession?.access_token) {
    throw new Error('Not authenticated.');
  }
  if (await isMockReviewer(resolvedSession)) {
    return await syncMockInbox(resolvedSession);
  }
  let body: Record<string, unknown> | undefined;
  const forceFlag = options?.force !== false; // default true for user-initiated syncs
  // Always use pipeline v2 — it uses batched LLM, correct applied_at, and proper date handling.
  // The legacy inline path had per-message OpenAI calls and no received_at support.
  if (options?.syncContext && options?.syncMode) {
    body = {
      use_pipeline: true,
      sync_context: options.syncContext,
      sync_mode: options.syncMode,
      gmail_sync_session_id: options.gmailSyncSessionId ?? null,
      max_messages: Math.min(options.maxMessages ?? 10, 10),
      ...(options.lookback_months ? { lookback_months: options.lookback_months } : {}),
      force: forceFlag,
    };
  } else if (options?.enrichOnly) {
    body = { use_pipeline: true, enrich_only: true, max_messages: options?.maxMessages ?? null, force: forceFlag };
  } else if (options?.hardSync) {
    body = {
      use_pipeline: true,
      hard_sync: true,
      page_token: options?.pageToken ?? null,
      max_messages: options?.maxMessages ?? null,
      ...(options?.lookback_months ? { lookback_months: options.lookback_months } : {}),
      force: forceFlag,
    };
  } else if (options?.lightSync) {
    body = {
      use_pipeline: true,
      light_sync: true,
      max_messages: options?.maxMessages ?? 30,
      force: forceFlag,
    };
  } else {
    body = { use_pipeline: true, max_messages: options?.maxMessages ?? 40, force: forceFlag };
  }

  const invoke = async (payload?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('gmail-sync-user', {
      headers: { Authorization: `Bearer ${resolvedSession.access_token}` },
      body: payload,
    });
    if (!error) {
      return data as GmailSyncSessionResult & {
        ok?: boolean;
        processed?: number;
        messages?: any;
        debug?: any;
        next_page_token?: string | null;
        deferred?: boolean;
        reason?: string;
      };
    }

    let responseText: string | null = null;
    const response = (error as any)?.context;
    if (response && typeof response.text === 'function') {
      try {
        responseText = await response.text();
      } catch {
        responseText = null;
      }
    }
    const status = (response as any)?.status ?? null;
    const isWorkerLimit =
      status === 546 ||
      (responseText && responseText.includes('WORKER_LIMIT'));
    const isTimeout = status === 504;

    console.error('gmail-sync-user failed', {
      message: error.message,
      status,
      responseText,
      details: (error as any)?.context ?? null,
      data,
    });

    if ((isWorkerLimit || isTimeout) && !options?.hardSync && !options?.enrichOnly) {
      const fallbackBody = {
        light_sync: true,
        max_messages: 20,
        lookback_months: '1',
        use_pipeline: true,
      };
      const { data: retryData, error: retryError } = await supabase.functions.invoke('gmail-sync-user', {
        headers: { Authorization: `Bearer ${resolvedSession.access_token}` },
        body: fallbackBody,
      });
      if (!retryError) {
        return retryData as GmailSyncSessionResult & {
          ok?: boolean;
          processed?: number;
          messages?: any;
          debug?: any;
          next_page_token?: string | null;
          deferred?: boolean;
          reason?: string;
        };
      }
      const retryResponse = (retryError as any)?.context;
      let retryText: string | null = null;
      if (retryResponse && typeof retryResponse.text === 'function') {
        try {
          retryText = await retryResponse.text();
        } catch {
          retryText = null;
        }
      }
      const retryStatus = (retryResponse as any)?.status ?? null;
      const retryWorkerLimit =
        retryStatus === 546 ||
        (retryText && retryText.includes('WORKER_LIMIT'));
      const retryTimeout = retryStatus === 504;
      if (retryWorkerLimit || retryTimeout) {
        return {
          ok: false,
          deferred: true,
          reason: retryWorkerLimit ? 'worker_limit' : 'timeout',
        };
      }
    }

    if (isWorkerLimit || isTimeout) {
      return {
        ok: false,
        deferred: true,
        reason: isWorkerLimit ? 'worker_limit' : 'timeout',
      };
    }

    throw error;
  };

  return invoke(body);
}

const MODE_BY_CONTEXT: Record<GmailSyncContext, GmailSyncMode> = {
  mobile_onboarding: 'mobile_onboarding_sync',
  mobile_incremental: 'mobile_incremental_sync',
  mobile_manual_refresh: 'mobile_manual_refresh',
  mobile_recovery: 'mobile_recovery_sync',
};

export async function runDurableGmailSync(options: {
  context: GmailSyncContext;
  session?: Session | null;
  lookbackMonths?: '1' | '3';
  maxChunks?: number;
  shouldStop?: () => boolean;
  onChunk?: (result: GmailSyncSessionResult, chunk: number) => void;
}): Promise<GmailSyncSessionResult & { chunksProcessed: number }> {
  const resolvedSession = options.session ?? (await supabase.auth.getSession()).data.session;
  const userId = resolvedSession?.user?.id;
  if (!resolvedSession || !userId) throw new Error('Not authenticated.');

  const storageContext = options.context === 'mobile_recovery'
    ? 'mobile_manual_refresh'
    : options.context;
  let syncSessionId = await getPersistedSyncSession(userId, storageContext);
  let chunksProcessed = 0;
  let latest: GmailSyncSessionResult = {};

  for (let chunk = 0; chunk < (options.maxChunks ?? 80); chunk += 1) {
    if (options.shouldStop?.()) break;
    latest = await syncGmailApplications(resolvedSession, {
      syncContext: options.context,
      syncMode: MODE_BY_CONTEXT[options.context],
      gmailSyncSessionId: syncSessionId,
      lookback_months: options.lookbackMonths,
      maxMessages: 10,
      force: chunk === 0,
    });
    if (latest.deferred) break;

    chunksProcessed += 1;
    if (latest.gmail_sync_session_id) {
      syncSessionId = latest.gmail_sync_session_id;
      await persistSyncSession(userId, storageContext, syncSessionId);
    }
    options.onChunk?.(latest, chunksProcessed);

    if (latest.gmail_sync_session_complete) {
      await clearPersistedSyncSession(userId, storageContext);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  return { ...latest, chunksProcessed };
}

let deferredSyncTimer: ReturnType<typeof setTimeout> | null = null;
let deferredAttempts = 0;
const MAX_DEFERRED_ATTEMPTS = 3;

export function scheduleDeferredGmailSync(delayMs = 90_000) {
  if (deferredSyncTimer || deferredAttempts >= MAX_DEFERRED_ATTEMPTS) return;
  deferredAttempts += 1;
  deferredSyncTimer = setTimeout(async () => {
    deferredSyncTimer = null;
    try {
      const result = await runDurableGmailSync({
        context: 'mobile_incremental',
        lookbackMonths: '1',
        maxChunks: 12,
      });
      if ((result as any)?.deferred) {
        scheduleDeferredGmailSync(Math.min(delayMs + 30_000, 180_000));
      } else {
        deferredAttempts = 0;
      }
    } catch {
      scheduleDeferredGmailSync(Math.min(delayMs + 30_000, 180_000));
    }
  }, delayMs);
}

export async function fetchGmailConnection(session?: Session | null) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  const user = resolvedSession?.user;
  if (!user?.id) {
    return null;
  }
  const { data, error } = await supabase
    .from('gmail_connections')
    .select('email,provider,refresh_token,last_synced_at,backfill_page_token,backfill_started_at,backfill_completed_at')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .maybeSingle();
  if (error) {
    throw error;
  }
  return (
    (data as {
      email: string;
      provider: string;
      refresh_token: string | null;
      last_synced_at?: string | null;
      backfill_page_token?: string | null;
      backfill_started_at?: string | null;
      backfill_completed_at?: string | null;
      backfill_total_estimate?: number | null;
      backfill_processed_count?: number | null;
    } | null) ??
    null
  );
}

// ============================================================================
// Initial Full Import — exhausts all Gmail pages in the foreground
// ============================================================================

const INITIAL_IMPORT_KEY_PREFIX = 'basafy:initial-import';

function importKey(userId: string) {
  return `${INITIAL_IMPORT_KEY_PREFIX}:${userId}`;
}

export type InitialImportState = {
  status: 'running' | 'complete' | 'error';
  pagesProcessed: number;
  startedAt: string;
  completedAt?: string;
};

export async function getInitialImportState(userId: string): Promise<InitialImportState | null> {
  try {
    const raw = await AsyncStorage.getItem(importKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setInitialImportState(userId: string, patch: Partial<InitialImportState>): Promise<void> {
  try {
    const current = await getInitialImportState(userId);
    const next = { ...(current ?? { status: 'running' as const, pagesProcessed: 0, startedAt: new Date().toISOString() }), ...patch };
    await AsyncStorage.setItem(importKey(userId), JSON.stringify(next));
  } catch {
    // best-effort
  }
}

export async function clearInitialImportState(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(importKey(userId));
  } catch {
    // best-effort
  }
}

/**
 * Runs the durable onboarding session in bounded sequential chunks.
 * The server persists the query bucket, Gmail cursor, and seen message IDs.
 *
 * onProgress is called after each bounded chunk with the current state.
 * Reopening the app resumes the same parent session without replaying completed chunks.
 */
export async function runInitialFullImport(
  session: Session,
  onProgress?: (state: InitialImportState) => void
): Promise<void> {
  const userId = session.user?.id;
  if (!userId) return;

  if (await isMockReviewer(session)) {
    await syncMockInbox(session);
    await setInitialImportState(userId, { status: 'complete', completedAt: new Date().toISOString() });
    return;
  }

  let pagesProcessed = 0;

  await setInitialImportState(userId, {
    status: 'running',
    pagesProcessed: 0,
    startedAt: new Date().toISOString(),
  });

  try {
    const result = await runDurableGmailSync({
      context: 'mobile_onboarding',
      session,
      lookbackMonths: '3',
      onChunk: (chunkResult, chunk) => {
        pagesProcessed = chunk;
        const isComplete = Boolean(chunkResult.gmail_sync_session_complete);
        const state: InitialImportState = {
          status: isComplete ? 'complete' : 'running',
          pagesProcessed,
          startedAt: new Date().toISOString(),
          ...(isComplete ? { completedAt: new Date().toISOString() } : {}),
        };
        void setInitialImportState(userId, state);
        onProgress?.(state);
      },
    });
    if (!result.gmail_sync_session_complete) {
      throw new Error(result.deferred ? 'Gmail sync paused.' : 'Gmail sync did not complete.');
    }
  } catch (err) {
    console.warn('[runInitialFullImport] error during full import', err);
    await setInitialImportState(userId, { status: 'error', pagesProcessed });
    onProgress?.({ status: 'error', pagesProcessed, startedAt: new Date().toISOString() });
  }
}

// ============================================================================
// Backfill — auto-paginate through Gmail history to completion
// ============================================================================

export type BackfillOptions = {
  lookbackMonths?: '1' | '3' | '6' | '12' | 'all';
  session?: Session | null;
  maxPages?: number;
  onPage?: (pagesProcessed: number, done: boolean) => void;
  /** Return true to abort the loop after the current page completes. */
  shouldStop?: () => boolean;
};

/**
 * Advances a durable manual-refresh session until completion or interruption.
 * Calls onPage after each bounded server chunk so the caller can refresh UI.
 * Safe to call without await — errors are surfaced in the return value.
 */
export async function runBackfill(opts: BackfillOptions = {}): Promise<{ pagesProcessed: number; done: boolean }> {
  const { lookbackMonths = '3', maxPages = 120, onPage, shouldStop } = opts;
  const resolvedSession = opts.session ?? (await supabase.auth.getSession()).data.session;
  if (!resolvedSession) return { pagesProcessed: 0, done: false };

  if (await isMockReviewer(resolvedSession)) {
    await syncMockInbox(resolvedSession);
    onPage?.(1, true);
    return { pagesProcessed: 1, done: true };
  }

  let pagesProcessed = 0;
  try {
    const result = await runDurableGmailSync({
      context: 'mobile_manual_refresh',
      session: resolvedSession,
      lookbackMonths: lookbackMonths === '1' ? '1' : '3',
      maxChunks: maxPages,
      shouldStop,
      onChunk: (chunkResult, chunk) => {
        pagesProcessed = chunk;
        onPage?.(chunk, Boolean(chunkResult.gmail_sync_session_complete));
      },
    });
    return { pagesProcessed, done: Boolean(result.gmail_sync_session_complete) };
  } catch {
    return { pagesProcessed, done: false };
  }
}

export async function resetGmailApplications(session?: Session | null) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  if (!resolvedSession?.access_token) {
    throw new Error('Not authenticated.');
  }
  const { data, error } = await supabase.functions.invoke('reset-gmail-imported-data', {
    headers: { Authorization: `Bearer ${resolvedSession.access_token}` },
  });
  if (error) {
    throw error;
  }
  return data as { ok?: boolean; deleted?: number };
}


/**
 * Disconnect Gmail by clearing the refresh token.
 * User will need to re-authenticate to sync again.
 */
export async function disconnectGmail(session?: Session | null) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  const user = resolvedSession?.user;
  if (!user?.id) {
    throw new Error("Not authenticated.");
  }
  
  const { error } = await supabase
    .from("gmail_connections")
    .delete()
    .eq("user_id", user.id);
    
  if (error) {
    throw error;
  }
  
  return { ok: true };
}
