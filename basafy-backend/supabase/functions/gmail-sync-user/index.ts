// Edge function: placeholder Gmail sync entry point
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

// Use non-SUPABASE_ prefixes because Supabase CLI blocks them in secrets
const SUPABASE_URL = Deno.env.get('PROJECT_URL');
const SUPABASE_ANON_KEY = Deno.env.get('ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');

serve(async (req: Request) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Service misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: { email?: string; provider?: string } | null = null;
  try {
    body = await req.json();
  } catch (_) {
    body = null;
  }

  const email = body?.email || user.email;
  const provider = body?.provider || 'google';

  const { error: upsertError } = await admin.from('gmail_connections').upsert(
    [
      {
        user_id: user.id,
        email,
        provider,
        refresh_token: 'stored-server-side',
        token_scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      },
    ],
    { onConflict: 'user_id,provider' },
  );

  if (upsertError) {
    return new Response(JSON.stringify({ error: upsertError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      user_id: user.id,
      email,
      provider,
      message: 'Gmail connection recorded',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});
