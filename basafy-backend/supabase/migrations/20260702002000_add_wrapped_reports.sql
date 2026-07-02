create table if not exists public.wrapped_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sync_run_id uuid not null references public.gmail_sync_runs(id) on delete cascade,
  report_version text not null,
  total_applications integer not null default 0,
  total_companies integer not null default 0,
  interviews_count integer not null default 0,
  assessments_count integer not null default 0,
  rejections_count integer not null default 0,
  offers_count integer not null default 0,
  followups_needed_count integer not null default 0,
  top_companies jsonb not null default '[]'::jsonb,
  top_roles jsonb not null default '[]'::jsonb,
  timeline_highlights jsonb not null default '{}'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  confidence_summary jsonb not null default '{}'::jsonb,
  report_payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique (sync_run_id, report_version)
);

create index if not exists wrapped_reports_user_generated_idx
  on public.wrapped_reports(user_id, generated_at desc);

alter table public.wrapped_reports enable row level security;

drop policy if exists "Users can view own Wrapped reports" on public.wrapped_reports;
create policy "Users can view own Wrapped reports"
  on public.wrapped_reports for select
  using (auth.uid() = user_id);

comment on table public.wrapped_reports is
  'Immutable, versioned Wrapped report snapshots grounded in a completed Gmail sync run.';
