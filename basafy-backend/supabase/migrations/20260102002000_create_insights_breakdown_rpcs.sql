-- Migration: RPCs for Insights breakdown sections

create or replace function public.get_insights_source_effectiveness(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  source_type text,
  interviews int,
  offers int,
  avg_response_days numeric
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
first_events as (
  select
    a.id,
    a.source_type,
    min(e.start_at) as first_event_at
  from apps_in_range a
  left join public.events e
    on e.user_id = a.user_id
    and e.application_id = a.id
  group by a.id, a.source_type
)
select
  a.source_type,
  count(distinct case when e.event_type = 'interview' then a.id end)::int as interviews,
  count(distinct case when a.status = 'offer' then a.id end)::int as offers,
  avg(date_part('day', fe.first_event_at - a.applied_effective)) as avg_response_days
from apps_in_range a
left join public.events e
  on e.user_id = a.user_id
  and e.application_id = a.id
left join first_events fe
  on fe.id = a.id
group by a.source_type
order by a.source_type;
$$;

create or replace function public.get_insights_weekly_trend(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  week_start date,
  replies int
)
language sql
stable
as $$
with params as (
  select p_start_at as start_at, p_end_at as end_at
),
events_in_range as (
  select e.*
  from public.events e
  cross join params p
  where e.user_id = auth.uid()
    and (p.start_at is null or e.start_at >= p.start_at)
    and (p.end_at is null or e.start_at < p.end_at)
)
select
  date_trunc('week', start_at)::date as week_start,
  count(*)::int as replies
from events_in_range
group by date_trunc('week', start_at)::date
order by week_start;
$$;

create or replace function public.get_insights_stalled_apps(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_limit int default 5
)
returns table (
  application_id uuid,
  company text,
  role_title text,
  status text,
  applied_at timestamptz,
  days_stalled int
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
    and (a.status is null or a.status not in ('rejected', 'archived'))
),
apps_in_range as (
  select a.*
  from apps a
  cross join params p
  where (p.start_at is null or a.applied_effective >= p.start_at)
    and (p.end_at is null or a.applied_effective < p.end_at)
)
select
  a.id as application_id,
  a.company,
  a.role_title,
  a.status,
  a.applied_at,
  date_part('day', now() - a.updated_at)::int as days_stalled
from apps_in_range a
where a.updated_at < now() - interval '14 days'
  and not exists (
    select 1
    from public.events e
    where e.user_id = a.user_id
      and e.application_id = a.id
  )
order by a.updated_at asc
limit p_limit;
$$;
