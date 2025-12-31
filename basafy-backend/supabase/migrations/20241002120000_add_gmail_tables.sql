-- Gmail connections and sync logs with RLS

create extension if not exists "pgcrypto";

create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  provider text not null default 'google',
  refresh_token text not null,
  access_token text,
  token_scopes text[],
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gmail_connections_user_provider_unique unique (user_id, provider)
);

do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'gmail_connections' and indexname = 'gmail_connections_user_provider_unique') then
    alter table public.gmail_connections
      add constraint gmail_connections_user_provider_unique unique (user_id, provider);
  end if;
exception
  when duplicate_table then null;
  when duplicate_object then null;
end$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_gmail_connections_updated_at on public.gmail_connections;
create trigger set_gmail_connections_updated_at
before update on public.gmail_connections
for each row
execute function public.set_updated_at();

alter table public.gmail_connections enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gmail_connections' and policyname = 'Users can view own gmail connection'
  ) then
    create policy "Users can view own gmail connection"
    on public.gmail_connections
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gmail_connections' and policyname = 'Users can update own gmail connection'
  ) then
    create policy "Users can update own gmail connection"
    on public.gmail_connections
    for update
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gmail_connections' and policyname = 'Users can insert own gmail connection'
  ) then
    create policy "Users can insert own gmail connection"
    on public.gmail_connections
    for insert
    with check (auth.uid() = user_id);
  end if;
end$$;

create table if not exists public.gmail_sync_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'error')),
  error_message text,
  messages_processed integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.gmail_sync_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gmail_sync_logs' and policyname = 'Users can view own gmail sync logs'
  ) then
    create policy "Users can view own gmail sync logs"
    on public.gmail_sync_logs
    for select
    using (auth.uid() = user_id);
  end if;
end$$;
