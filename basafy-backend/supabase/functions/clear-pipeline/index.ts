// Edge function: clear all pipeline data for the current user
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
} from '../_shared/secrets.ts';
import { createLogger, generateRequestId } from '../_shared/logger.ts';

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const SUPABASE_SERVICE_ROLE_KEY = getSupabaseServiceRoleKey();

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

serve(async (req: Request) => {
  const logger = createLogger('clear-pipeline');
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
    logger.info('User authenticated, clearing pipeline data');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const profileId = profile?.id ?? user.id;

    const isMissingColumn = (error: any, column: string) =>
      error?.code === '42703' && typeof error?.message === 'string' && error.message.includes(column);

    const getApplicationIds = async () => {
      const { data: apps, error: appsError } = await admin
        .from('applications')
        .select('id')
        .eq('user_id', user.id);
      if (appsError) {
        throw appsError;
      }
      return (apps ?? []).map((row: any) => row.id) as string[];
    };

    const deleteByColumnOr = async (table: string, column: string, ids: Array<string | null | undefined>) => {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean))) as string[];
      if (uniqueIds.length === 0) return { data: [], error: null };
      const orClause = uniqueIds.map((id) => `${column}.eq.${id}`).join(',');
      return await admin.from(table).delete().or(orClause).select('id');
    };

    const deleteByApplicationIds = async (table: string, appIds: string[]) => {
      if (appIds.length === 0) return { data: [], error: null };
      return await admin.from(table).delete().in('application_id', appIds).select('id');
    };

    let taskDelete = await deleteByColumnOr('tasks', 'user_id', [profileId, user.id]);
    if (taskDelete.error && isMissingColumn(taskDelete.error, 'tasks.user_id')) {
      taskDelete = await deleteByColumnOr('tasks', 'profile_id', [profileId, user.id]);
    }
    if (taskDelete.error && isMissingColumn(taskDelete.error, 'tasks.profile_id')) {
      try {
        const appIds = await getApplicationIds();
        taskDelete = await deleteByApplicationIds('tasks', appIds);
      } catch (err: any) {
        logger.error('Failed to resolve applications for task deletion', err);
        return jsonResponse({ error: err?.message || 'Failed to resolve applications', details: err }, 500);
      }
    }
    if (taskDelete.error) {
      logger.error('Failed to delete tasks', taskDelete.error);
      return jsonResponse({ error: taskDelete.error.message, details: taskDelete.error }, 500);
    }

    let eventDelete = await deleteByColumnOr('events', 'user_id', [profileId, user.id]);
    if (eventDelete.error && isMissingColumn(eventDelete.error, 'events.user_id')) {
      eventDelete = await deleteByColumnOr('events', 'profile_id', [profileId, user.id]);
    }
    if (eventDelete.error && isMissingColumn(eventDelete.error, 'events.profile_id')) {
      try {
        const appIds = await getApplicationIds();
        eventDelete = await deleteByApplicationIds('events', appIds);
      } catch (err: any) {
        logger.error('Failed to resolve applications for event deletion', err);
        return jsonResponse({ error: err?.message || 'Failed to resolve applications', details: err }, 500);
      }
    }
    if (eventDelete.error) {
      logger.error('Failed to delete events', eventDelete.error);
      return jsonResponse({ error: eventDelete.error.message, details: eventDelete.error }, 500);
    }

    const jobEmailDelete = await admin
      .from('job_email_events')
      .delete()
      .eq('user_id', user.id)
      .select('id');
    if (jobEmailDelete.error) {
      logger.error('Failed to delete job_email_events', jobEmailDelete.error);
      return jsonResponse({ error: jobEmailDelete.error.message, details: jobEmailDelete.error }, 500);
    }

    const notificationDelete = await admin
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .select('id');
    if (notificationDelete.error) {
      logger.error('Failed to delete notifications', notificationDelete.error);
      return jsonResponse({ error: notificationDelete.error.message, details: notificationDelete.error }, 500);
    }

    const applicationDelete = await admin
      .from('applications')
      .delete()
      .eq('user_id', user.id)
      .select('id');
    if (applicationDelete.error) {
      logger.error('Failed to delete applications', applicationDelete.error);
      return jsonResponse({ error: applicationDelete.error.message, details: applicationDelete.error }, 500);
    }

    const deleted = {
      tasks: taskDelete.data?.length ?? 0,
      events: eventDelete.data?.length ?? 0,
      job_email_events: jobEmailDelete.data?.length ?? 0,
      notifications: notificationDelete.data?.length ?? 0,
      applications: applicationDelete.data?.length ?? 0,
    };

    logger.info('Pipeline data cleared', deleted);
    return jsonResponse({ ok: true, deleted });
  } catch (err: any) {
    logger.error('Unhandled error in clear-pipeline', err);
    return jsonResponse({ error: err?.message || 'Unhandled error', requestId }, 500);
  }
});
