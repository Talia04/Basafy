-- Migration: ensure applications/tasks/events columns and policies exist

-- Applications columns
alter table public.applications
  add column if not exists role_title text,
  add column if not exists applied_at timestamptz,
  add column if not exists source_type text,
  add column if not exists location text,
  add column if not exists notes text;

-- Events table
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id),
  event_type text not null check (event_type in ('interview', 'assessment', 'deadline', 'follow_up')),
  title text not null,
  provider text,
  meeting_link text,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  source_type text not null check (source_type in ('gmail', 'manual')),
  created_at timestamptz not null default now()
);

-- Tasks table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id),
  title text not null,
  due_at timestamptz,
  status text not null check (status in ('open', 'done')),
  origin text not null check (origin in ('gmail', 'manual')),
  priority text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_events_start_at on public.events(start_at);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_tasks_status on public.tasks(status);

-- RLS: events
alter table public.events enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and policyname = 'Users can view own events'
  ) then
    create policy "Users can view own events"
      on public.events
      for select
      using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and policyname = 'Users can insert own events'
  ) then
    create policy "Users can insert own events"
      on public.events
      for insert
      with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and policyname = 'Users can update own events'
  ) then
    create policy "Users can update own events"
      on public.events
      for update
      using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and policyname = 'Users can delete own events'
  ) then
    create policy "Users can delete own events"
      on public.events
      for delete
      using (user_id = auth.uid());
  end if;
end
$$;

-- RLS: tasks
alter table public.tasks enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tasks' and policyname = 'Users can view own tasks'
  ) then
    create policy "Users can view own tasks"
      on public.tasks
      for select
      using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tasks' and policyname = 'Users can insert own tasks'
  ) then
    create policy "Users can insert own tasks"
      on public.tasks
      for insert
      with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tasks' and policyname = 'Users can update own tasks'
  ) then
    create policy "Users can update own tasks"
      on public.tasks
      for update
      using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tasks' and policyname = 'Users can delete own tasks'
  ) then
    create policy "Users can delete own tasks"
      on public.tasks
      for delete
      using (user_id = auth.uid());
  end if;
end
$$;
