-- Migration: extend gmail_sync_logs for detailed sync stats

alter table public.gmail_sync_logs
  add column if not exists sync_type text,
  add column if not exists total_messages_fetched integer default 0,
  add column if not exists job_email_events_created integer default 0,
  add column if not exists job_email_events_updated integer default 0,
  add column if not exists applications_created integer default 0,
  add column if not exists applications_updated integer default 0;
