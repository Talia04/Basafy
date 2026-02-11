-- Migration: Schema cleanup for applications, job_email_events, tasks, notifications

-- Keep application columns used by the app and views.
-- (role_title, notes, location are still referenced in multiple views and screens)

-- Skip type changes here because views depend on these columns.
-- If needed, perform type changes in a separate migration that drops/recreates dependent views.

-- Remove obsolete columns from job_email_events
alter table public.job_email_events drop column if exists raw_subject;
alter table public.job_email_events drop column if exists raw_from;
alter table public.job_email_events drop column if exists raw_snippet;
alter table public.job_email_events drop column if exists received_at;

-- Remove obsolete columns from tasks
alter table public.tasks drop column if exists notes;

-- Remove obsolete columns from notifications
alter table public.notifications drop column if exists metadata;

-- Add comments for future maintainers
comment on table public.applications is 'Job applications table, cleaned up for consistency';
comment on table public.job_email_events is 'Job email events table, cleaned up for consistency';
comment on table public.tasks is 'Tasks table, cleaned up for consistency';
comment on table public.notifications is 'Notifications table, cleaned up for consistency';
