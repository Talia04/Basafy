-- Migration: add gmail sync state onboarding fields

create table if not exists public.gmail_sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid references public.gmail_connections (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmail_sync_state
  add column if not exists initial_import_status text not null default 'not_started',
  add column if not exists initial_import_progress integer,
  add column if not exists last_phase1_result_count integer not null default 0,
  add column if not exists last_deep_result_count integer not null default 0,
  add column if not exists last_sync_summary text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gmail_sync_state_initial_import_status_check'
  ) then
    alter table public.gmail_sync_state
      add constraint gmail_sync_state_initial_import_status_check
      check (
        initial_import_status in (
          'not_started',
          'phase1_running',
          'phase1_done',
          'deep_running',
          'deep_done',
          'failed'
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'gmail_sync_state'
      and indexname = 'gmail_sync_state_user_id_unique'
  ) then
    create unique index gmail_sync_state_user_id_unique on public.gmail_sync_state (user_id);
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'gmail_sync_state'
      and indexname = 'gmail_sync_state_connection_id_idx'
  ) then
    create index gmail_sync_state_connection_id_idx on public.gmail_sync_state (connection_id);
  end if;
end$$;

alter table public.gmail_sync_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gmail_sync_state' and policyname = 'Users can view own gmail sync state'
  ) then
    create policy "Users can view own gmail sync state"
    on public.gmail_sync_state
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gmail_sync_state' and policyname = 'Users can update own gmail sync state'
  ) then
    create policy "Users can update own gmail sync state"
    on public.gmail_sync_state
    for update
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gmail_sync_state' and policyname = 'Users can insert own gmail sync state'
  ) then
    create policy "Users can insert own gmail sync state"
    on public.gmail_sync_state
    for insert
    with check (auth.uid() = user_id);
  end if;
end$$;

drop trigger if exists set_gmail_sync_state_updated_at on public.gmail_sync_state;
create trigger set_gmail_sync_state_updated_at
before update on public.gmail_sync_state
for each row
execute function public.set_updated_at();
