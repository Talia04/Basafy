alter table public.applications enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'Users can delete own applications'
  ) then
    create policy "Users can delete own applications"
    on public.applications
    for delete
    using (auth.uid() = user_id);
  end if;
end$$;
