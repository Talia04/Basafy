-- Migration: Schema cleanup for applications, job_email_events, tasks, notifications

-- Remove redundant columns from applications
alter table public.applications drop column if exists role_title;
alter table public.applications drop column if exists location;
alter table public.applications drop column if exists notes;

-- Standardize types and names (example: ensure status is text, not varchar)
alter table public.applications alter column status type text;
alter table public.job_email_events alter column event_type type text;
alter table public.tasks alter column status type text;
alter table public.notifications alter column subtype type text;

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
