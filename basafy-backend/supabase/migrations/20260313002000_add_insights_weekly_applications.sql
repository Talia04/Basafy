-- Add weekly applications trend for Insights momentum chart

create or replace function public.get_insights_weekly_applications(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  week_start date,
  applications int
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
  where a.applied_effective is not null
    and (p.start_at is null or a.applied_effective >= p.start_at)
    and (p.end_at is null or a.applied_effective < p.end_at)
)
select
  date_trunc('week', applied_effective)::date as week_start,
  count(*)::int as applications
from apps_in_range
group by date_trunc('week', applied_effective)::date
order by week_start;
$$;
