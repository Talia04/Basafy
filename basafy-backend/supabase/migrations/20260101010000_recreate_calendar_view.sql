-- Migration: recreate v_calendar_events to include application + company details

drop view if exists public.v_calendar_events;

create view public.v_calendar_events as
select
  date_trunc('month', e.start_at)::date as month_start,
  e.start_at::date as event_date,
  e.id,
  e.application_id,
  a.company as company,
  a.role_title as role_title,
  e.event_type,
  e.title,
  e.source_type,
  e.provider,
  e.meeting_link,
  e.start_at,
  e.end_at
from public.events e
left join public.applications a on a.id = e.application_id
where e.user_id = auth.uid();
