-- Migration: recreate v_home_upcoming_events to add company and role_title

drop view if exists public.v_home_upcoming_events;

create view public.v_home_upcoming_events as
select
  e.id,
  e.application_id,
  e.event_type,
  e.title,
  a.company as company,
  a.role_title as role_title,
  e.provider,
  e.meeting_link,
  e.start_at,
  e.end_at,
  e.location,
  e.source_type
from public.events e
left join public.applications a on a.id = e.application_id
where e.user_id = auth.uid()
  and e.start_at >= now()
order by e.start_at asc
limit 5;
