-- Migration: track Gmail backfill state per connection

alter table public.gmail_connections
  add column if not exists backfill_page_token text,
  add column if not exists backfill_started_at timestamptz,
  add column if not exists backfill_completed_at timestamptz;
