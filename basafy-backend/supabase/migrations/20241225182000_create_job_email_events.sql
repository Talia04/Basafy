-- Migration: Create job_email_events table

CREATE TABLE IF NOT EXISTS public.job_email_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  raw_subject TEXT,
  raw_from TEXT,
  raw_snippet TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  event_type TEXT DEFAULT 'unknown' NOT NULL,
  parsed_company TEXT,
  parsed_role TEXT,
  parsed_status TEXT,
  confidence FLOAT,
  application_id UUID REFERENCES public.applications(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Unique constraint to prevent duplicates (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_email_events_unique_user_msg'
      and conrelid = 'public.job_email_events'::regclass
  ) then
    alter table public.job_email_events
      add constraint job_email_events_unique_user_msg unique (user_id, gmail_message_id);
  end if;
end$$;

-- Enable Row Level Security
alter table public.job_email_events enable row level security;

-- Policy: Users can only see their own rows (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_email_events'
      and policyname = 'Users can view their own job_email_events'
  ) then
    create policy "Users can view their own job_email_events"
      on public.job_email_events
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_email_events'
      and policyname = 'Users can insert their own job_email_events'
  ) then
    create policy "Users can insert their own job_email_events"
      on public.job_email_events
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_email_events'
      and policyname = 'Users can update their own job_email_events'
  ) then
    create policy "Users can update their own job_email_events"
      on public.job_email_events
      for update
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_email_events'
      and policyname = 'Users can delete their own job_email_events'
  ) then
    create policy "Users can delete their own job_email_events"
      on public.job_email_events
      for delete
      using (auth.uid() = user_id);
  end if;
end$$;
