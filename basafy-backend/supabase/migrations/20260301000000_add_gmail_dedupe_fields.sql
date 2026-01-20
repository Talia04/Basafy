-- Add dedupe identifiers to applications and job_email_events

alter table public.applications
  add column if not exists canonical_key text,
  add column if not exists portal_domain text,
  add column if not exists requisition_id text,
  add column if not exists job_id text,
  add column if not exists external_application_id text;

alter table public.job_email_events
  add column if not exists internet_message_id text,
  add column if not exists canonical_key text,
  add column if not exists portal_domain text,
  add column if not exists requisition_id text,
  add column if not exists job_id text,
  add column if not exists external_application_id text;

create index if not exists applications_user_canonical_key_idx
  on public.applications (user_id, canonical_key);

create index if not exists applications_user_requisition_id_idx
  on public.applications (user_id, requisition_id);

create index if not exists applications_user_job_id_idx
  on public.applications (user_id, job_id);

create index if not exists applications_user_external_application_id_idx
  on public.applications (user_id, external_application_id);

create index if not exists job_email_events_user_internet_message_id_idx
  on public.job_email_events (user_id, internet_message_id);
