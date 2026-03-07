-- Add message_features to job_email_events
-- This allows storing flexible extracted data without schema changes.

alter table public.job_email_events
  add column if not exists message_features jsonb default '{}'::jsonb;
