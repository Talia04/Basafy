-- Migration: Add is_hidden to applications

alter table public.applications
  add column if not exists is_hidden boolean default false;
