import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const storageKey = 'basafy-web-auth-token';

const browserStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        // Keep PKCE/session state in browser storage so the callback page can
        // still read the verifier after the OAuth redirect reloads the app.
        storage: browserStorage,
        storageKey,
        // Disable auto-detection so only CallbackClient.tsx exchanges the PKCE code.
        detectSessionInUrl: false,
        persistSession: true,
      },
    })
  : null;

export { supabaseUrl };
