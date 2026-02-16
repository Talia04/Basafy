-- Add user-configurable Gmail priority domains to profiles

alter table public.profiles
  add column if not exists gmail_priority_domains text[]; 
