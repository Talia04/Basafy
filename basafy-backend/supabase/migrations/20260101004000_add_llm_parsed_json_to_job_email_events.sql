-- Migration: add llm_parsed_json to job_email_events

alter table public.job_email_events
  add column if not exists llm_parsed_json jsonb;
