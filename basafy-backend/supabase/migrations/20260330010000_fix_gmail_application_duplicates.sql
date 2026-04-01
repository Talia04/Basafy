-- Merge duplicate Gmail-linked applications by exact message/thread identities,
-- then add DB-level uniqueness so future syncs cannot recreate them.

create or replace function public._merge_duplicate_application_pair(
  primary_id uuid,
  secondary_id uuid
)
returns void
language plpgsql
as $$
declare
  primary_app    public.applications%rowtype;
  secondary_app  public.applications%rowtype;
  priority       jsonb := '{"applied":1,"assessment":2,"interview":3,"rejected":4,"offer":5,"archived":0}'::jsonb;
  primary_prio   int;
  secondary_prio int;
  winning_status text;
begin
  if primary_id is null or secondary_id is null or primary_id = secondary_id then
    return;
  end if;

  select * into primary_app
  from public.applications
  where id = primary_id;

  select * into secondary_app
  from public.applications
  where id = secondary_id;

  if primary_app.id is null or secondary_app.id is null then
    return;
  end if;

  primary_prio := coalesce((priority ->> lower(coalesce(primary_app.status, 'applied')))::int, 1);
  secondary_prio := coalesce((priority ->> lower(coalesce(secondary_app.status, 'applied')))::int, 1);
  winning_status := case
    when secondary_prio > primary_prio then secondary_app.status
    else primary_app.status
  end;

  delete from public.tasks t
  using public.tasks existing
  where t.application_id = secondary_id
    and existing.application_id = primary_id
    and existing.user_id = t.user_id
    and existing.title = t.title;

  delete from public.events e
  using public.events existing
  where e.application_id = secondary_id
    and existing.application_id = primary_id
    and existing.user_id = e.user_id
    and existing.event_type = e.event_type
    and existing.start_at = e.start_at;

  update public.job_email_events
  set application_id = primary_id
  where application_id = secondary_id;

  update public.tasks
  set application_id = primary_id
  where application_id = secondary_id;

  update public.events
  set application_id = primary_id
  where application_id = secondary_id;

  update public.notifications
  set entity_id = primary_id
  where entity_id = secondary_id
    and entity_type = 'application';

  update public.applications
  set
    status = winning_status,
    company = coalesce(nullif(trim(primary_app.company), ''), secondary_app.company),
    role = coalesce(nullif(trim(primary_app.role), ''), secondary_app.role),
    role_title = coalesce(nullif(trim(primary_app.role_title), ''), secondary_app.role_title, secondary_app.role),
    source_type = coalesce(nullif(trim(primary_app.source_type), ''), secondary_app.source_type),
    gmail_message_id = coalesce(primary_app.gmail_message_id, secondary_app.gmail_message_id),
    gmail_thread_id = coalesce(primary_app.gmail_thread_id, secondary_app.gmail_thread_id),
    internet_message_id = coalesce(primary_app.internet_message_id, secondary_app.internet_message_id),
    email_snippet = coalesce(nullif(trim(primary_app.email_snippet), ''), secondary_app.email_snippet),
    canonical_key = coalesce(primary_app.canonical_key, secondary_app.canonical_key),
    portal_domain = coalesce(primary_app.portal_domain, secondary_app.portal_domain),
    requisition_id = coalesce(primary_app.requisition_id, secondary_app.requisition_id),
    job_id = coalesce(primary_app.job_id, secondary_app.job_id),
    external_application_id = coalesce(primary_app.external_application_id, secondary_app.external_application_id),
    applied_at = case
      when primary_app.applied_at is null then secondary_app.applied_at
      when secondary_app.applied_at is null then primary_app.applied_at
      else least(primary_app.applied_at, secondary_app.applied_at)
    end,
    created_at = least(primary_app.created_at, secondary_app.created_at),
    last_synced_at = greatest(primary_app.last_synced_at, secondary_app.last_synced_at),
    updated_at = greatest(primary_app.updated_at, secondary_app.updated_at, now()),
    location = coalesce(nullif(trim(primary_app.location), ''), secondary_app.location),
    notes = case
      when primary_app.notes is not null and secondary_app.notes is not null and primary_app.notes <> secondary_app.notes
        then primary_app.notes || E'\n---\n' || secondary_app.notes
      else coalesce(primary_app.notes, secondary_app.notes)
    end,
    is_hidden = coalesce(primary_app.is_hidden, false) and coalesce(secondary_app.is_hidden, false),
    is_starred = coalesce(primary_app.is_starred, false) or coalesce(secondary_app.is_starred, false)
  where id = primary_id;

  delete from public.applications
  where id = secondary_id;
