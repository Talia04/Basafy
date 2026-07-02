create table if not exists public.wrapped_sync_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'complete', 'error')),
  lookback_months integer not null default 3 check (lookback_months between 1 and 24),
  target_messages integer not null default 250 check (target_messages between 1 and 500),
  current_bucket_index integer not null default 0,
  current_page_token text,
  seen_message_ids text[] not null default '{}',
  child_sync_run_ids uuid[] not null default '{}',
  messages_processed integer not null default 0,
  report_id uuid references public.wrapped_reports(id) on delete set null,
  error_message text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists wrapped_sync_sessions_user_updated_idx
  on public.wrapped_sync_sessions(user_id, updated_at desc);

alter table public.wrapped_sync_sessions enable row level security;

drop policy if exists "Users can view own Wrapped sync sessions" on public.wrapped_sync_sessions;
create policy "Users can view own Wrapped sync sessions"
  on public.wrapped_sync_sessions for select
  using (auth.uid() = user_id);
