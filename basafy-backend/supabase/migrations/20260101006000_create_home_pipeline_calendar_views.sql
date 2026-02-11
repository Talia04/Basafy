-- Migration: create views for home metrics, upcoming, pipeline, and calendar

create or replace view public.v_home_metrics as
with apps as (
  select *
  from public.applications
  where user_id = auth.uid()
),
interviews as (
  select count(*)::int as count
  from public.events
  where user_id = auth.uid()
    and event_type = 'interview'
    and start_at >= now()
    and start_at < now() + interval '7 days'
),
open_tasks as (
  select count(*)::int as count
  from public.tasks
  where user_id = auth.uid()
    and status = 'open'
),
response_times as (
  select avg(date_part('day', fe.first_event_at - a.applied_at)) as avg_days
  from apps a
  join lateral (
    select min(e.start_at) as first_event_at
    from public.events e
    where e.user_id = a.user_id
      and e.application_id = a.id
  ) fe on true
  where a.applied_at is not null
    and fe.first_event_at is not null
)
select
  (select count(*) from apps where (status is null or status not in ('rejected', 'archived')))::int
    as total_active_applications,
  (select count from interviews) as interviews_next_7_days,
  (select count from open_tasks) as open_tasks,
  case
    when (select count(*) from apps) = 0 then 0
    else (select count(*) from apps where status = 'offer')::numeric / (select count(*) from apps)
  end as success_rate,
  (select avg_days from response_times) as avg_response_days;

create or replace view public.v_home_upcoming_events as
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

create or replace view public.v_pipeline_applications as
select
  id,
  status,
  applied_at,
  company,
  role_title
from public.applications
where user_id = auth.uid()
order by status nulls last, applied_at desc nulls last;

create or replace view public.v_calendar_events as
select
  date_trunc('month', start_at)::date as month_start,
  start_at::date as event_date,
  event_type,
  title,
  provider,
  meeting_link,
  start_at,
  end_at
from public.events
where user_id = auth.uid();
