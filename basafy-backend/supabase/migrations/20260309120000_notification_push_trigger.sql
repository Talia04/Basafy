-- Wires up the notifications table to the notifications-push Edge Function.
-- When a row is INSERTed into notifications, pg_net POSTs a standard Supabase
-- webhook payload to the function, which handles Expo push delivery.
--
-- Enable pg_net (available on all Supabase Cloud projects)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Trigger function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _body jsonb;
BEGIN
  _body := jsonb_build_object(
    'type',       'INSERT',
    'table',      TG_TABLE_NAME,
    'schema',     TG_TABLE_SCHEMA,
    'record',     row_to_json(NEW)::jsonb,
    'old_record', null
  );

  PERFORM net.http_post(
    url     := 'https://iwjtlncxbmftrwcgldbj.supabase.co/functions/v1/notifications-push',
    body    := _body,
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3anRsbmN4Ym1mdHJ3Y2dsZGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NjYxOTksImV4cCI6MjA3OTI0MjE5OX0.Pucuhq8Y0jMwgJGlJi8WIePCy48-wXV9ojuls-yy3wA"}'::jsonb,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

-- ── Attach trigger ──────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_notification_insert ON public.notifications;

CREATE TRIGGER on_notification_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notification_push();
