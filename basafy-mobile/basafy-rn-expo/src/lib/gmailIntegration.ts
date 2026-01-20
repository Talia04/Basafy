import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@backend/supabase/client';
import type { Session } from '@supabase/supabase-js';

const GMAIL_ONBOARDING_KEY = 'basafy:gmail-onboarding-completed';

function keyForUser(userId: string) {
  return `${GMAIL_ONBOARDING_KEY}:${userId}`;
}

async function getCurrentUser() {
  return (await supabase.auth.getSession()).data.session?.user;
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
  }
) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  if (!resolvedSession?.access_token) {
    throw new Error('Not authenticated.');
  }
  let body: Record<string, unknown> | undefined;
  if (options?.enrichOnly) {
    body = { enrich_only: true, max_messages: options?.maxMessages ?? null };
  } else if (options?.hardSync) {
    body = {
      hard_sync: true,
      page_token: options?.pageToken ?? null,
      max_messages: options?.maxMessages ?? null,
      ...(options?.lookback_months ? { lookback_months: options.lookback_months } : {}),
    };
  } else if (options?.lightSync) {
    body = { light_sync: true, max_messages: options?.maxMessages ?? null };
  }
  const { data, error } = await supabase.functions.invoke('gmail-sync-user', {
    headers: { Authorization: `Bearer ${resolvedSession.access_token}` },
    body,
  });
  if (error) {
    let responseText: string | null = null;
    const response = (error as any)?.context;
    if (response && typeof response.text === 'function') {
      try {
        responseText = await response.text();
      } catch {
        responseText = null;
      }
    }
    console.error('gmail-sync-user failed', {
      message: error.message,
      status: (response as any)?.status ?? null,
      responseText,
      details: (error as any)?.context ?? null,
      data,
    });
    throw error;
  }
  return data as { ok?: boolean; processed?: number; messages?: any; debug?: any; next_page_token?: string | null };
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
