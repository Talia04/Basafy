-- Add Gmail-related metadata to applications

alter table public.applications
  add column if not exists source_type text not null default 'manual',
  add column if not exists gmail_message_id text,
  add column if not exists gmail_thread_id text,
  add column if not exists email_snippet text;

-- Optional: prevent duplicate message imports per user by adding a partial unique index
-- (uncomment and adjust if you want this constraint at the DB level)
-- create unique index concurrently if not exists applications_user_message_unique
--   on public.applications (user_id, gmail_message_id)
--   where gmail_message_id is not null;
