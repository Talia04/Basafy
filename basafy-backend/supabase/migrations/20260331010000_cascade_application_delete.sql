-- Fix application delete: replace NO ACTION FK constraints with CASCADE / SET NULL
-- so that deleting an application automatically cleans up related rows.
--
--  tasks, events       → CASCADE  (child rows have no meaning without the application)
--  job_email_events    → SET NULL (keep the event history; just unlink it from the deleted app
--                                  so the next sync doesn't think the email was already handled)

alter table public.tasks
  drop constraint tasks_application_id_fkey,
  add constraint tasks_application_id_fkey
    foreign key (application_id) references public.applications(id)
    on delete cascade;

alter table public.events
  drop constraint events_application_id_fkey,
  add constraint events_application_id_fkey
    foreign key (application_id) references public.applications(id)
    on delete cascade;

alter table public.job_email_events
  drop constraint job_email_events_application_id_fkey,
  add constraint job_email_events_application_id_fkey
    foreign key (application_id) references public.applications(id)
    on delete set null;
