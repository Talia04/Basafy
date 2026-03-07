import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@backend/supabase/client';
import type { Session } from '@supabase/supabase-js';

const WATCH_EXPIRY_KEY = 'basafy:gmail-watch-expiry';
// Renew when < 24 h remain (watches expire after 7 days)
const RENEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function expiryKey(userId: string) {
  return `${WATCH_EXPIRY_KEY}:${userId}`;
}

export type WatchSetupResult = {
  ok: boolean;
  history_id?: string;
  expiration?: string;
  expires_at?: string;
  error?: string;
};

/**
 * Register (or re-register) a Gmail push watch for this user.
 * Calls the `gmail-sync-user` Edge Function with `action: 'setup_watch'`.
 * Stores the expiry locally so `renewWatchIfNeeded` can check it cheaply.
 */
export async function setupGmailWatch(session?: Session | null): Promise<WatchSetupResult> {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  if (!resolvedSession?.access_token) {
    return { ok: false, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('gmail-sync-user', {
      headers: { Authorization: `Bearer ${resolvedSession.access_token}` },
      body: { action: 'setup_watch' },
    });

    if (error || !data?.ok) {
      console.warn('[gmailWatch] setup_watch failed', error ?? data);
      return { ok: false, error: error?.message ?? data?.error ?? 'setup_watch failed' };
    }

    // Persist expiry so we can check cheaply on next launch
    if (data.expiration && resolvedSession.user?.id) {
      await AsyncStorage.setItem(expiryKey(resolvedSession.user.id), String(data.expiration));
    }

    console.info('[gmailWatch] watch set up', {
      history_id: data.history_id,
      expires_at: data.expires_at,
    });

    return {
      ok: true,
      history_id: data.history_id,
      expiration: data.expiration,
      expires_at: data.expires_at,
    };
  } catch (e: any) {
    console.warn('[gmailWatch] setup_watch exception', e);
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/**
 * Checks if the Gmail push watch is approaching expiry and renews it if needed.
 * Call this on app launch after the user is authenticated.
 * Returns true if a renewal was performed.
 */
export async function renewWatchIfNeeded(session?: Session | null): Promise<boolean> {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  const userId = resolvedSession?.user?.id;
  if (!userId) return false;

  const storedExpiry = await AsyncStorage.getItem(expiryKey(userId));
  if (!storedExpiry) {
    // No watch on record — set one up
    const result = await setupGmailWatch(resolvedSession);
    return result.ok;
  }

  const expiryMs = Number(storedExpiry);
  const timeRemaining = expiryMs - Date.now();

  if (timeRemaining > RENEW_THRESHOLD_MS) {
    // Still has plenty of time; skip
    return false;
  }

  console.info('[gmailWatch] renewing watch', { hoursRemaining: (timeRemaining / 3_600_000).toFixed(1) });
  const result = await setupGmailWatch(resolvedSession);
  return result.ok;
}
