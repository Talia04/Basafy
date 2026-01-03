-- Migration: RPC for Insights Sankey dataset with time range input

create or replace function public.get_insights_sankey(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns jsonb
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
    a.id,
    a.user_id,
    coalesce(a.applied_at, a.created_at) as applied_effective,
    lower(a.status) as status
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
normalized as (
  select
    id,
    case
      when status in ('assessment','interview','offer','rejected','archived') then status
      else 'applied'
    end as stage
  from apps_in_range
),
links as (
  select 'applied' as source, 'assessment' as target, count(*)::int as count
  from normalized
  where stage = 'assessment'
  union all
  select 'applied', 'interview', count(*)::int
  from normalized
  where stage = 'interview'
  union all
  select 'applied', 'offer', count(*)::int
  from normalized
  where stage = 'offer'
  union all
  select 'applied', 'rejected', count(*)::int
  from normalized
  where stage = 'rejected'
  union all
  select 'applied', 'archived', count(*)::int
  from normalized
  where stage = 'archived'
),
stage_counts as (
  select stage, count(*)::int as count
  from normalized
  group by stage
),
nodes as (
  select * from (values
    ('applied', (select coalesce((select count from stage_counts where stage = 'applied'), 0))),
    ('assessment', (select coalesce((select count from stage_counts where stage = 'assessment'), 0))),
    ('interview', (select coalesce((select count from stage_counts where stage = 'interview'), 0))),
    ('offer', (select coalesce((select count from stage_counts where stage = 'offer'), 0))),
    ('rejected', (select coalesce((select count from stage_counts where stage = 'rejected'), 0))),
    ('archived', (select coalesce((select count from stage_counts where stage = 'archived'), 0)))
  ) as n(stage, count)
)
select jsonb_build_object(
  'nodes',
  (select jsonb_agg(jsonb_build_object('id', stage, 'count', count) order by stage) from nodes),
  'links',
  (select jsonb_agg(jsonb_build_object('source', source, 'target', target, 'count', count) order by source, target)
   from links)
);
$$;
