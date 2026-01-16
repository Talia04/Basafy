-- Migration: Create notifications and user notification settings tables with RLS and defaults

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  subtype text,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  scheduled_for timestamptz,
  delivered_at timestamptz,
  channel text not null default 'in_app',
  priority text not null default 'normal'
);

create index if not exists idx_notifications_user_created_at
  on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_is_read
  on public.notifications(user_id, is_read);
create index if not exists idx_notifications_scheduled_for
  on public.notifications(scheduled_for);

alter table public.notifications enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can view own notifications'
  ) then
    create policy "Users can view own notifications"
      on public.notifications
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

create table if not exists public.user_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default false,
  updates_enabled boolean not null default true,
  reminders_enabled boolean not null default true,
  event_reminder_24h boolean not null default true,
  event_reminder_2h boolean not null default true,
  event_reminder_15m boolean not null default false,
  task_due_enabled boolean not null default true,
  task_overdue_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_notification_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_notification_settings_updated_at on public.user_notification_settings;
create trigger set_user_notification_settings_updated_at
before update on public.user_notification_settings
for each row
execute function public.set_user_notification_settings_updated_at();

alter table public.user_notification_settings enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_notification_settings' and policyname = 'Users can view own notification settings'
  ) then
    create policy "Users can view own notification settings"
      on public.user_notification_settings
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_notification_settings' and policyname = 'Users can insert own notification settings'
  ) then
    create policy "Users can insert own notification settings"
      on public.user_notification_settings
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_notification_settings' and policyname = 'Users can update own notification settings'
  ) then
    create policy "Users can update own notification settings"
      on public.user_notification_settings
      for update
      using (auth.uid() = user_id);
  end if;
end
$$;

create or replace function public.create_user_notification_settings()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_notification_settings (user_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists create_user_notification_settings on auth.users;
create trigger create_user_notification_settings
after insert on auth.users
for each row
execute function public.create_user_notification_settings();
