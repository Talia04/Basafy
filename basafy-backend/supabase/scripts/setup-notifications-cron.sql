-- ============================================================
-- Basafy – one-time notification pipeline setup
-- ============================================================
-- Run this script ONCE in the Supabase SQL editor after:
--   1. Deploying all Edge Functions (see below)
--   2. Setting EXPO_ACCESS_TOKEN secret (see below)
--
-- Replace the two placeholder values at the top, then run.
-- ============================================================

-- ── Step 0: fill in your values ────────────────────────────
-- Find SUPABASE_URL in: Supabase Dashboard → Project Settings → API → Project URL
-- Find ANON_KEY in:     Supabase Dashboard → Project Settings → API → anon (public)

-- ── Step 1: enable required extensions ─────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── Step 2: schedule notifications-reminder (every 15 min) ─
SELECT cron.schedule(
  'basafy-notifications-reminder',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://iwjtlncxbmftrwcgldbj.supabase.co/functions/v1/notifications-reminder',
    body    := '{}'::jsonb,
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3anRsbmN4Ym1mdHJ3Y2dsZGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NjYxOTksImV4cCI6MjA3OTI0MjE5OX0.Pucuhq8Y0jMwgJGlJi8WIePCy48-wXV9ojuls-yy3wA"}'::jsonb
  );
  $$
);

-- ── Step 3: schedule notifications-push-delivery (every 5 min) ─
SELECT cron.schedule(
  'basafy-notifications-push-delivery',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://iwjtlncxbmftrwcgldbj.supabase.co/functions/v1/notifications-push-delivery',
    body    := '{}'::jsonb,
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3anRsbmN4Ym1mdHJ3Y2dsZGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NjYxOTksImV4cCI6MjA3OTI0MjE5OX0.Pucuhq8Y0jMwgJGlJi8WIePCy48-wXV9ojuls-yy3wA"}'::jsonb
  );
  $$
);

-- ── Verify ──────────────────────────────────────────────────
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'basafy-%';

-- ============================================================
-- Remaining manual steps (outside SQL):
--
-- 1. Deploy Edge Functions:
--      supabase functions deploy notifications-push
--      supabase functions deploy notifications-reminder
--      supabase functions deploy notifications-push-delivery
--      supabase functions deploy gmail-push-handler
--      supabase functions deploy gmail-sync-user
--
-- 2. Set EXPO_ACCESS_TOKEN secret:
--      supabase secrets set EXPO_ACCESS_TOKEN=<your-expo-token>
--    Get token from: https://expo.dev → Account → Access Tokens
--
-- 3. Gmail Push (optional, for instant new-email notifications):
--    a. Create GCP PubSub topic
--    b. Grant gmail-api@system.gserviceaccount.com Pub/Sub Publisher role
--    c. Create push subscription → <supabase-url>/functions/v1/gmail-push-handler
--    d. supabase secrets set GMAIL_PUSH_SECRET=<random> GMAIL_PUBSUB_TOPIC=projects/<p>/topics/<t>
-- ============================================================
