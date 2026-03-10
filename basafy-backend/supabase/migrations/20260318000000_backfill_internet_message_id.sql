-- Backfill applications.internet_message_id from job_email_events.
-- Takes the most recent event per application that has a non-null value,
-- and strips any remaining angle brackets from older un-normalised rows.

update public.applications a
set internet_message_id = trim(both '<>' from e.internet_message_id)
from (
  select distinct on (application_id)
    application_id,
    internet_message_id
  from public.job_email_events
  where application_id is not null
    and internet_message_id is not null
    and internet_message_id <> ''
  order by application_id, received_at desc nulls last
) e
where a.id = e.application_id
  and a.internet_message_id is null;
