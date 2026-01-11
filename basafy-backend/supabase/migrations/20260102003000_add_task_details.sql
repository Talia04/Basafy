-- Migration: add task details fields for richer task generation

alter table public.tasks
  add column if not exists description text,
  add column if not exists source_message_id text,
  add column if not exists completed_at timestamptz;

create index if not exists idx_tasks_source_message_id on public.tasks(source_message_id);
