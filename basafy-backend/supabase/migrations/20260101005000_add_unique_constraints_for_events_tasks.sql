-- Migration: add unique constraints for events and tasks upserts

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_user_app_type_start_unique'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_user_app_type_start_unique
      unique (user_id, application_id, event_type, start_at);
  end if;
exception
  when undefined_table then null;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_user_app_title_due_unique'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_user_app_title_due_unique
      unique (user_id, application_id, title, due_at);
  end if;
exception
  when undefined_table then null;
end$$;
