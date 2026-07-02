-- Explainable Gmail processing: run, retrieval, parsing, and matching evidence.
create table if not exists public.gmail_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_sync_log_id bigint references public.gmail_sync_logs(id) on delete set null,
  sync_type text not null,
  light_sync boolean not null default false,
  use_llm boolean not null default false,
  fetch_full boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'success', 'error')),
  messages_requested integer not null default 0,
  messages_fetched integer not null default 0,
  messages_processed integer not null default 0,
  messages_kept integer not null default 0,
  messages_discarded integer not null default 0,
  applications_created integer not null default 0,
  applications_updated integer not null default 0,
  events_created integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.gmail_retrieval_evidence (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sync_run_id uuid not null references public.gmail_sync_runs(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text,
  query_bucket text not null,
  query_string text not null,
  sender text,
  sender_domain text,
  subject text,
  snippet text,
  gmail_date timestamptz,
  has_full_body boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sync_run_id, gmail_message_id, query_bucket)
);

create table if not exists public.email_parse_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sync_run_id uuid not null references public.gmail_sync_runs(id) on delete cascade,
  gmail_message_id text not null,
  parser_version text not null,
  classification_source text not null,
  heuristic_result jsonb,
  llm_result jsonb,
  final_decision text not null,
  event_type text,
  company_name text,
  role_title text,
  confidence double precision,
  evidence_snippets jsonb not null default '[]'::jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  unique (sync_run_id, gmail_message_id)
);

create table if not exists public.gmail_match_decisions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sync_run_id uuid not null references public.gmail_sync_runs(id) on delete cascade,
  gmail_message_id text not null,
  matched_application_id uuid references public.applications(id) on delete set null,
  match_type text not null,
  match_score double precision,
  company_score double precision,
  role_score double precision,
  thread_score double precision,
  domain_score double precision,
  timeline_score double precision,
  decision text not null,
  reason text not null,
  candidate_application_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (sync_run_id, gmail_message_id)
);

create index if not exists gmail_sync_runs_user_started_idx on public.gmail_sync_runs(user_id, started_at desc);
create index if not exists gmail_retrieval_sync_idx on public.gmail_retrieval_evidence(sync_run_id);
create index if not exists email_parse_attempts_sync_idx on public.email_parse_attempts(sync_run_id);
create index if not exists gmail_match_decisions_sync_idx on public.gmail_match_decisions(sync_run_id);

alter table public.gmail_sync_runs enable row level security;
alter table public.gmail_retrieval_evidence enable row level security;
alter table public.email_parse_attempts enable row level security;
alter table public.gmail_match_decisions enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'gmail_sync_runs', 'gmail_retrieval_evidence', 'email_parse_attempts', 'gmail_match_decisions'
  ] loop
    execute format('drop policy if exists "Users can view own %s" on public.%I', table_name, table_name);
    execute format(
      'create policy "Users can view own %s" on public.%I for select using (auth.uid() = user_id)',
      table_name,
      table_name
    );
  end loop;
end $$;

create or replace view public.gmail_sync_debug_view
with (security_invoker = true)
as
select
  r.user_id,
  r.sync_run_id,
  r.gmail_message_id,
  r.gmail_date,
  r.sender,
  r.subject,
  r.query_bucket,
  p.heuristic_result,
  p.llm_result,
  p.final_decision,
  p.event_type,
  p.company_name,
  p.role_title,
  m.matched_application_id,
  p.confidence,
  m.reason as match_reason,
  p.evidence_snippets
from public.gmail_retrieval_evidence r
left join public.email_parse_attempts p
  on p.sync_run_id = r.sync_run_id and p.gmail_message_id = r.gmail_message_id
left join public.gmail_match_decisions m
  on m.sync_run_id = r.sync_run_id and m.gmail_message_id = r.gmail_message_id;

grant select on public.gmail_sync_debug_view to authenticated;

comment on view public.gmail_sync_debug_view is
  'User-scoped developer audit trail for Gmail retrieval, parsing, and application matching.';
