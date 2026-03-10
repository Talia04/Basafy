-- Fix get_insights_summary to match status variants used in the app UI.
-- The Applications screen treats status as a string and matches via "includes",
-- so we should do the same for Insights stage counts and response rate.

create or replace function public.get_insights_summary(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  total_applications int,
  stage_applied int,
  stage_assessment int,
  stage_interview int,
  stage_offer int,
  stage_rejected int,
  stage_archived int,
  response_rate numeric,
  avg_response_days numeric,
  open_tasks int,
  stalled_count int
)
language sql
stable
as $$
with params as (
  select p_start_at as start_at, p_end_at as end_at
),
apps as (
  select
    a.*,
    coalesce(a.applied_at, a.created_at) as applied_effective
  from public.applications a
  where a.user_id = auth.uid()
),
apps_in_range as (
  select a.*
  from apps a
  cross join params p
  where (p.start_at is null or a.applied_effective >= p.start_at)
    and (p.end_at is null or a.applied_effective < p.end_at)
),
apps_norm as (
  select
    a.*,
    lower(coalesce(a.status, '')) as status_norm
  from apps_in_range a
),
stage_counts as (
  select
    count(*)::int as total_applications,
    count(*) filter (
      where status_norm = '' or status_norm like 'applied%'
    )::int as stage_applied,
    count(*) filter (where status_norm like '%assessment%')::int as stage_assessment,
    count(*) filter (where status_norm like '%interview%')::int as stage_interview,
    count(*) filter (where status_norm like '%offer%')::int as stage_offer,
    count(*) filter (where status_norm like '%reject%')::int as stage_rejected,
    count(*) filter (where status_norm like '%archiv%')::int as stage_archived
  from apps_norm
),
progression as (
  select
    count(*) filter (
      where status_norm like '%interview%'
         or status_norm like '%assessment%'
         or status_norm like '%offer%'
    )::numeric as progressed_count,
    count(*) filter (
      where status_norm like '%interview%'
         or status_norm like '%assessment%'
         or status_norm like '%offer%'
         or status_norm like '%reject%'
    )::numeric as total_count
  from apps_norm
),
response_times as (
  select avg(date_part('day', fe.first_event_at - a.applied_effective)) as avg_days
  from apps_norm a
  join lateral (
    select min(e.start_at) as first_event_at
    from public.events e
    where e.user_id = a.user_id
      and e.application_id = a.id
  ) fe on true
  where a.applied_effective is not null
    and fe.first_event_at is not null
),
open_tasks as (
  select count(*)::int as count
  from public.tasks t
  cross join params p
  where t.user_id = auth.uid()
    and t.status = 'open'
    and (p.start_at is null or coalesce(t.due_at, t.created_at) >= p.start_at)
    and (p.end_at is null or coalesce(t.due_at, t.created_at) < p.end_at)
),
stalled as (
  select count(*)::int as count
  from apps_norm a
  where a.status_norm not like '%reject%'
    and a.status_norm not like '%archiv%'
    and a.updated_at < now() - interval '14 days'
    and not exists (
      select 1
      from public.events e
      where e.user_id = a.user_id
        and e.application_id = a.id
    )
)
select
  sc.total_applications,
  sc.stage_applied,
  sc.stage_assessment,
  sc.stage_interview,
  sc.stage_offer,
  sc.stage_rejected,
  sc.stage_archived,
  case
    when prog.total_count = 0 then null
    else prog.progressed_count / prog.total_count
  end as response_rate,
  rt.avg_days as avg_response_days,
  ot.count as open_tasks,
  st.count as stalled_count
from stage_counts sc
cross join progression prog
cross join response_times rt
cross join open_tasks ot
cross join stalled st;
$$;

