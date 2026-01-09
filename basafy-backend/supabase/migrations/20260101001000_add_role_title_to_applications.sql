-- Migration: add role_title to applications and backfill from role

alter table public.applications
  add column if not exists role_title text;

update public.applications
set role_title = role
where role_title is null
  and role is not null;
