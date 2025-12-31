-- Ensure applications table exists before adding Gmail metadata

create extension if not exists "pgcrypto";

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company text,
  role text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_applications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_applications_updated_at on public.applications;
create trigger set_applications_updated_at
before update on public.applications
for each row
execute function public.set_applications_updated_at();

alter table public.applications enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applications' and policyname = 'Users can view own applications') then
    create policy "Users can view own applications"
    on public.applications
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applications' and policyname = 'Users can insert own applications') then
    create policy "Users can insert own applications"
    on public.applications
    for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applications' and policyname = 'Users can update own applications') then
    create policy "Users can update own applications"
    on public.applications
    for update
    using (auth.uid() = user_id);
  end if;
end$$;
