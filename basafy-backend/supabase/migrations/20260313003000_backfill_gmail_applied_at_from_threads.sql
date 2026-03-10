-- Backfill applied_at for Gmail applications using earliest application_received email per thread

with earliest_thread_received as (
  select
    user_id,
    gmail_thread_id,
    min(received_at) as first_received_at
  from public.job_email_events
  where event_type = 'application_received'
    and gmail_thread_id is not null
    and received_at is not null
  group by user_id, gmail_thread_id
)
update public.applications a
set applied_at = e.first_received_at
from earliest_thread_received e
where a.user_id = e.user_id
  and a.gmail_thread_id = e.gmail_thread_id
  and a.source_type = 'gmail'
  and (a.applied_at is null or a.applied_at > e.first_received_at);
