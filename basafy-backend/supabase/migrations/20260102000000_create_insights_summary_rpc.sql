-- Migration: RPC for Insights summary metrics with time range input

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
  select
    coalesce(p_start_at, now() - interval '30 days') as start_at,
    coalesce(p_end_at, now()) as end_at
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
  where a.applied_effective >= p.start_at
    and a.applied_effective < p.end_at
),
stage_counts as (
  select
    count(*)::int as total_applications,
    count(*) filter (where status = 'applied')::int as stage_applied,
    count(*) filter (where status = 'assessment')::int as stage_assessment,
    count(*) filter (where status = 'interview')::int as stage_interview,
    count(*) filter (where status = 'offer')::int as stage_offer,
    count(*) filter (where status = 'rejected')::int as stage_rejected,
    count(*) filter (where status = 'archived')::int as stage_archived
  from apps_in_range
),
progression as (
  select
    count(*) filter (where status is not null and status not in ('applied', 'archived'))::numeric as progressed_count,
    count(*)::numeric as total_count
  from apps_in_range
),
response_times as (
  select avg(date_part('day', fe.first_event_at - a.applied_effective)) as avg_days
  from apps_in_range a
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
    and coalesce(t.due_at, t.created_at) >= p.start_at
    and coalesce(t.due_at, t.created_at) < p.end_at
),
stalled as (
  select count(*)::int as count
  from apps_in_range a
  where a.status is null or a.status not in ('rejected', 'archived')
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
    when prog.total_count = 0 then 0
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
