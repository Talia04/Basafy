-- Migration: Fix get_insights_sankey to count based on events, not just status
-- This ensures accurate funnel data for Wrapped stats

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
    coalesce(p_start_at, now() - interval '90 days') as start_at,
    coalesce(p_end_at, now()) as end_at
),
apps as (
  select
    a.id,
    a.user_id,
    coalesce(a.applied_at, a.created_at) as applied_effective,
    lower(coalesce(a.status, 'applied')) as status
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
events_in_range as (
  select e.*
  from public.events e
  cross join params p
  where e.user_id = auth.uid()
    and e.start_at >= p.start_at
    and e.start_at < p.end_at
),
-- Check for events AND status to get accurate counts
app_stages as (
  select
    a.id,
    a.status,
    -- Has assessment event OR status indicates assessment
    case when exists (
      select 1 from events_in_range e
      where e.application_id = a.id and e.event_type = 'assessment'
    ) or a.status = 'assessment' then true else false end as has_assessment,
    -- Has interview event OR status indicates interview
    case when exists (
      select 1 from events_in_range e
      where e.application_id = a.id and e.event_type = 'interview'
    ) or a.status = 'interview' then true else false end as has_interview,
    -- Has offer status
    a.status = 'offer' as has_offer,
    -- Has rejection status
    a.status = 'rejected' as is_rejected,
    -- Has archived status
    a.status = 'archived' as is_archived
  from apps_in_range a
),
-- Count applications at each stage
stage_counts as (
  select 'applied' as stage, count(*)::int as count from apps_in_range
  union all
  select 'assessment', count(*)::int from app_stages where has_assessment
  union all
  select 'interview', count(*)::int from app_stages where has_interview
  union all
  select 'offer', count(*)::int from app_stages where has_offer
  union all
  select 'rejected', count(*)::int from app_stages where is_rejected
  union all
  select 'archived', count(*)::int from app_stages where is_archived
),
-- Build links for sankey diagram
links as (
  -- Applied -> Assessment (has assessment but no interview yet)
  select 'applied' as source, 'assessment' as target, count(*)::int as count
  from app_stages
  where has_assessment and not has_interview and not has_offer and not is_rejected
  union all
  -- Applied -> Interview (has interview directly, no assessment)
  select 'applied', 'interview', count(*)::int
  from app_stages
  where has_interview and not has_assessment and not has_offer
  union all
  -- Applied -> Rejected (rejected without any events)
  select 'applied', 'rejected', count(*)::int
  from app_stages
  where is_rejected and not has_assessment and not has_interview
  union all
  -- Applied -> Archived (archived without any events)
  select 'applied', 'archived', count(*)::int
  from app_stages
  where is_archived and not has_assessment and not has_interview and not is_rejected
  union all
  -- Assessment -> Interview (has both)
  select 'assessment', 'interview', count(*)::int
  from app_stages
  where has_assessment and has_interview
  union all
  -- Assessment -> Rejected (assessment but rejected before interview)
  select 'assessment', 'rejected', count(*)::int
  from app_stages
  where has_assessment and is_rejected and not has_interview
  union all
  -- Assessment -> Archived (assessment but archived before interview)
  select 'assessment', 'archived', count(*)::int
  from app_stages
  where has_assessment and is_archived and not has_interview and not is_rejected
  union all
  -- Interview -> Offer
  select 'interview', 'offer', count(*)::int
  from app_stages
  where has_interview and has_offer
  union all
  -- Interview -> Rejected
  select 'interview', 'rejected', count(*)::int
  from app_stages
  where has_interview and is_rejected and not has_offer
  union all
  -- Interview -> Archived
  select 'interview', 'archived', count(*)::int
  from app_stages
  where has_interview and is_archived and not has_offer and not is_rejected
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
   from links where count > 0)
);
$$;

