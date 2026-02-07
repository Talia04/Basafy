// Edge function: reset Gmail-imported applications for the current user
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
} from '../_shared/secrets.ts';
import {
  createLogger,
  generateRequestId,
} from '../_shared/logger.ts';

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const SUPABASE_SERVICE_ROLE_KEY = getSupabaseServiceRoleKey();

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

serve(async (req: Request) => {
  const logger = createLogger('reset-gmail-imported-data');
  const requestId = generateRequestId();
  logger.setRequestId(requestId).startTimer();

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('Service misconfigured - missing environment variables');
      return jsonResponse({ error: 'Service misconfigured' }, 500);
    }

    const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) {
      logger.warn('Unauthorized request - no token');
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
      logger.warn('Unauthorized - invalid token or user not found');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    logger.setUserId(user.id);
    logger.info('User authenticated, starting Gmail data reset');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Find Gmail application IDs for this user
    const { data: gmailApps, error: gmailAppsError } = await admin
      .from('applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('source_type', 'gmail');
    if (gmailAppsError) {
      logger.error('Failed to fetch Gmail applications', gmailAppsError);
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
      logger.error('Failed to delete tasks', tasksDeleteError);
      return jsonResponse({ error: tasksDeleteError.message, details: tasksDeleteError }, 500);
    }

    const { error: calendarDeleteError } = await admin
      .from('events')
      .delete()
      .eq('user_id', user.id)
      .eq('source_type', 'gmail');
    if (calendarDeleteError) {
      logger.error('Failed to delete events', calendarDeleteError);
      return jsonResponse({ error: calendarDeleteError.message, details: calendarDeleteError }, 500);
    }

    // Step 3: Delete job_email_events for this user
    const { error: eventsDeleteError } = await admin
      .from('job_email_events')
      .delete()
      .eq('user_id', user.id);
    if (eventsDeleteError) {
      logger.error('Failed to delete job_email_events', eventsDeleteError);
      return jsonResponse({ error: eventsDeleteError.message, details: eventsDeleteError }, 500);
    }

    // Step 4: Delete tasks tied to Gmail applications
    if (gmailAppIds.length > 0) {
      const { error: tasksDeleteError2 } = await admin
        .from('tasks')
        .delete()
        .in('application_id', gmailAppIds);
      if (tasksDeleteError2) {
        logger.error('Failed to delete tasks by application_id', tasksDeleteError2);
        return jsonResponse({ error: tasksDeleteError2.message, details: tasksDeleteError2 }, 500);
      }
    }

    // Step 5: Delete events tied to Gmail applications
    if (gmailAppIds.length > 0) {
      const { error: eventsDeleteError2 } = await admin
        .from('events')
        .delete()
        .in('application_id', gmailAppIds);
      if (eventsDeleteError2) {
        logger.error('Failed to delete events by application_id', eventsDeleteError2);
        return jsonResponse({ error: eventsDeleteError2.message, details: eventsDeleteError2 }, 500);
      }
    }

    // Step 6: Reset applications.last_synced_at for Gmail rows
    const { error: resetAppsSyncError } = await admin
      .from('applications')
      .update({ last_synced_at: null })
      .eq('user_id', user.id)
      .eq('source_type', 'gmail');
    if (resetAppsSyncError) {
      logger.error('Failed to reset applications last_synced_at', resetAppsSyncError);
      return jsonResponse({ error: resetAppsSyncError.message, details: resetAppsSyncError }, 500);
    }

    // Step 7: Delete Gmail applications
    const { data: deletedRows, error: deleteError } = await admin
      .from('applications')
      .delete()
      .eq('user_id', user.id)
      .eq('source_type', 'gmail')
      .select('id');

    if (deleteError) {
      logger.error('Failed to delete Gmail applications', deleteError);
      return jsonResponse({ error: deleteError.message, details: deleteError }, 500);
    }

    // Step 8: Reset last_synced_at for gmail_connections
    const { error: resetSyncError } = await admin
      .from('gmail_connections')
      .update({ last_synced_at: null })
      .eq('user_id', user.id)
      .eq('provider', 'google');
    if (resetSyncError) {
      logger.error('Failed to reset gmail_connections last_synced_at', resetSyncError);
      return jsonResponse({ error: resetSyncError.message, details: resetSyncError }, 500);
    }

    const deletedCount = deletedRows?.length ?? 0;
    logger.info('Gmail data reset completed', { deleted: deletedCount });

    return jsonResponse({
      ok: true,
      deleted: deletedCount,
      last_synced_at_reset: true,
      applications_last_synced_at_reset: true,
    });
  } catch (err: any) {
    logger.error('Unhandled error in reset-gmail-imported-data', err);
    return jsonResponse({ error: err?.message || 'Unhandled error', requestId }, 500);
  }
});
