-- Backfill applied_at for Gmail applications using earliest job_email_events
-- Prefer application_received; fallback to earliest available event in thread/app

with per_app as (
  select
    a.id as application_id,
    a.user_id,
    min(e.received_at) filter (where e.event_type = 'application_received') as first_applied,
    min(e.received_at) as first_any
  from public.applications a
  join public.job_email_events e
    on e.user_id = a.user_id
   and (
     e.application_id = a.id
     or (e.application_id is null and e.gmail_thread_id = a.gmail_thread_id)
   )
  where a.source_type = 'gmail'
    and e.received_at is not null
  group by a.id, a.user_id
)
update public.applications a
set applied_at = coalesce(a.applied_at, p.first_applied, p.first_any)
from per_app p
where a.id = p.application_id
  and (a.applied_at is null or a.applied_at > coalesce(p.first_applied, p.first_any));
