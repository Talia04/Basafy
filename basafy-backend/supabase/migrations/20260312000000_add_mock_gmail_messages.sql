-- Migration: add mock Gmail messages for reviewer demo mode

create table if not exists public.mock_gmail_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text,
  internet_message_id text,
  subject text,
  from_address text,
  snippet text,
  body_text text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint mock_gmail_messages_user_msg_unique unique (user_id, gmail_message_id)
);

create index if not exists mock_gmail_messages_user_received_idx
  on public.mock_gmail_messages (user_id, received_at desc);

alter table public.mock_gmail_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mock_gmail_messages'
      and policyname = 'Users can view own mock gmail messages'
  ) then
    create policy "Users can view own mock gmail messages"
      on public.mock_gmail_messages
      for select
      using (auth.uid() = user_id);
  end if;
end$$;
