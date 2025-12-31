-- Migration: add last_synced_at to applications

alter table public.applications
  add column if not exists last_synced_at timestamptz;
