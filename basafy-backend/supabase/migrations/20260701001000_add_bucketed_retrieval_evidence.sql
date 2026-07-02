alter table public.gmail_retrieval_evidence
  add column if not exists matched_query_buckets text[] not null default '{}',
  add column if not exists platform_email_type text not null default 'unknown';

alter table public.gmail_retrieval_evidence
  drop constraint if exists gmail_retrieval_evidence_platform_email_type_check;

alter table public.gmail_retrieval_evidence
  add constraint gmail_retrieval_evidence_platform_email_type_check
  check (platform_email_type in (
    'job_alert_noise',
    'application_activity',
    'recruiter_message',
    'interview_or_assessment',
    'unknown'
  ));

drop view if exists public.gmail_sync_debug_view;

create view public.gmail_sync_debug_view
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
  r.matched_query_buckets,
  r.platform_email_type,
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
