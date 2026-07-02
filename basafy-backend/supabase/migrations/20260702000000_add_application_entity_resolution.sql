create table if not exists public.company_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  canonical_name text not null,
  normalized_key text not null,
  aliases text[] not null default '{}',
  domains text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_key)
);

alter table public.company_entities enable row level security;

create policy "Users can view own company entities"
  on public.company_entities for select using (auth.uid() = user_id);

alter table public.applications
  add column if not exists normalized_company text,
  add column if not exists normalized_role text,
  add column if not exists role_family text,
  add column if not exists role_level text;

alter table public.job_email_events
  add column if not exists normalized_company text,
  add column if not exists normalized_role text,
  add column if not exists match_state text not null default 'matched';

alter table public.job_email_events
  drop constraint if exists job_email_events_match_state_check;

alter table public.job_email_events
  add constraint job_email_events_match_state_check
  check (match_state in ('matched', 'create_new', 'unmatched_job_event', 'needs_review', 'possible_duplicate'));

create index if not exists applications_user_normalized_company_idx
  on public.applications(user_id, normalized_company);

create index if not exists applications_user_role_family_idx
  on public.applications(user_id, role_family);

comment on table public.company_entities is
  'Per-user canonical company names with observed aliases and sender domains.';
