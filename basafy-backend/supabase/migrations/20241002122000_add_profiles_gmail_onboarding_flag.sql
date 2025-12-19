-- Track whether a user has seen Gmail onboarding in the profiles table

alter table public.profiles
  add column if not exists has_seen_gmail_onboarding boolean not null default false;
