-- Restore received_at on job_email_events.
-- This column was dropped in 20260210_schema_cleanup.sql but is needed
-- to store the Gmail message receipt timestamp so the timeline shows
-- actual email dates rather than DB processing timestamps.

alter table public.job_email_events
  add column if not exists received_at timestamptz;

-- Index: applications ordered by applied_at per user.
-- Queries on the applications list and pipeline now use applied_at DESC
-- instead of created_at DESC, so an index is needed for performance.
create index if not exists idx_applications_user_applied_at
  on public.applications(user_id, applied_at desc nulls last);

-- Index: job_email_events by application_id for the detail screen timeline.
create index if not exists idx_job_email_events_application_id
  on public.job_email_events(application_id, received_at asc);
