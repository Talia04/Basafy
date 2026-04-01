import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@backend/supabase/client';
import type { Session } from '@supabase/supabase-js';

const GMAIL_ONBOARDING_KEY = 'basafy:gmail-onboarding-completed';
const DEMO_MODE_KEY = 'basafy:demo-mode';
export const BACKFILL_PERSIST_KEY = 'basafy:backfill-persist';
const IMPORT_REVIEW_KEY_PREFIX = 'basafy:gmail-import-review-pending';

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
  if (options?.enrichOnly) {
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
      return data as {
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
        return retryData as {
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

let deferredSyncTimer: ReturnType<typeof setTimeout> | null = null;
let deferredAttempts = 0;
const MAX_DEFERRED_ATTEMPTS = 3;

export function scheduleDeferredGmailSync(delayMs = 90_000) {
  if (deferredSyncTimer || deferredAttempts >= MAX_DEFERRED_ATTEMPTS) return;
  deferredAttempts += 1;
  deferredSyncTimer = setTimeout(async () => {
    deferredSyncTimer = null;
    try {
      const result = await syncGmailApplications(undefined, {
        lightSync: true,
        maxMessages: 20,
        lookback_months: '1',
        usePipeline: true,
        force: false,
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
 * Runs a full Gmail backfill in the foreground by paging through all results.
 * Each page calls the Edge Function with hard_sync + use_pipeline.
 * The edge function persists backfill_page_token in gmail_connections after each page,
 * so if the app is backgrounded/killed mid-run, the next call resumes automatically.
 *
 * onProgress is called after each page with the current state.
 * Max pages: 25 (≈7500 emails at 300/page). Stops when there is no next_page_token.
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

  const MAX_PAGES = 25;
  let pageToken: string | null = null;
  let pagesProcessed = 0;

  await setInitialImportState(userId, {
    status: 'running',
    pagesProcessed: 0,
    startedAt: new Date().toISOString(),
  });

  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const result = await syncGmailApplications(session, {
        hardSync: true,
        usePipeline: true,
        maxMessages: 300,
        pageToken: pageToken ?? undefined,
      });

      pagesProcessed += 1;
      const nextToken: string | null = (result as any)?.next_page_token ?? null;

      const state: InitialImportState = {
        status: nextToken ? 'running' : 'complete',
        pagesProcessed,
        startedAt: new Date().toISOString(),
        ...(nextToken ? {} : { completedAt: new Date().toISOString() }),
      };
      await setInitialImportState(userId, state);
      onProgress?.(state);

      if (!nextToken) break;
      pageToken = nextToken;

      // Brief pause between pages to avoid hammering the Edge Function concurrency limits.
      await new Promise(resolve => setTimeout(resolve, 2000));
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
  /** Resume from a specific page token (e.g. after the app was backgrounded). */
  initialPageToken?: string | null;
  onPage?: (pagesProcessed: number, done: boolean) => void;
  /** Return true to abort the loop after the current page completes. */
  shouldStop?: () => boolean;
};

/**
 * Pages through Gmail history in a loop until no next_page_token is returned.
 * Calls onPage after each page so the caller can update UI / invalidate queries.
 * Safe to call without await — errors are surfaced in the return value.
 */
export async function runBackfill(opts: BackfillOptions = {}): Promise<{ pagesProcessed: number; done: boolean }> {
  const { lookbackMonths = '3', maxPages = 120, onPage, initialPageToken, shouldStop } = opts;
  const resolvedSession = opts.session ?? (await supabase.auth.getSession()).data.session;
  if (!resolvedSession) return { pagesProcessed: 0, done: false };

  if (await isMockReviewer(resolvedSession)) {
    await syncMockInbox(resolvedSession);
    onPage?.(1, true);
    return { pagesProcessed: 1, done: true };
  }

  let pageToken: string | null = initialPageToken ?? null;
  let pagesProcessed = 0;

  for (let i = 0; i < maxPages; i++) {
    let result: any;
    try {
      result = await syncGmailApplications(resolvedSession, {
        hardSync: true,
        maxMessages: 40,
        pageToken,
        lookback_months: lookbackMonths,
      });
    } catch {
      return { pagesProcessed, done: false };
    }

    if (result?.deferred) return { pagesProcessed, done: false };

    pagesProcessed += 1;
    pageToken = result?.next_page_token ?? null;
    const done = !pageToken;
    onPage?.(pagesProcessed, done);
    if (done || shouldStop?.()) break;

    // Brief gap so we don't hammer the edge function concurrency limit.
    await new Promise((r) => setTimeout(r, 2_000));
    if (shouldStop?.()) break;
  }

  return { pagesProcessed, done: !pageToken };
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
