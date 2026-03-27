-- Migration: Add is_starred (favorites/bookmark) to applications
alter table "public"."applications"
  add column if not exists "is_starred" boolean not null default false;

create index if not exists idx_applications_user_starred
  on "public"."applications" (user_id, is_starred)
  where is_starred = true;
