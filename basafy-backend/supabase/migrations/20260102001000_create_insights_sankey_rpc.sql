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
  select p_start_at as start_at, p_end_at as end_at
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
  where (p.start_at is null or a.applied_effective >= p.start_at)
    and (p.end_at is null or a.applied_effective < p.end_at)
),
events_in_range as (
  select e.*
  from public.events e
  cross join params p
  where e.user_id = auth.uid()
    and (p.start_at is null or e.start_at >= p.start_at)
    and (p.end_at is null or e.start_at < p.end_at)
),
links as (
  select 'applied' as source, 'assessment' as target, count(*)::int as count
  from apps_in_range a
  where exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'assessment'
  )
  union all
  select 'applied', 'interview', count(*)::int
  from apps_in_range a
  where exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'interview'
  )
  and not exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'assessment'
  )
  union all
  select 'applied', 'rejected', count(*)::int
  from apps_in_range a
  where a.status = 'rejected'
    and not exists (
      select 1 from events_in_range e
      where e.application_id = a.id and e.event_type in ('assessment','interview')
    )
  union all
  select 'applied', 'archived', count(*)::int
  from apps_in_range a
  where a.status = 'archived'
    and not exists (
      select 1 from events_in_range e
      where e.application_id = a.id and e.event_type in ('assessment','interview')
    )
    and a.status <> 'rejected'
  union all
  select 'assessment', 'interview', count(*)::int
  from apps_in_range a
  where exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'assessment'
  )
  and exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'interview'
  )
  union all
  select 'assessment', 'rejected', count(*)::int
  from apps_in_range a
  where exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'assessment'
  )
  and a.status = 'rejected'
  and not exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'interview'
  )
  union all
  select 'assessment', 'archived', count(*)::int
  from apps_in_range a
  where exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'assessment'
  )
  and a.status = 'archived'
  and not exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'interview'
  )
  union all
  select 'interview', 'offer', count(*)::int
  from apps_in_range a
  where exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'interview'
  )
  and a.status = 'offer'
  union all
  select 'interview', 'rejected', count(*)::int
  from apps_in_range a
  where exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'interview'
  )
  and a.status = 'rejected'
  and a.status <> 'offer'
  union all
  select 'interview', 'archived', count(*)::int
  from apps_in_range a
  where exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'interview'
  )
  and a.status = 'archived'
  and a.status not in ('offer','rejected')
),
stage_counts as (
  select
    'applied' as stage,
    count(*)::int as count
  from apps_in_range
  union all
  select 'assessment' as stage,
    count(*)::int
  from apps_in_range a
  where exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'assessment'
  )
  union all
  select 'interview' as stage,
    count(*)::int
  from apps_in_range a
  where exists (
    select 1 from events_in_range e
    where e.application_id = a.id and e.event_type = 'interview'
  )
  union all
  select 'offer' as stage,
    count(*)::int
  from apps_in_range a
  where a.status = 'offer'
  union all
  select 'rejected' as stage,
    count(*)::int
  from apps_in_range a
  where a.status = 'rejected'
  union all
  select 'archived' as stage,
    count(*)::int
  from apps_in_range a
  where a.status = 'archived'
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
