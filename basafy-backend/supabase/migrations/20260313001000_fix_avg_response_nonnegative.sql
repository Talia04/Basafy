-- Ensure avg_response_days never goes negative in insights summary + home metrics

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
    count(*) filter (
      where status in ('interview', 'assessment', 'offer')
    )::numeric as progressed_count,
    count(*) filter (
      where status in ('interview', 'assessment', 'offer', 'rejected')
    )::numeric as total_count
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
    and fe.first_event_at >= a.applied_effective
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
  from apps_in_range a
  where (a.status is null or a.status not in ('rejected', 'archived'))
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

create or replace view public.v_home_metrics as
with apps as (
  select
    *,
    coalesce(applied_at, created_at) as applied_effective
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
  select avg(date_part('day', fe.first_event_at - a.applied_effective)) as avg_days
  from apps a
  join lateral (
    select min(e.start_at) as first_event_at
    from public.events e
    where e.user_id = a.user_id
      and e.application_id = a.id
  ) fe on true
  where a.applied_effective is not null
    and fe.first_event_at is not null
    and fe.first_event_at >= a.applied_effective
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