-- Also fix the weekly trend to count all events (not just emails)
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
  select
    coalesce(p_start_at, now() - interval '90 days') as start_at,
    coalesce(p_end_at, now()) as end_at
),
events_in_range as (
  select e.*
  from public.events e
  cross join params p
  where e.user_id = auth.uid()
    and e.start_at >= p.start_at
    and e.start_at < p.end_at
)
select
  date_trunc('week', start_at)::date as week_start,
  count(*)::int as replies
from events_in_range
group by date_trunc('week', start_at)::date
order by week_start;
$$;

-- Drop the existing source effectiveness function to change return type
drop function if exists public.get_insights_source_effectiveness(timestamptz, timestamptz);

-- Fix source effectiveness to use portal_domain to identify ATS platforms
-- This gives much more useful breakdowns (Greenhouse, Lever, Workday, etc.)
-- Also adds total_count for proper frontend aggregation
create or replace function public.get_insights_source_effectiveness(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  source_type text,
  total_count int,
  interviews int,
  offers int,
  avg_response_days numeric
)
language sql
stable
as $$
with params as (
  select
    coalesce(p_start_at, now() - interval '90 days') as start_at,
    coalesce(p_end_at, now()) as end_at
),
apps as (
  select
    a.*,
    coalesce(a.applied_at, a.created_at) as applied_effective,
    -- Extract platform name from portal_domain
    case
      when a.portal_domain ilike '%greenhouse%' then 'Greenhouse'
      when a.portal_domain ilike '%lever%' then 'Lever'
      when a.portal_domain ilike '%workday%' or a.portal_domain ilike '%myworkday%' then 'Workday'
      when a.portal_domain ilike '%ashby%' then 'Ashby'
      when a.portal_domain ilike '%icims%' then 'iCIMS'
      when a.portal_domain ilike '%smartrecruiters%' then 'SmartRecruiters'
      when a.portal_domain ilike '%taleo%' then 'Taleo'
      when a.portal_domain ilike '%successfactors%' then 'SuccessFactors'
      when a.portal_domain ilike '%jobvite%' then 'Jobvite'
      when a.portal_domain ilike '%bamboohr%' then 'BambooHR'
      when a.portal_domain ilike '%recruitee%' then 'Recruitee'
      when a.portal_domain ilike '%breezy%' then 'Breezy'
      when a.portal_domain ilike '%wellfound%' or a.portal_domain ilike '%angel.co%' then 'Wellfound'
      when a.portal_domain ilike '%linkedin%' then 'LinkedIn'
      when a.portal_domain ilike '%indeed%' then 'Indeed'
      when a.portal_domain ilike '%dover%' then 'Dover'
      when a.portal_domain ilike '%gem.com%' then 'Gem'
      when a.portal_domain ilike '%rippling%' then 'Rippling'
      when a.portal_domain ilike '%fountain%' then 'Fountain'
      when a.portal_domain is not null and a.portal_domain != '' then 'Other ATS'
      else coalesce(initcap(a.source_type), 'Direct/Email')
    end as platform_name
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
-- Get interview counts from both events table and status
interview_apps as (
  select distinct a.id
  from apps_in_range a
  left join public.events e on e.application_id = a.id and e.user_id = a.user_id
  where e.event_type = 'interview'
     or lower(a.status) in ('interview', 'offer')
),
first_events as (
  select
    a.id,
    a.platform_name,
    min(e.start_at) as first_event_at
  from apps_in_range a
  left join public.events e
    on e.user_id = a.user_id
    and e.application_id = a.id
  group by a.id, a.platform_name
)
select
  a.platform_name as source_type,
  count(*)::int as total_count,
  count(distinct case when ia.id is not null then a.id end)::int as interviews,
  count(distinct case when lower(a.status) = 'offer' then a.id end)::int as offers,
  avg(
    case when fe.first_event_at is not null
    then extract(epoch from (fe.first_event_at - a.applied_effective)) / 86400.0
    else null end
  )::numeric(10,1) as avg_response_days
from apps_in_range a
left join interview_apps ia on ia.id = a.id
left join first_events fe on fe.id = a.id
group by a.platform_name
order by count(*) desc;
$$;
