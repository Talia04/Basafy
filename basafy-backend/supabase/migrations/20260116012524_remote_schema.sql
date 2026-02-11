drop extension if exists "pg_net";

drop trigger if exists "set_user_notification_settings_updated_at" on "public"."user_notification_settings";

drop policy "Users can view own notifications" on "public"."notifications";

drop policy "Users can insert own notification settings" on "public"."user_notification_settings";

drop policy "Users can update own notification settings" on "public"."user_notification_settings";

drop policy "Users can view own notification settings" on "public"."user_notification_settings";

revoke delete on table "public"."notifications" from "anon";

revoke insert on table "public"."notifications" from "anon";

revoke references on table "public"."notifications" from "anon";

revoke select on table "public"."notifications" from "anon";

revoke trigger on table "public"."notifications" from "anon";

revoke truncate on table "public"."notifications" from "anon";

revoke update on table "public"."notifications" from "anon";

revoke delete on table "public"."notifications" from "authenticated";

revoke insert on table "public"."notifications" from "authenticated";

revoke references on table "public"."notifications" from "authenticated";

revoke select on table "public"."notifications" from "authenticated";

revoke trigger on table "public"."notifications" from "authenticated";

revoke truncate on table "public"."notifications" from "authenticated";

revoke update on table "public"."notifications" from "authenticated";

revoke delete on table "public"."notifications" from "service_role";

revoke insert on table "public"."notifications" from "service_role";

revoke references on table "public"."notifications" from "service_role";

revoke select on table "public"."notifications" from "service_role";

revoke trigger on table "public"."notifications" from "service_role";

revoke truncate on table "public"."notifications" from "service_role";

revoke update on table "public"."notifications" from "service_role";

revoke delete on table "public"."user_notification_settings" from "anon";

revoke insert on table "public"."user_notification_settings" from "anon";

revoke references on table "public"."user_notification_settings" from "anon";

revoke select on table "public"."user_notification_settings" from "anon";

revoke trigger on table "public"."user_notification_settings" from "anon";

revoke truncate on table "public"."user_notification_settings" from "anon";

revoke update on table "public"."user_notification_settings" from "anon";

revoke delete on table "public"."user_notification_settings" from "authenticated";

revoke insert on table "public"."user_notification_settings" from "authenticated";

revoke references on table "public"."user_notification_settings" from "authenticated";

revoke select on table "public"."user_notification_settings" from "authenticated";

revoke trigger on table "public"."user_notification_settings" from "authenticated";

revoke truncate on table "public"."user_notification_settings" from "authenticated";

revoke update on table "public"."user_notification_settings" from "authenticated";

revoke delete on table "public"."user_notification_settings" from "service_role";

revoke insert on table "public"."user_notification_settings" from "service_role";

revoke references on table "public"."user_notification_settings" from "service_role";

revoke select on table "public"."user_notification_settings" from "service_role";

revoke trigger on table "public"."user_notification_settings" from "service_role";

revoke truncate on table "public"."user_notification_settings" from "service_role";

revoke update on table "public"."user_notification_settings" from "service_role";

alter table "public"."notifications" drop constraint "notifications_user_id_fkey";

alter table "public"."user_notification_settings" drop constraint "user_notification_settings_user_id_fkey";

alter table "public"."events" drop constraint "events_user_id_fkey";

alter table "public"."tasks" drop constraint "tasks_user_id_fkey";

drop function if exists "public"."create_user_notification_settings"();

drop function if exists "public"."set_user_notification_settings_updated_at"();

drop view if exists "public"."v_calendar_events";

drop view if exists "public"."v_home_metrics";

drop view if exists "public"."v_home_upcoming_events";

drop view if exists "public"."v_pipeline_applications";

alter table "public"."notifications" drop constraint "notifications_pkey";

alter table "public"."user_notification_settings" drop constraint "user_notification_settings_pkey";

drop index if exists "public"."idx_notifications_scheduled_for";

drop index if exists "public"."idx_notifications_user_created_at";

drop index if exists "public"."idx_notifications_user_is_read";

drop index if exists "public"."notifications_pkey";

drop index if exists "public"."user_notification_settings_pkey";

drop table "public"."notifications";

drop table "public"."user_notification_settings";


  create table "public"."gmail_sync_state" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "connection_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "initial_import_status" text not null default 'not_started'::text,
    "initial_import_progress" integer,
    "last_phase1_result_count" integer not null default 0,
    "last_deep_result_count" integer not null default 0,
    "last_sync_summary" text
      );


