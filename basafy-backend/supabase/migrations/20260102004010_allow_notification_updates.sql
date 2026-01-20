-- Migration: allow users to update their own notifications (mark as read)

alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can update own notifications'
  ) then
    create policy "Users can update own notifications"
      on public.notifications
      for update
      using (auth.uid() = user_id);
  end if;
end
$$;
