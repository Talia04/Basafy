-- Add RFC 822 Message-ID to applications so the detail screen can deep-link
-- directly to the exact email via the rfc822msgid Gmail search operator.
-- The value is stored without surrounding angle brackets (< >).

alter table public.applications
  add column if not exists internet_message_id text;
