-- ============================================================
-- Basafy – backend Gmail polling fallback
-- ============================================================
-- Schedules the `gmail-sync-cron` Edge Function every 15 minutes.
--
-- Before running:
-- 1. Deploy:
--      supabase functions deploy gmail-sync-user
--      supabase functions deploy gmail-sync-cron
-- 2. Set secret:
--      supabase secrets set GMAIL_PUSH_SECRET=<strong-random-value>
-- 3. Replace <anon-key> and <gmail-push-secret> below with real values.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'basafy-gmail-sync-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://iwjtlncxbmftrwcgldbj.supabase.co/functions/v1/gmail-sync-cron',
    body    := '{"limit":25,"concurrency":3}'::jsonb,
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon-key>","X-Push-Secret":"<gmail-push-secret>"}'::jsonb
  );
  $$
);

SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'basafy-gmail-sync-cron';
