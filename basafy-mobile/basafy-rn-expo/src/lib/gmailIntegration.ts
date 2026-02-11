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

export async function isMockReviewer(session?: Session | null) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  const user = resolvedSession?.user;
  return Boolean((user as any)?.user_metadata?.is_mock);
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
  }
) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  if (!resolvedSession?.access_token) {
    throw new Error('Not authenticated.');
  }
  let body: Record<string, unknown> | undefined;
  const usePipeline =
    options?.usePipeline ??
    (options?.lightSync || (!options?.hardSync && !options?.enrichOnly));
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
    body = {
      light_sync: true,
      max_messages: options?.maxMessages ?? 30,
      ...(usePipeline ? { use_pipeline: true } : {}),
    };
  } else {
    body = usePipeline ? { use_pipeline: true, max_messages: options?.maxMessages ?? 40 } : undefined;
  }

  const invoke = async (payload?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('gmail-sync-user', {
      headers: { Authorization: `Bearer ${resolvedSession.access_token}` },
      body: payload,
    });
    if (!error) {
      return data as { ok?: boolean; processed?: number; messages?: any; debug?: any; next_page_token?: string | null };
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
        return retryData as { ok?: boolean; processed?: number; messages?: any; debug?: any; next_page_token?: string | null };
      }
    }

    throw error;
  };

  return invoke(body);
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
    .update({ refresh_token: null })
    .eq("user_id", user.id);
    
  if (error) {
    throw error;
  }
  
  return { ok: true };
}
