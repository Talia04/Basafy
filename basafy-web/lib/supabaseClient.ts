import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        // Disable auto-detection so only CallbackClient.tsx exchanges the PKCE code.
        // With detectSessionInUrl: true, the client auto-exchanges the code on page load
        // AND CallbackClient calls exchangeCodeForSession — the second call fails with
        // "invalid grant / code already used", leaving the user stuck.
        detectSessionInUrl: false,
        persistSession: true,
      },
    })
  : null;

export { supabaseUrl };
