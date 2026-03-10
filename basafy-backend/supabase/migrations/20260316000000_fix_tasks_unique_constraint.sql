-- Replace tasks unique constraint: drop due_at from the key so that
-- updating due_at on an existing task (e.g. null → computed date) upserts
-- rather than inserting a duplicate row.

do $$
begin
  -- Drop old constraint that included due_at
  if exists (
    select 1 from pg_constraint
    where conname = 'tasks_user_app_title_due_unique'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks drop constraint tasks_user_app_title_due_unique;
  end if;
exception
  when undefined_table then null;
end$$;

-- Deduplicate: for each (user_id, application_id, title) group keep the row
-- with the best due_at (non-null preferred, otherwise latest created_at),
-- then delete the rest.
delete from public.tasks
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id, application_id, title
        order by
          (due_at is not null) desc,  -- prefer rows that have a due date
          due_at asc,                  -- earliest due date wins
          created_at asc               -- oldest row wins as tiebreaker
      ) as rn
    from public.tasks
  ) ranked
  where rn > 1
);

-- Now safe to add the narrower unique constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_user_app_title_unique'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_user_app_title_unique
      unique (user_id, application_id, title);
  end if;
exception
  when undefined_table then null;
end$$;
