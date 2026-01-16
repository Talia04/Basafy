-- Migration: add Gmail backfill progress metrics

alter table public.gmail_connections
  add column if not exists backfill_total_estimate integer,
  add column if not exists backfill_processed_count integer;
