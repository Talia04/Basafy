alter table public.job_email_events
  drop constraint if exists job_email_events_match_state_check;

update public.job_email_events
set match_state = 'match_existing'
where match_state = 'matched' and application_id is not null;

alter table public.job_email_events
  add constraint job_email_events_match_state_check
  check (match_state in ('matched', 'match_existing', 'create_new', 'unmatched_job_event', 'needs_review', 'possible_duplicate'));

create table if not exists public.application_timeline_summaries (
  application_id uuid primary key references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_status text not null,
  status_confidence numeric(4, 3) not null default 0,
  last_meaningful_event_id bigint references public.job_email_events(id) on delete set null,
  next_action text,
  next_deadline timestamptz,
  timeline_summary jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists application_timeline_summaries_user_id_idx
  on public.application_timeline_summaries(user_id);

alter table public.application_timeline_summaries enable row level security;

drop policy if exists "Users can view their application timeline summaries"
  on public.application_timeline_summaries;

create policy "Users can view their application timeline summaries"
  on public.application_timeline_summaries
  for select
  using (auth.uid() = user_id);
