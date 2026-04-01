-- Merge duplicate Gmail applications that share the same company name but have no role.
-- These accumulate when the parser can't extract a role from the email (e.g., MSX International × 5).
-- After merging, the Tier-3 fix in stage-write.ts prevents future recurrence.

do $$
declare
  grp      record;
  keep_id  uuid;
  dup_ids  uuid[];
  dup_id   uuid;
  priority jsonb := '{"offer":5,"rejected":4,"interview":3,"assessment":2,"applied":1}'::jsonb;
begin

  -- Find user+company groups where ALL apps have no role and there are duplicates.
  for grp in
    select
      user_id,
      lower(trim(company)) as norm_company,
      array_agg(id
        order by
          coalesce((priority ->> lower(coalesce(status, 'applied')))::int, 1) desc,
          coalesce(applied_at, created_at) asc,
          created_at asc,
          id asc
      ) as ordered_ids
    from public.applications
    where
      (role is null or trim(role) = '')
      and company is not null and trim(company) <> ''
      and source_type = 'gmail'
    group by user_id, lower(trim(company))
    having count(*) > 1
  loop
    keep_id := grp.ordered_ids[1];
    -- All IDs after the first one are duplicates to be merged in.
    dup_ids := grp.ordered_ids[2:array_length(grp.ordered_ids, 1)];

    foreach dup_id in array dup_ids loop

      -- Delete exact-duplicate tasks/events before redirecting FKs
      delete from public.tasks t
      using public.tasks existing
      where t.application_id = dup_id
        and existing.application_id = keep_id
        and existing.user_id = t.user_id
        and existing.title = t.title;

      delete from public.events e
      using public.events existing
      where e.application_id = dup_id
        and existing.application_id = keep_id
        and existing.user_id = e.user_id
        and existing.event_type = e.event_type
        and existing.start_at = e.start_at;

      -- Redirect all FKs to the surviving app
      update public.job_email_events set application_id = keep_id where application_id = dup_id;
      update public.tasks            set application_id = keep_id where application_id = dup_id;
      update public.events           set application_id = keep_id where application_id = dup_id;
      update public.notifications
        set entity_id = keep_id
        where entity_id = dup_id and entity_type = 'application';

      -- Merge metadata from duplicate into keeper where keeper is missing values
      update public.applications
      set
        gmail_message_id    = coalesce(gmail_message_id,    (select gmail_message_id    from public.applications where id = dup_id)),
        gmail_thread_id     = coalesce(gmail_thread_id,     (select gmail_thread_id     from public.applications where id = dup_id)),
        internet_message_id = coalesce(internet_message_id, (select internet_message_id from public.applications where id = dup_id)),
        canonical_key       = coalesce(canonical_key,       (select canonical_key       from public.applications where id = dup_id)),
        portal_domain       = coalesce(portal_domain,       (select portal_domain       from public.applications where id = dup_id)),
        applied_at          = least(
                                applied_at,
                                (select applied_at from public.applications where id = dup_id)
                              ),
        last_synced_at      = greatest(
                                last_synced_at,
                                (select last_synced_at from public.applications where id = dup_id)
                              ),
        is_starred          = is_starred or coalesce((select is_starred from public.applications where id = dup_id), false)
      where id = keep_id;

      delete from public.applications where id = dup_id;

    end loop;
  end loop;

  -- Backfill job_email_events.application_id where currently null,
  -- using gmail_thread_id as the join key so historical events link up.
  update public.job_email_events jee
  set application_id = a.id
  from public.applications a
  where jee.user_id = a.user_id
    and jee.application_id is null
    and jee.gmail_thread_id is not null
    and jee.gmail_thread_id = a.gmail_thread_id;

  -- Also backfill via gmail_message_id for any remaining nulls.
  update public.job_email_events jee
  set application_id = a.id
  from public.applications a
  where jee.user_id = a.user_id
    and jee.application_id is null
    and jee.gmail_message_id is not null
    and jee.gmail_message_id = a.gmail_message_id;

end $$;
