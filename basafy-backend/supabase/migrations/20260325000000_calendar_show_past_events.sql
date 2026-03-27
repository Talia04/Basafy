-- Ensure v_calendar_events includes ALL events (past and future).
-- An older version of this view may have had a start_at >= now() filter on production.
create or replace view public.v_calendar_events as
select
  date_trunc('month', e.start_at)::date as month_start,
  e.start_at::date                       as event_date,
  e.id,
  e.application_id,
  e.event_type,
  e.title,
  a.company                              as company,
  a.role_title                           as role_title,
  e.provider,
  e.meeting_link,
  e.start_at,
  e.end_at,
  e.location,
  e.source_type
from public.events e
left join public.applications a on a.id = e.application_id
where e.user_id = auth.uid();