alter table "public"."gmail_sync_state" enable row level security;

alter table "public"."applications" alter column "is_hidden" set not null;

alter table "public"."gmail_connections" add column "backfill_completed_at" timestamp with time zone;

alter table "public"."gmail_connections" add column "backfill_page_token" text;

alter table "public"."gmail_connections" add column "backfill_processed_count" integer;

alter table "public"."gmail_connections" add column "backfill_started_at" timestamp with time zone;

alter table "public"."gmail_connections" add column "backfill_total_estimate" integer;

alter table "public"."gmail_connections" add column "last_synced_at" timestamp with time zone;

alter table "public"."tasks" add column "completed_at" timestamp with time zone;

alter table "public"."tasks" add column "description" text;

alter table "public"."tasks" add column "source_message_id" text;

CREATE INDEX gmail_sync_state_connection_id_idx ON public.gmail_sync_state USING btree (connection_id);

CREATE UNIQUE INDEX gmail_sync_state_pkey ON public.gmail_sync_state USING btree (id);

CREATE UNIQUE INDEX gmail_sync_state_user_id_unique ON public.gmail_sync_state USING btree (user_id);

CREATE INDEX idx_tasks_source_message_id ON public.tasks USING btree (source_message_id);

alter table "public"."gmail_sync_state" add constraint "gmail_sync_state_pkey" PRIMARY KEY using index "gmail_sync_state_pkey";

alter table "public"."gmail_sync_state" add constraint "gmail_sync_state_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES public.gmail_connections(id) ON DELETE SET NULL not valid;

alter table "public"."gmail_sync_state" validate constraint "gmail_sync_state_connection_id_fkey";

alter table "public"."gmail_sync_state" add constraint "gmail_sync_state_initial_import_status_check" CHECK ((initial_import_status = ANY (ARRAY['not_started'::text, 'phase1_running'::text, 'phase1_done'::text, 'deep_running'::text, 'deep_done'::text, 'failed'::text]))) not valid;

alter table "public"."gmail_sync_state" validate constraint "gmail_sync_state_initial_import_status_check";

alter table "public"."gmail_sync_state" add constraint "gmail_sync_state_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."gmail_sync_state" validate constraint "gmail_sync_state_user_id_fkey";

alter table "public"."events" add constraint "events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."events" validate constraint "events_user_id_fkey";

