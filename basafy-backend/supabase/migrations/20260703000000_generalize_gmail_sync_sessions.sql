alter table public.wrapped_sync_sessions rename to gmail_sync_sessions;

alter index if exists public.wrapped_sync_sessions_user_updated_idx
  rename to gmail_sync_sessions_user_updated_idx;

alter table public.gmail_sync_sessions
  add column if not exists context text not null default 'wrapped',
  add column if not exists sync_mode text not null default 'wrapped_deep_sync',
  add column if not exists lookback_start timestamptz,
  add column if not exists lookback_end timestamptz not null default now(),
  add column if not exists last_successful_checkpoint timestamptz,
  add column if not exists retry_count integer not null default 0,
  add column if not exists failure_reason text,
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz;

alter table public.gmail_sync_sessions
  drop constraint if exists wrapped_sync_sessions_status_check;

alter table public.gmail_sync_sessions
  add constraint gmail_sync_sessions_status_check
  check (status in ('running', 'paused', 'complete', 'failed', 'abandoned'));

alter table public.gmail_sync_sessions
  add constraint gmail_sync_sessions_context_check
  check (context in (
    'wrapped',
    'mobile_onboarding',
    'mobile_incremental',
    'mobile_manual_refresh',
    'mobile_recovery'
  ));

update public.gmail_sync_sessions
set
  context = 'wrapped',
  sync_mode = 'wrapped_deep_sync',
  lookback_start = coalesce(
    lookback_start,
    lookback_end - make_interval(months => lookback_months)
  ),
  failure_reason = coalesce(failure_reason, error_message)
where context = 'wrapped';

with ranked_active as (
  select id, row_number() over (
    partition by user_id, context
    order by updated_at desc, started_at desc
  ) as active_rank
  from public.gmail_sync_sessions
  where status in ('running', 'paused')
)
update public.gmail_sync_sessions sessions
set
  status = 'abandoned',
  failure_reason = coalesce(failure_reason, 'Superseded while enabling durable sync sessions'),
  completed_at = coalesce(completed_at, now()),
  updated_at = now()
from ranked_active
where sessions.id = ranked_active.id
  and ranked_active.active_rank > 1;

create unique index if not exists gmail_sync_sessions_one_active_context_idx
  on public.gmail_sync_sessions(user_id, context)
  where status in ('running', 'paused');

create index if not exists gmail_sync_sessions_context_updated_idx
  on public.gmail_sync_sessions(context, updated_at desc);

drop policy if exists "Users can view own Wrapped sync sessions"
  on public.gmail_sync_sessions;
drop policy if exists "Users can view own Gmail sync sessions"
  on public.gmail_sync_sessions;
create policy "Users can view own Gmail sync sessions"
  on public.gmail_sync_sessions for select
  using (auth.uid() = user_id);

comment on table public.gmail_sync_sessions is
  'Durable parent sessions for resumable Wrapped and mobile Gmail synchronization.';

create or replace function public.claim_gmail_sync_session(
  p_session_id uuid,
  p_user_id uuid,
  p_lease_seconds integer default 120
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_token uuid := gen_random_uuid();
begin
  update public.gmail_sync_sessions
  set
    lease_token = claimed_token,
    lease_expires_at = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 300))),
    status = 'running',
    updated_at = now()
  where id = p_session_id
    and user_id = p_user_id
    and status in ('running', 'paused', 'failed')
    and (lease_expires_at is null or lease_expires_at < now());

  if not found then
    return null;
  end if;
  return claimed_token;
end;
$$;

revoke all on function public.claim_gmail_sync_session(uuid, uuid, integer) from public;
grant execute on function public.claim_gmail_sync_session(uuid, uuid, integer) to service_role;

create or replace view public.wrapped_sync_sessions
with (security_invoker = true)
as
select *
from public.gmail_sync_sessions
where context = 'wrapped';

grant select on public.wrapped_sync_sessions to authenticated;
