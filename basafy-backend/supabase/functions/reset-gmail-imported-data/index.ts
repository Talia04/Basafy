// Edge function: reset Gmail-imported applications for the current user
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
} from '../_shared/secrets.ts';

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const SUPABASE_SERVICE_ROLE_KEY = getSupabaseServiceRoleKey();

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

serve(async (req: Request) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Service misconfigured' }, 500);
    }

    const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('reset-gmail-imported-data env', {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
      user_id: user.id,
    });

    // Step 1: Find Gmail application IDs for this user
    const { data: gmailApps, error: gmailAppsError } = await admin
      .from('applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('source_type', 'gmail');
    if (gmailAppsError) {
      console.error('reset-gmail-imported-data gmailAppsError', gmailAppsError);
      return jsonResponse({ error: gmailAppsError.message, details: gmailAppsError }, 500);
    }
    const gmailAppIds = (gmailApps ?? []).map((row: any) => row.id);

    // Step 2: Delete dependent records for Gmail applications first
    const { error: tasksDeleteError } = await admin
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .eq('origin', 'gmail');
    if (tasksDeleteError) {
      console.error('reset-gmail-imported-data tasksDeleteError', tasksDeleteError);
      return jsonResponse({ error: tasksDeleteError.message, details: tasksDeleteError }, 500);
    }

    const { error: calendarDeleteError } = await admin
      .from('events')
      .delete()
      .eq('user_id', user.id)
      .eq('source_type', 'gmail');
    if (calendarDeleteError) {
      console.error('reset-gmail-imported-data eventsTableDeleteError', calendarDeleteError);
      return jsonResponse({ error: calendarDeleteError.message, details: calendarDeleteError }, 500);
    }

    // Step 3: Delete job_email_events for this user (avoid huge IN payloads)
    const { error: eventsDeleteError } = await admin
      .from('job_email_events')
      .delete()
      .eq('user_id', user.id);
    if (eventsDeleteError) {
      console.error('reset-gmail-imported-data eventsDeleteError', eventsDeleteError);
      return jsonResponse({ error: eventsDeleteError.message, details: eventsDeleteError }, 500);
    }

    // Step 4: Reset applications.last_synced_at for Gmail rows (defensive for resync)
    // Step 3: Delete tasks tied to Gmail applications
    if (gmailAppIds.length > 0) {
      const { error: tasksDeleteError } = await admin
        .from('tasks')
        .delete()
        .in('application_id', gmailAppIds);
      if (tasksDeleteError) {
        console.error('reset-gmail-imported-data tasksDeleteError', tasksDeleteError);
        return jsonResponse({ error: tasksDeleteError.message, details: tasksDeleteError }, 500);
      }
    }

    // Step 4: Delete events tied to Gmail applications
    if (gmailAppIds.length > 0) {
      const { error: eventsDeleteError } = await admin
        .from('events')
        .delete()
        .in('application_id', gmailAppIds);
      if (eventsDeleteError) {
        console.error('reset-gmail-imported-data eventsDeleteError', eventsDeleteError);
        return jsonResponse({ error: eventsDeleteError.message, details: eventsDeleteError }, 500);
      }
    }

    // Step 5: Reset applications.last_synced_at for Gmail rows (defensive for resync)
    const { error: resetAppsSyncError } = await admin
      .from('applications')
      .update({ last_synced_at: null })
      .eq('user_id', user.id)
      .eq('source_type', 'gmail');
    if (resetAppsSyncError) {
      console.error('reset-gmail-imported-data resetAppsSyncError', resetAppsSyncError);
      return jsonResponse({ error: resetAppsSyncError.message, details: resetAppsSyncError }, 500);
    }

    // Step 5: Delete Gmail applications
    // Step 6: Delete Gmail applications
    const { data: deletedRows, error: deleteError } = await admin
      .from('applications')
      .delete()
      .eq('user_id', user.id)
      .eq('source_type', 'gmail')
      .select('id');

    if (deleteError) {
      console.error('reset-gmail-imported-data deleteError', deleteError);
      return jsonResponse({ error: deleteError.message, details: deleteError }, 500);
    }

    // Step 6: Reset last_synced_at for gmail_connections
    // Step 7: Reset last_synced_at for gmail_connections
    const { error: resetSyncError } = await admin
      .from('gmail_connections')
      .update({ last_synced_at: null })
      .eq('user_id', user.id)
      .eq('provider', 'google');
    if (resetSyncError) {
      console.error('reset-gmail-imported-data resetSyncError', resetSyncError);
      return jsonResponse({ error: resetSyncError.message, details: resetSyncError }, 500);
    }

    const deletedCount = deletedRows?.length ?? 0;
    console.log('reset-gmail-imported-data', { user_id: user.id, deleted: deletedCount });

    return jsonResponse({
      ok: true,
      deleted: deletedCount,
      last_synced_at_reset: true,
      applications_last_synced_at_reset: true,
    });
  } catch (err: any) {
    console.error('reset-gmail-imported-data unhandled error', err);
    return jsonResponse({ error: err?.message || 'Unhandled error' }, 500);
  }
});
