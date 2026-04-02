alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Users can delete own notifications'
  ) then
    create policy "Users can delete own notifications"
    on public.notifications
    for delete
    using (auth.uid() = user_id);
  end if;
end$$;
