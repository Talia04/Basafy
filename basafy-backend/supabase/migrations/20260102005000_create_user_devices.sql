-- Migration: create user_devices table for push tokens

create extension if not exists "pgcrypto";

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  platform text,
  expo_push_token text,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_user_devices_user_device
  on public.user_devices(user_id, device_id);
create unique index if not exists idx_user_devices_expo_token
  on public.user_devices(expo_push_token);

create or replace function public.set_user_devices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_devices_updated_at on public.user_devices;
create trigger set_user_devices_updated_at
before update on public.user_devices
for each row
execute function public.set_user_devices_updated_at();

alter table public.user_devices enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_devices' and policyname = 'Users can view own devices'
  ) then
    create policy "Users can view own devices"
      on public.user_devices
      for select
      using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_devices' and policyname = 'Users can insert own devices'
  ) then
    create policy "Users can insert own devices"
      on public.user_devices
      for insert
      with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_devices' and policyname = 'Users can update own devices'
  ) then
    create policy "Users can update own devices"
      on public.user_devices
      for update
      using (auth.uid() = user_id);
  end if;
end
$$;
