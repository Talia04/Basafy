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

export async function syncGmailApplications(session?: Session | null) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  if (!resolvedSession?.access_token) {
    throw new Error('Not authenticated.');
  }
  const { data, error } = await supabase.functions.invoke('gmail-sync-user', {
    headers: { Authorization: `Bearer ${resolvedSession.access_token}` },
  });
  if (error) {
    throw error;
  }
  return data as { ok?: boolean; processed?: number; messages?: any; debug?: any };
}

export async function fetchGmailConnection(session?: Session | null) {
  const resolvedSession = session ?? (await supabase.auth.getSession()).data.session;
  const user = resolvedSession?.user;
  if (!user?.id) {
    return null;
  }
  const { data, error } = await supabase
    .from('gmail_connections')
    .select('email,provider,refresh_token')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .maybeSingle();
  if (error) {
    throw error;
  }
  return (data as { email: string; provider: string; refresh_token: string | null } | null) ?? null;
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
