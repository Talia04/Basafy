// Edge function: delete user account and all related data
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
  const logger = createLogger('delete-account');
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
    logger.info('User authenticated, deleting account');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const profileId = profile?.id ?? user.id;

    const isMissingColumn = (error: any, column: string) =>
      error?.code === '42703' && typeof error?.message === 'string' && error.message.includes(column);

    const deleteTable = async (table: string, filter: Record<string, string>) => {
      let query = admin.from(table).delete();
      for (const [key, value] of Object.entries(filter)) {
        query = query.eq(key, value);
      }
      let result = await query.select('id');
      if (result.error && isMissingColumn(result.error, `${table}.id`)) {
        result = await query.select('*');
      }
      return result;
    };

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

    let tasksDelete = await deleteByColumnOr('tasks', 'user_id', [profileId, user.id]);
    if (tasksDelete.error && isMissingColumn(tasksDelete.error, 'tasks.user_id')) {
      tasksDelete = await deleteByColumnOr('tasks', 'profile_id', [profileId, user.id]);
    }
    if (tasksDelete.error && isMissingColumn(tasksDelete.error, 'tasks.profile_id')) {
      try {
        const appIds = await getApplicationIds();
        tasksDelete = await deleteByApplicationIds('tasks', appIds);
      } catch (err: any) {
        logger.error('Failed to resolve applications for task deletion', err);
        return jsonResponse({ error: err?.message || 'Failed to resolve applications', details: err }, 500);
      }
    }
    if (tasksDelete.error) {
      logger.error('Failed to delete tasks', tasksDelete.error);
      return jsonResponse({ error: tasksDelete.error.message, details: tasksDelete.error }, 500);
    }

    let eventsDelete = await deleteByColumnOr('events', 'user_id', [profileId, user.id]);
    if (eventsDelete.error && isMissingColumn(eventsDelete.error, 'events.user_id')) {
      eventsDelete = await deleteByColumnOr('events', 'profile_id', [profileId, user.id]);
    }
    if (eventsDelete.error && isMissingColumn(eventsDelete.error, 'events.profile_id')) {
      try {
        const appIds = await getApplicationIds();
        eventsDelete = await deleteByApplicationIds('events', appIds);
      } catch (err: any) {
        logger.error('Failed to resolve applications for event deletion', err);
        return jsonResponse({ error: err?.message || 'Failed to resolve applications', details: err }, 500);
      }
    }
    if (eventsDelete.error) {
      logger.error('Failed to delete events', eventsDelete.error);
      return jsonResponse({ error: eventsDelete.error.message, details: eventsDelete.error }, 500);
    }

    const jobEmailDelete = await deleteTable('job_email_events', { user_id: user.id });
    if (jobEmailDelete.error) {
      logger.error('Failed to delete job_email_events', jobEmailDelete.error);
      return jsonResponse({ error: jobEmailDelete.error.message, details: jobEmailDelete.error }, 500);
    }

    const notificationsDelete = await deleteTable('notifications', { user_id: user.id });
    if (notificationsDelete.error) {
      logger.error('Failed to delete notifications', notificationsDelete.error);
      return jsonResponse({ error: notificationsDelete.error.message, details: notificationsDelete.error }, 500);
    }

    const applicationsDelete = await deleteTable('applications', { user_id: user.id });
    if (applicationsDelete.error) {
      logger.error('Failed to delete applications', applicationsDelete.error);
      return jsonResponse({ error: applicationsDelete.error.message, details: applicationsDelete.error }, 500);
    }

    const gmailSyncLogsDelete = await deleteTable('gmail_sync_logs', { user_id: user.id });
    if (gmailSyncLogsDelete.error) {
      logger.error('Failed to delete gmail_sync_logs', gmailSyncLogsDelete.error);
      return jsonResponse({ error: gmailSyncLogsDelete.error.message, details: gmailSyncLogsDelete.error }, 500);
    }

    const gmailSyncStateDelete = await deleteTable('gmail_sync_state', { user_id: user.id });
    if (gmailSyncStateDelete.error) {
      logger.error('Failed to delete gmail_sync_state', gmailSyncStateDelete.error);
      return jsonResponse({ error: gmailSyncStateDelete.error.message, details: gmailSyncStateDelete.error }, 500);
    }

    const gmailConnectionsDelete = await deleteTable('gmail_connections', { user_id: user.id });
    if (gmailConnectionsDelete.error) {
      logger.error('Failed to delete gmail_connections', gmailConnectionsDelete.error);
      return jsonResponse({ error: gmailConnectionsDelete.error.message, details: gmailConnectionsDelete.error }, 500);
    }

    const devicesDelete = await deleteTable('user_devices', { user_id: user.id });
    if (devicesDelete.error) {
      logger.error('Failed to delete user_devices', devicesDelete.error);
      return jsonResponse({ error: devicesDelete.error.message, details: devicesDelete.error }, 500);
    }

    const settingsDelete = await deleteTable('user_notification_settings', { user_id: user.id });
    if (settingsDelete.error) {
      logger.error('Failed to delete notification settings', settingsDelete.error);
      return jsonResponse({ error: settingsDelete.error.message, details: settingsDelete.error }, 500);
    }

    const mockDelete = await deleteTable('mock_gmail_messages', { user_id: user.id });
    if (mockDelete.error) {
      logger.error('Failed to delete mock_gmail_messages', mockDelete.error);
      return jsonResponse({ error: mockDelete.error.message, details: mockDelete.error }, 500);
    }

    let profilesDelete = await admin
      .from('profiles')
      .delete()
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .select('id');
    if (profilesDelete.error && isMissingColumn(profilesDelete.error, 'profiles.user_id')) {
      profilesDelete = await admin
        .from('profiles')
        .delete()
        .eq('id', user.id)
        .select('id');
    }
    if (profilesDelete.error) {
      logger.error('Failed to delete profile', profilesDelete.error);
      return jsonResponse({ error: profilesDelete.error.message, details: profilesDelete.error }, 500);
    }

    const deleteUserResult = await admin.auth.admin.deleteUser(user.id);
    if (deleteUserResult.error) {
      logger.error('Failed to delete auth user', deleteUserResult.error);
      return jsonResponse({ error: deleteUserResult.error.message, details: deleteUserResult.error }, 500);
    }

    logger.info('Account deleted successfully');
    return jsonResponse({
      ok: true,
      deleted: {
        tasks: tasksDelete.data?.length ?? 0,
        events: eventsDelete.data?.length ?? 0,
        job_email_events: jobEmailDelete.data?.length ?? 0,
        notifications: notificationsDelete.data?.length ?? 0,
        applications: applicationsDelete.data?.length ?? 0,
        gmail_sync_logs: gmailSyncLogsDelete.data?.length ?? 0,
        gmail_sync_state: gmailSyncStateDelete.data?.length ?? 0,
        gmail_connections: gmailConnectionsDelete.data?.length ?? 0,
        user_devices: devicesDelete.data?.length ?? 0,
        notification_settings: settingsDelete.data?.length ?? 0,
        mock_gmail_messages: mockDelete.data?.length ?? 0,
        profiles: profilesDelete.data?.length ?? 0,
      },
    });
  } catch (err: any) {
    logger.error('Unhandled error in delete-account', err);
    return jsonResponse({ error: err?.message || 'Unhandled error', requestId }, 500);
  }
});
