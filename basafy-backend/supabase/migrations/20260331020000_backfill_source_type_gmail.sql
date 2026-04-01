-- Backfill source_type = 'gmail' for any applications that have a gmail_thread_id
-- or gmail_message_id but were written with source_type = 'manual' or null.
update public.applications
set source_type = 'gmail'
where (gmail_thread_id is not null or gmail_message_id is not null)
  and (source_type is null or source_type <> 'gmail');