alter table "public"."tasks" add constraint "tasks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."tasks" validate constraint "tasks_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_insights_sankey(p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
with params as (
  select
    coalesce(p_start_at, now() - interval '30 days') as start_at,
    coalesce(p_end_at, now()) as end_at
),
apps as (
  select
    a.id,
    a.user_id,
    coalesce(a.applied_at, a.created_at) as applied_effective,
    lower(a.status) as status
  from public.applications a
  where a.user_id = auth.uid()
),
apps_in_range as (
  select a.*
  from apps a
  cross join params p
  where a.applied_effective >= p.start_at
    and a.applied_effective < p.end_at
),
normalized as (
  select
    id,
    case
      when status in ('assessment','interview','offer','rejected','archived') then status
      else 'applied'
    end as stage
  from apps_in_range
),
links as (
  select 'applied' as source, 'assessment' as target, count(*)::int as count
  from normalized
  where stage = 'assessment'
  union all
  select 'applied', 'interview', count(*)::int
  from normalized
  where stage = 'interview'
  union all
  select 'applied', 'offer', count(*)::int
  from normalized
  where stage = 'offer'
  union all
  select 'applied', 'rejected', count(*)::int
  from normalized
  where stage = 'rejected'
  union all
  select 'applied', 'archived', count(*)::int
  from normalized
  where stage = 'archived'
),
stage_counts as (
  select stage, count(*)::int as count
  from normalized
  group by stage
),
nodes as (
  select * from (values
    ('applied', (select coalesce((select count from stage_counts where stage = 'applied'), 0))),
    ('assessment', (select coalesce((select count from stage_counts where stage = 'assessment'), 0))),
    ('interview', (select coalesce((select count from stage_counts where stage = 'interview'), 0))),
    ('offer', (select coalesce((select count from stage_counts where stage = 'offer'), 0))),
    ('rejected', (select coalesce((select count from stage_counts where stage = 'rejected'), 0))),
    ('archived', (select coalesce((select count from stage_counts where stage = 'archived'), 0)))
  ) as n(stage, count)
)
select jsonb_build_object(
  'nodes',
  (select jsonb_agg(jsonb_build_object('id', stage, 'count', count) order by stage) from nodes),
  'links',
  (select jsonb_agg(jsonb_build_object('source', source, 'target', target, 'count', count) order by source, target)
   from links)
);
$function$
;

CREATE OR REPLACE FUNCTION public.get_insights_summary(p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(total_applications integer, stage_applied integer, stage_assessment integer, stage_interview integer, stage_offer integer, stage_rejected integer, stage_archived integer, response_rate numeric, avg_response_days numeric, open_tasks integer, stalled_count integer)
 LANGUAGE sql
 STABLE
AS $function$
with params as (
  select
    coalesce(p_start_at, now() - interval '30 days') as start_at,
    coalesce(p_end_at, now()) as end_at
),
apps as (
  select
    a.*,
    coalesce(a.applied_at, a.created_at) as applied_effective
  from public.applications a
  where a.user_id = auth.uid()
),
apps_in_range as (
  select a.*
  from apps a
  cross join params p
  where a.applied_effective >= p.start_at
    and a.applied_effective < p.end_at
),
stage_counts as (
  select
    count(*)::int as total_applications,
    count(*) filter (where status = 'applied')::int as stage_applied,
    count(*) filter (where status = 'assessment')::int as stage_assessment,
    count(*) filter (where status = 'interview')::int as stage_interview,
    count(*) filter (where status = 'offer')::int as stage_offer,
    count(*) filter (where status = 'rejected')::int as stage_rejected,
    count(*) filter (where status = 'archived')::int as stage_archived
  from apps_in_range
),
progression as (
  select
    count(*) filter (where status is not null and status not in ('applied', 'archived'))::numeric as progressed_count,
    count(*)::numeric as total_count
  from apps_in_range
),
response_times as (
  select avg(date_part('day', fe.first_event_at - a.applied_effective)) as avg_days
  from apps_in_range a
  join lateral (
    select min(e.start_at) as first_event_at
    from public.events e
    where e.user_id = a.user_id
      and e.application_id = a.id
  ) fe on true
  where a.applied_effective is not null
    and fe.first_event_at is not null
),
open_tasks as (
  select count(*)::int as count
  from public.tasks t
  cross join params p
  where t.user_id = auth.uid()
    and t.status = 'open'
    and coalesce(t.due_at, t.created_at) >= p.start_at
    and coalesce(t.due_at, t.created_at) < p.end_at
),
stalled as (
  select count(*)::int as count
  from apps_in_range a
  where (a.status is null or a.status not in ('rejected', 'archived'))
    and a.updated_at < now() - interval '14 days'
    and not exists (
      select 1
      from public.events e
      where e.user_id = a.user_id
        and e.application_id = a.id
    )
)
select
  sc.total_applications,
  sc.stage_applied,
  sc.stage_assessment,
  sc.stage_interview,
  sc.stage_offer,
  sc.stage_rejected,
  sc.stage_archived,
  case
    when prog.total_count = 0 then 0
    else prog.progressed_count / prog.total_count
  end as response_rate,
  rt.avg_days as avg_response_days,
  ot.count as open_tasks,
  st.count as stalled_count
from stage_counts sc
cross join progression prog
cross join response_times rt
cross join open_tasks ot
cross join stalled st;
$function$
;

create or replace view "public"."v_calendar_events" as  SELECT (date_trunc('month'::text, e.start_at))::date AS month_start,
    (e.start_at)::date AS event_date,
    e.id,
    e.application_id,
    e.event_type,
    e.title,
    a.company,
    a.role_title,
    e.provider,
    e.meeting_link,
    e.start_at,
    e.end_at,
    e.location,
    e.source_type
   FROM (public.events e
     LEFT JOIN public.applications a ON ((a.id = e.application_id)))
  WHERE (e.user_id = auth.uid());


create or replace view "public"."v_home_metrics" as  WITH apps AS (
         SELECT applications.id,
            applications.user_id,
            applications.company,
            applications.role,
            applications.status,
            applications.created_at,
            applications.updated_at,
            applications.source_type,
            applications.gmail_message_id,
            applications.gmail_thread_id,
            applications.email_snippet,
            applications.is_hidden,
            applications.last_synced_at,
            applications.role_title,
            applications.applied_at,
            applications.location,
            applications.notes
           FROM public.applications
          WHERE (applications.user_id = auth.uid())
        ), interviews AS (
         SELECT (count(*))::integer AS count
           FROM public.events
          WHERE ((events.user_id = auth.uid()) AND (events.event_type = 'interview'::text) AND (events.start_at >= now()) AND (events.start_at < (now() + '7 days'::interval)))
        ), open_tasks AS (
         SELECT (count(*))::integer AS count
           FROM public.tasks
          WHERE ((tasks.user_id = auth.uid()) AND (tasks.status = 'open'::text))
        ), response_times AS (
         SELECT avg(date_part('day'::text, (fe.first_event_at - a.applied_at))) AS avg_days
           FROM (apps a
             JOIN LATERAL ( SELECT min(e.start_at) AS first_event_at
                   FROM public.events e
                  WHERE ((e.user_id = a.user_id) AND (e.application_id = a.id))) fe ON (true))
          WHERE ((a.applied_at IS NOT NULL) AND (fe.first_event_at IS NOT NULL))
        )
 SELECT (( SELECT count(*) AS count
           FROM apps
          WHERE ((apps.status IS NULL) OR (apps.status <> ALL (ARRAY['rejected'::text, 'archived'::text])))))::integer AS total_active_applications,
    ( SELECT interviews.count
           FROM interviews) AS interviews_next_7_days,
    ( SELECT open_tasks.count
           FROM open_tasks) AS open_tasks,
        CASE
            WHEN (( SELECT count(*) AS count
               FROM apps) = 0) THEN (0)::numeric
            ELSE ((( SELECT count(*) AS count
               FROM apps
              WHERE (apps.status = 'offer'::text)))::numeric / (( SELECT count(*) AS count
               FROM apps))::numeric)
        END AS success_rate,
    ( SELECT response_times.avg_days
           FROM response_times) AS avg_response_days;


create or replace view "public"."v_home_upcoming_events" as  SELECT e.id,
    e.application_id,
    e.event_type,
    e.title,
    a.company,
    a.role_title,
    e.provider,
    e.meeting_link,
    e.start_at,
    e.end_at,
    e.location,
    e.source_type
   FROM (public.events e
     LEFT JOIN public.applications a ON ((a.id = e.application_id)))
  WHERE ((e.user_id = auth.uid()) AND (e.start_at >= now()))
  ORDER BY e.start_at
 LIMIT 5;


create or replace view "public"."v_pipeline_applications" as  SELECT id,
    status,
    applied_at,
    company,
    role_title
   FROM public.applications
  WHERE (user_id = auth.uid())
  ORDER BY status, applied_at DESC NULLS LAST;


grant delete on table "public"."gmail_sync_state" to "anon";

grant insert on table "public"."gmail_sync_state" to "anon";

grant references on table "public"."gmail_sync_state" to "anon";

grant select on table "public"."gmail_sync_state" to "anon";

grant trigger on table "public"."gmail_sync_state" to "anon";

grant truncate on table "public"."gmail_sync_state" to "anon";

grant update on table "public"."gmail_sync_state" to "anon";

grant delete on table "public"."gmail_sync_state" to "authenticated";

grant insert on table "public"."gmail_sync_state" to "authenticated";

grant references on table "public"."gmail_sync_state" to "authenticated";

grant select on table "public"."gmail_sync_state" to "authenticated";

grant trigger on table "public"."gmail_sync_state" to "authenticated";

grant truncate on table "public"."gmail_sync_state" to "authenticated";

grant update on table "public"."gmail_sync_state" to "authenticated";

grant delete on table "public"."gmail_sync_state" to "service_role";

grant insert on table "public"."gmail_sync_state" to "service_role";

grant references on table "public"."gmail_sync_state" to "service_role";

grant select on table "public"."gmail_sync_state" to "service_role";

grant trigger on table "public"."gmail_sync_state" to "service_role";

grant truncate on table "public"."gmail_sync_state" to "service_role";

grant update on table "public"."gmail_sync_state" to "service_role";


  create policy "Users can insert own gmail sync state"
  on "public"."gmail_sync_state"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own gmail sync state"
  on "public"."gmail_sync_state"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own gmail sync state"
  on "public"."gmail_sync_state"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));


CREATE TRIGGER set_gmail_sync_state_updated_at BEFORE UPDATE ON public.gmail_sync_state FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

drop trigger if exists "create_user_notification_settings" on "auth"."users";

