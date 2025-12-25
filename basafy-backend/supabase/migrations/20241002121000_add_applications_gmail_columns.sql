-- Add Gmail-related metadata to applications

-- Ensure the applications table exists (in case earlier migrations were skipped)
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

-- Add Gmail columns
alter table public.applications
  add column if not exists source_type text not null default 'manual',
  add column if not exists gmail_message_id text,
  add column if not exists gmail_thread_id text,
  add column if not exists email_snippet text;

-- Optional: RLS and trigger guards (idempotent)
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

-- Optional: prevent duplicate message imports per user by adding a partial unique index
-- (uncomment and adjust if you want this constraint at the DB level)
-- create unique index concurrently if not exists applications_user_message_unique
--   on public.applications (user_id, gmail_message_id)
--   where gmail_message_id is not null;