end;
$$;

do $$
declare
  grp record;
  primary_id uuid;
  secondary_id uuid;
begin
  update public.applications
  set
    gmail_message_id = nullif(trim(gmail_message_id), ''),
    internet_message_id = nullif(trim(internet_message_id), ''),
    gmail_thread_id = nullif(trim(gmail_thread_id), '');

  for grp in
    select user_id, gmail_message_id
    from public.applications
    where gmail_message_id is not null
    group by user_id, gmail_message_id
    having count(*) > 1
  loop
    select id into primary_id
    from public.applications
    where user_id = grp.user_id
      and gmail_message_id = grp.gmail_message_id
    order by
      coalesce((case lower(coalesce(status, 'applied'))
        when 'offer' then 5
        when 'rejected' then 4
        when 'interview' then 3
        when 'assessment' then 2
        when 'applied' then 1
        else 0
      end), 0) desc,
      coalesce(applied_at, created_at) asc,
      created_at asc,
      id asc
    limit 1;

    for secondary_id in
      select id
      from public.applications
      where user_id = grp.user_id
        and gmail_message_id = grp.gmail_message_id
        and id <> primary_id
      order by coalesce(applied_at, created_at) asc, created_at asc, id asc
    loop
      perform public._merge_duplicate_application_pair(primary_id, secondary_id);
    end loop;
  end loop;

  for grp in
    select user_id, internet_message_id
    from public.applications
    where internet_message_id is not null
    group by user_id, internet_message_id
    having count(*) > 1
  loop
    select id into primary_id
    from public.applications
    where user_id = grp.user_id
      and internet_message_id = grp.internet_message_id
    order by
      coalesce((case lower(coalesce(status, 'applied'))
        when 'offer' then 5
        when 'rejected' then 4
        when 'interview' then 3
        when 'assessment' then 2
        when 'applied' then 1
        else 0
      end), 0) desc,
      coalesce(applied_at, created_at) asc,
      created_at asc,
      id asc
    limit 1;

    for secondary_id in
      select id
      from public.applications
      where user_id = grp.user_id
        and internet_message_id = grp.internet_message_id
        and id <> primary_id
      order by coalesce(applied_at, created_at) asc, created_at asc, id asc
    loop
      perform public._merge_duplicate_application_pair(primary_id, secondary_id);
    end loop;
  end loop;

  for grp in
    select user_id, gmail_thread_id
    from public.applications
    where gmail_thread_id is not null
    group by user_id, gmail_thread_id
    having count(*) > 1
  loop
    select id into primary_id
    from public.applications
    where user_id = grp.user_id
      and gmail_thread_id = grp.gmail_thread_id
    order by
      coalesce((case lower(coalesce(status, 'applied'))
        when 'offer' then 5
        when 'rejected' then 4
        when 'interview' then 3
        when 'assessment' then 2
        when 'applied' then 1
        else 0
      end), 0) desc,
      coalesce(applied_at, created_at) asc,
      created_at asc,
      id asc
    limit 1;

    for secondary_id in
      select id
      from public.applications
      where user_id = grp.user_id
        and gmail_thread_id = grp.gmail_thread_id
        and id <> primary_id
      order by coalesce(applied_at, created_at) asc, created_at asc, id asc
    loop
      perform public._merge_duplicate_application_pair(primary_id, secondary_id);
    end loop;
  end loop;
end$$;

create unique index if not exists applications_user_gmail_message_id_unique
  on public.applications (user_id, gmail_message_id);

create unique index if not exists applications_user_internet_message_id_unique
  on public.applications (user_id, internet_message_id);

create unique index if not exists applications_user_gmail_thread_id_unique
  on public.applications (user_id, gmail_thread_id);

drop function if exists public._merge_duplicate_application_pair(uuid, uuid);
