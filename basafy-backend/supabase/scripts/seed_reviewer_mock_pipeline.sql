-- Seed a full reviewer demo pipeline for reviewer@basafy.app.
--
-- What this script does:
-- 1. Ensures the reviewer auth user is marked as a mock user.
-- 2. Resets prior reviewer pipeline data.
-- 3. Seeds 100 Gmail-style applications across 100 unique companies.
-- 4. Seeds 58 follow-up emails across 30 application threads.
-- 5. Seeds linked job_email_events, interview/assessment calendar events,
--    notifications, Gmail connection state, and mock Gmail messages.
--
-- Run this in the Supabase SQL editor after the auth user exists.

begin;

create extension if not exists pgcrypto;

create temporary table reviewer_ctx on commit drop as
select
  u.id as user_id,
  lower(u.email) as email,
  (
    select p.id
    from public.profiles p
    where p.user_id = u.id
    order by p.created_at asc
    limit 1
  ) as profile_id
from auth.users u
where lower(u.email) = 'reviewer@basafy.app';

do $$
begin
  if not exists (select 1 from reviewer_ctx) then
    raise exception 'Auth user reviewer@basafy.app not found. Create the auth user first.';
  end if;
end
$$;

update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('is_mock', true)
from reviewer_ctx ctx
where u.id = ctx.user_id;

insert into public.profiles (
  user_id,
  full_name,
  has_seen_gmail_onboarding,
  gmail_priority_domains
)
select
  ctx.user_id,
  'App Review Demo',
  true,
  array[
    'asterlabs.dev',
    'brindlecloud.io',
    'fluxops.ai',
    'harborlogic.cloud',
    'ionstack.tech'
  ]::text[]
from reviewer_ctx ctx
where not exists (
  select 1
  from public.profiles p
  where p.user_id = ctx.user_id
);

update reviewer_ctx ctx
set profile_id = (
  select p.id
  from public.profiles p
  where p.user_id = ctx.user_id
  order by p.created_at asc
  limit 1
);

update public.profiles p
set
  full_name = 'App Review Demo',
  has_seen_gmail_onboarding = true,
  gmail_priority_domains = array[
    'asterlabs.dev',
    'brindlecloud.io',
    'fluxops.ai',
    'harborlogic.cloud',
    'ionstack.tech'
  ]::text[],
  updated_at = now()
from reviewer_ctx ctx
where p.id = ctx.profile_id;

delete from public.notifications n
using reviewer_ctx ctx
where n.user_id = ctx.user_id;

delete from public.tasks t
using reviewer_ctx ctx
where t.user_id in (ctx.user_id, ctx.profile_id);

delete from public.events e
using reviewer_ctx ctx
where e.user_id in (ctx.user_id, ctx.profile_id);

delete from public.job_email_events je
using reviewer_ctx ctx
where je.user_id = ctx.user_id;

delete from public.mock_gmail_messages mgm
using reviewer_ctx ctx
where mgm.user_id = ctx.user_id;

delete from public.applications a
using reviewer_ctx ctx
where a.user_id = ctx.user_id;

delete from public.gmail_sync_logs gsl
using reviewer_ctx ctx
where gsl.user_id = ctx.user_id;

delete from public.gmail_sync_state gss
using reviewer_ctx ctx
where gss.user_id = ctx.user_id;

insert into public.gmail_connections (
  user_id,
  email,
  provider,
  refresh_token,
  access_token,
  token_scopes,
  access_token_expires_at,
  last_synced_at,
  backfill_started_at,
  backfill_completed_at,
  backfill_processed_count,
  backfill_total_estimate,
  backfill_page_token
)
select
  ctx.user_id,
  'reviewer@basafy.app',
  'google',
  'mock-refresh-token',
  'mock-access-token',
  array['https://www.googleapis.com/auth/gmail.readonly']::text[],
  now() + interval '1 hour',
  now(),
  now() - interval '2 minutes',
  now(),
  158,
  158,
  null
from reviewer_ctx ctx
on conflict (user_id, provider) do update
set
  email = excluded.email,
  refresh_token = excluded.refresh_token,
  access_token = excluded.access_token,
  token_scopes = excluded.token_scopes,
  access_token_expires_at = excluded.access_token_expires_at,
  last_synced_at = excluded.last_synced_at,
  backfill_started_at = excluded.backfill_started_at,
  backfill_completed_at = excluded.backfill_completed_at,
  backfill_processed_count = excluded.backfill_processed_count,
  backfill_total_estimate = excluded.backfill_total_estimate,
  backfill_page_token = excluded.backfill_page_token;

create temporary table reviewer_apps_seed on commit drop as
with company_prefixes(prefix_idx, prefix) as (
  values
    (1, 'Aster'),
    (2, 'Brindle'),
    (3, 'Cinder'),
    (4, 'Drift'),
    (5, 'Ember'),
    (6, 'Flux'),
    (7, 'Granite'),
    (8, 'Harbor'),
    (9, 'Ion'),
    (10, 'Juniper')
),
company_suffixes(suffix_idx, suffix) as (
  values
    (1, 'Labs'),
    (2, 'Cloud'),
    (3, 'Systems'),
    (4, 'Data'),
    (5, 'Stack'),
    (6, 'Works'),
    (7, 'Logic'),
    (8, 'AI'),
    (9, 'Ops'),
    (10, 'Dynamics')
),
role_catalog(role_idx, role_title, team_name, stack_primary, stack_secondary, location_name) as (
  values
    (0, 'Backend Software Engineer', 'Core Platform', 'TypeScript', 'Postgres', 'Remote (US)'),
    (1, 'Senior Software Engineer, Platform', 'Runtime Infrastructure', 'Go', 'Kubernetes', 'New York, NY'),
    (2, 'Data Engineer', 'Data Platform', 'dbt', 'Snowflake', 'Seattle, WA'),
    (3, 'Software Engineer, Infrastructure', 'Cloud Runtime', 'Python', 'Terraform', 'Austin, TX'),
    (4, 'Full Stack Engineer', 'Product Engineering', 'React', 'Node.js', 'San Francisco, CA'),
    (5, 'Senior Data Engineer', 'Warehouse & Analytics', 'Airflow', 'BigQuery', 'Chicago, IL'),
    (6, 'Software Engineer, Developer Productivity', 'Developer Experience', 'Bazel', 'CI/CD', 'Remote (Canada/US)'),
    (7, 'Machine Learning Infrastructure Engineer', 'ML Platform', 'Python', 'Ray', 'Boston, MA'),
    (8, 'Staff Software Engineer, Distributed Systems', 'Storage & Replication', 'Rust', 'Kafka', 'Denver, CO'),
    (9, 'Analytics Data Engineer', 'Analytics Engineering', 'SQL', 'Looker', 'Atlanta, GA')
),
company_matrix as (
  select
    row_number() over (order by p.prefix_idx, s.suffix_idx) as seq,
    p.prefix,
    s.suffix,
    p.prefix || ' ' || s.suffix as company
  from company_prefixes p
  cross join company_suffixes s
)
select
  m.seq,
  m.company,
  lower(regexp_replace(m.prefix || m.suffix, '[^a-zA-Z0-9]+', '', 'g')) as company_slug,
  rc.role_title,
  rc.team_name,
  rc.stack_primary,
  rc.stack_secondary,
  rc.location_name,
  case mod(m.seq - 1, 6)
    when 0 then lower(regexp_replace(m.prefix || m.suffix, '[^a-zA-Z0-9]+', '', 'g')) || '.dev'
    when 1 then lower(regexp_replace(m.prefix || m.suffix, '[^a-zA-Z0-9]+', '', 'g')) || '.io'
    when 2 then lower(regexp_replace(m.prefix || m.suffix, '[^a-zA-Z0-9]+', '', 'g')) || '.cloud'
    when 3 then lower(regexp_replace(m.prefix || m.suffix, '[^a-zA-Z0-9]+', '', 'g')) || '.ai'
    when 4 then 'hire-' || lower(regexp_replace(m.prefix || m.suffix, '[^a-zA-Z0-9]+', '', 'g')) || '.tech'
    else lower(regexp_replace(m.prefix || m.suffix, '[^a-zA-Z0-9]+', '', 'g')) || '.systems'
  end as mail_domain,
  'REQ-' || lpad(m.seq::text, 4, '0') as requisition_id,
  'JOB-' || lpad(m.seq::text, 4, '0') as job_id,
  'reviewer-demo-' || lpad(m.seq::text, 3, '0') as external_application_id,
  'reviewer-thread-' || lpad(m.seq::text, 3, '0') as gmail_thread_id,
  'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-applied' as application_message_id,
  '<reviewer-' || lpad(m.seq::text, 3, '0') || '-applied@mock.basafy.app>' as application_internet_message_id,
  case
    when m.seq between 1 and 5 then 'assessment'
    when m.seq between 6 and 10 then 'rejected'
    when m.seq between 11 and 20 then 'interview'
    when m.seq between 21 and 24 then 'rejected'
    when m.seq between 25 and 27 then 'offer'
    when m.seq between 28 and 30 then 'interview'
    else 'applied'
  end as final_status,
  case
    when m.seq between 1 and 5 then date_trunc('minute', now() - ((77 - (m.seq - 1) * 3) * interval '1 day') - ((m.seq % 3) * interval '2 hour'))
    when m.seq between 6 and 10 then date_trunc('minute', now() - ((60 - (m.seq - 6) * 2) * interval '1 day') - ((m.seq % 4) * interval '90 minute'))
    when m.seq between 11 and 15 then date_trunc('minute', now() - ((45 - (m.seq - 11) * 2) * interval '1 day') - ((m.seq % 5) * interval '75 minute'))
    when m.seq between 16 and 20 then date_trunc('minute', now() - ((32 - (m.seq - 16) * 2) * interval '1 day') - ((m.seq % 4) * interval '80 minute'))
    when m.seq between 21 and 24 then date_trunc('minute', now() - ((21 - (m.seq - 21) * 2) * interval '1 day') - ((m.seq % 3) * interval '2 hour'))
    when m.seq between 25 and 27 then date_trunc('minute', now() - ((18 - (m.seq - 25) * 3) * interval '1 day') - ((m.seq % 2) * interval '3 hour'))
    when m.seq = 28 then date_trunc('minute', now() - interval '10 days' - interval '2 hour')
    when m.seq = 29 then date_trunc('minute', now() - interval '7 days' - interval '4 hour')
    when m.seq = 30 then date_trunc('minute', now() - interval '5 days' - interval '1 hour')
    else date_trunc('minute', now() - ((((m.seq * 7) % 83) + 6) * interval '1 day') - ((m.seq % 5) * interval '3 hour'))
  end as applied_at,
  (m.seq in (12, 18, 25, 26, 27, 28, 29, 30)) as is_starred
from company_matrix m
join role_catalog rc
  on rc.role_idx = mod(m.seq - 1, 10);

insert into public.applications (
  user_id,
  company,
  role,
  role_title,
  status,
  source_type,
  is_hidden,
  is_starred,
  gmail_message_id,
  gmail_thread_id,
  internet_message_id,
  email_snippet,
  applied_at,
  created_at,
  updated_at,
  last_synced_at,
  canonical_key,
  portal_domain,
  requisition_id,
  job_id,
  external_application_id,
  location,
  notes
)
select
  ctx.user_id,
  s.company,
  s.role_title,
  s.role_title,
  s.final_status,
  'gmail',
  false,
  s.is_starred,
  s.application_message_id,
  s.gmail_thread_id,
  s.application_internet_message_id,
  format(
    'Application received for %s on the %s team. Requisition %s.',
    s.role_title,
    s.team_name,
    s.requisition_id
  ),
  s.applied_at,
  s.applied_at,
  s.applied_at,
  now(),
  lower(s.company_slug || '__' || regexp_replace(lower(s.role_title), '[^a-z0-9]+', '_', 'g')),
  s.mail_domain,
  s.requisition_id,
  s.job_id,
  s.external_application_id,
  s.location_name,
  format(
    'Reviewer demo seed. Team: %s. Primary stack: %s + %s. Thread: %s.',
    s.team_name,
    s.stack_primary,
    s.stack_secondary,
    s.gmail_thread_id
  )
from reviewer_apps_seed s
cross join reviewer_ctx ctx;

create temporary table reviewer_app_map on commit drop as
select
  a.id as application_id,
  a.external_application_id,
  s.seq,
  s.company,
  s.company_slug,
  s.role_title,
  s.team_name,
  s.stack_primary,
  s.stack_secondary,
  s.location_name,
  s.mail_domain,
  s.requisition_id,
  s.job_id,
  s.gmail_thread_id,
  s.application_message_id,
  s.application_internet_message_id,
  s.applied_at,
  s.final_status
from public.applications a
join reviewer_apps_seed s
  on s.external_application_id = a.external_application_id
join reviewer_ctx ctx
  on a.user_id = ctx.user_id;

create temporary table reviewer_message_seed on commit drop as
with base_messages as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    m.application_message_id as gmail_message_id,
    m.application_internet_message_id as internet_message_id,
    'application_received'::text as event_type,
    'Applied'::text as parsed_status,
    case mod(m.seq - 1, 8)
      when 0 then format('%s Careers <careers@%s>', m.company, m.mail_domain)
      when 1 then format('%s Talent <talent@%s>', m.company, m.mail_domain)
      when 2 then format('Recruiting Team <recruiting@%s>', m.mail_domain)
      when 3 then format('People Ops <jobs@%s>', m.mail_domain)
      when 4 then format('Greenhouse <no-reply@greenhouse.%s>', m.mail_domain)
      when 5 then format('Lever <no-reply@lever.%s>', m.mail_domain)
      when 6 then format('%s Hiring <hiring+eng@%s>', m.company, m.mail_domain)
      else format('Applicant Tracking <noreply@apply.%s>', m.mail_domain)
    end as from_address,
    case mod(m.seq - 1, 5)
      when 0 then format('Application received - %s at %s', m.role_title, m.company)
      when 1 then format('Thanks for applying to %s', m.company)
      when 2 then format('Your %s application is in review', m.company)
      when 3 then format('%s application confirmation', m.company)
      else format('We received your application for %s', m.role_title)
    end as subject,
    format(
      'We received your application for %s on the %s team. Requisition %s is now in review.',
      m.role_title,
      m.team_name,
      m.requisition_id
    ) as snippet,
    format(
$body$
Hi Tanya,

Thanks for applying to %1$s for the %2$s role on our %3$s team in %4$s.

We have your resume, GitHub link, and work authorization response on file under requisition %5$s. Over the next week, our hiring team will review your experience with %6$s and %7$s to decide whether to move you forward.

If anything has changed with your timeline, location preference, or start date, feel free to reply to this thread.

Best,
%1$s Recruiting
$body$,
      m.company,
      m.role_title,
      m.team_name,
      m.location_name,
      m.requisition_id,
      m.stack_primary,
      m.stack_secondary
    ) as body_text,
    m.applied_at as received_at,
    null::text as calendar_event_type,
    null::text as event_title,
    null::timestamptz as event_start_at,
    null::timestamptz as event_end_at,
    null::text as provider,
    null::text as meeting_link
  from reviewer_app_map m
),
assessment_only as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-assessment' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-assessment@mock.basafy.app>' as internet_message_id,
    'assessment'::text as event_type,
    'Assessment'::text as parsed_status,
    case when mod(m.seq, 2) = 0
      then 'CodeSignal <noreply@codesignal.test>'
      else 'HackerRank <noreply@hackerrank.test>'
    end as from_address,
    format('Assessment invite for %s at %s', m.role_title, m.company) as subject,
    format(
      'Please complete the technical assessment for %s by %s.',
      m.role_title,
      to_char(timezone('America/New_York', m.applied_at + interval '6 days'), 'Mon DD')
    ) as snippet,
    format(
$body$
Hi Tanya,

Thanks again for your interest in %1$s. We'd like to move you forward for the %2$s role with a short technical exercise.

The assessment focuses on practical work we do on the %3$s team: backend API design, SQL reasoning, and debugging production-style data edge cases involving %4$s and %5$s.

Please submit by %6$s using the secure link below:
%7$s

If you need an extension for travel or interview conflicts, reply here and we can adjust the deadline.

Best,
%1$s Recruiting
$body$,
      m.company,
      m.role_title,
      m.team_name,
      m.stack_primary,
      m.stack_secondary,
      to_char(timezone('America/New_York', m.applied_at + interval '6 days'), 'Dy, Mon DD "at" HH12:MI AM') || ' ET',
      case when mod(m.seq, 2) = 0
        then 'https://app.codesignal.com/standard/' || substr(md5(m.company || m.role_title || 'assessment'), 1, 20)
        else 'https://www.hackerrank.com/tests/' || substr(md5(m.company || m.role_title || 'assessment'), 1, 24)
      end
    ) as body_text,
    m.applied_at + interval '2 days' as received_at,
    'assessment'::text as calendar_event_type,
    format('Assessment: %s - %s', m.company, m.role_title) as event_title,
    m.applied_at + interval '6 days' as event_start_at,
    m.applied_at + interval '6 days' + interval '90 minutes' as event_end_at,
    case when mod(m.seq, 2) = 0 then 'CodeSignal' else 'HackerRank' end as provider,
    case when mod(m.seq, 2) = 0
      then 'https://app.codesignal.com/standard/' || substr(md5(m.company || m.role_title || 'assessment'), 1, 20)
      else 'https://www.hackerrank.com/tests/' || substr(md5(m.company || m.role_title || 'assessment'), 1, 24)
    end as meeting_link
  from reviewer_app_map m
  where m.seq between 1 and 5
),
screen_then_reject_interview as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-screen' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-screen@mock.basafy.app>' as internet_message_id,
    'interview_invite'::text as event_type,
    'Interview'::text as parsed_status,
    format('%s Recruiting <recruiting@%s>', m.company, m.mail_domain) as from_address,
    format('Interview scheduled - %s / %s', m.company, m.role_title) as subject,
    format(
      'Your 30-minute recruiter screen for %s is scheduled for %s.',
      m.company,
      to_char(timezone('America/New_York', m.applied_at + interval '7 days'), 'Mon DD')
    ) as snippet,
    format(
$body$
Hi Tanya,

Thanks for your application to %1$s. We'd like to move you forward with a 30-minute recruiter screen for the %2$s position.

We'll use the conversation to cover your recent work with %3$s, why you're interested in the %4$s team, and how you approach ownership in distributed engineering environments.

Confirmed time: %5$s
Meeting link: %6$s

If you need to reschedule, reply with two alternate windows and we'll adjust.

Best,
%1$s Recruiting
$body$,
      m.company,
      m.role_title,
      m.stack_primary,
      m.team_name,
      to_char(timezone('America/New_York', m.applied_at + interval '7 days'), 'Dy, Mon DD "at" HH12:MI AM') || ' ET',
      'https://zoom.us/j/' || lpad((910000000 + m.seq * 137)::text, 9, '0')
    ) as body_text,
    m.applied_at + interval '5 days' as received_at,
    'interview'::text as calendar_event_type,
    format('Interview: %s - %s', m.company, m.role_title) as event_title,
    m.applied_at + interval '7 days' as event_start_at,
    m.applied_at + interval '7 days' + interval '30 minutes' as event_end_at,
    'Zoom'::text as provider,
    'https://zoom.us/j/' || lpad((910000000 + m.seq * 137)::text, 9, '0') as meeting_link
  from reviewer_app_map m
  where m.seq between 6 and 10
),
screen_then_reject_rejection as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-rejection' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-rejection@mock.basafy.app>' as internet_message_id,
    'rejection'::text as event_type,
    'Rejected'::text as parsed_status,
    format('%s Recruiting <recruiting@%s>', m.company, m.mail_domain) as from_address,
    format('Update on your application to %s', m.company) as subject,
    format(
      'We appreciated your time and wanted to share an update on the %s role.',
      m.role_title
    ) as snippet,
    format(
$body$
Hi Tanya,

Thank you again for speaking with our recruiting team about the %1$s role.

After the first round, we decided to move forward with candidates whose recent experience lines up more directly with the current needs of our %2$s roadmap, especially hands-on work involving %3$s at larger scale.

We appreciated the thoughtfulness of your examples and will keep your profile on file for future openings. We wish you the best in your search.

Sincerely,
%1$s Recruiting
$body$,
      m.company,
      m.team_name,
      m.stack_secondary
    ) as body_text,
    m.applied_at + interval '12 days' as received_at,
    null::text as calendar_event_type,
    null::text as event_title,
    null::timestamptz as event_start_at,
    null::timestamptz as event_end_at,
    null::text as provider,
    null::text as meeting_link
  from reviewer_app_map m
  where m.seq between 6 and 10
),
assessment_then_interview_assessment as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-challenge' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-challenge@mock.basafy.app>' as internet_message_id,
    'assessment'::text as event_type,
    'Assessment'::text as parsed_status,
    'CodeSignal <noreply@codesignal.test>' as from_address,
    format('CodeSignal for %s at %s', m.role_title, m.company) as subject,
    format(
      'Please complete your %s assessment by %s.',
      m.company,
      to_char(timezone('America/New_York', m.applied_at + interval '6 days'), 'Mon DD')
    ) as snippet,
    format(
$body$
Hi Tanya,

The hiring team at %1$s reviewed your application and would like to continue with a 70-minute CodeSignal for the %2$s role.

The exercise is built around realistic scenarios from our %3$s group, including API throughput, data correctness, and failure handling when services depending on %4$s and %5$s become unavailable.

Submission deadline: %6$s
Assessment link: %7$s

Once you submit, we typically review within three business days.

Best,
%1$s Recruiting
$body$,
      m.company,
      m.role_title,
      m.team_name,
      m.stack_primary,
      m.stack_secondary,
      to_char(timezone('America/New_York', m.applied_at + interval '6 days'), 'Dy, Mon DD "at" HH12:MI AM') || ' ET',
      'https://app.codesignal.com/standard/' || substr(md5(m.company || m.role_title || 'codesignal'), 1, 20)
    ) as body_text,
    m.applied_at + interval '2 days' as received_at,
    'assessment'::text as calendar_event_type,
    format('Assessment: %s - %s', m.company, m.role_title) as event_title,
    m.applied_at + interval '6 days' as event_start_at,
    m.applied_at + interval '6 days' + interval '90 minutes' as event_end_at,
    'CodeSignal'::text as provider,
    'https://app.codesignal.com/standard/' || substr(md5(m.company || m.role_title || 'codesignal'), 1, 20) as meeting_link
  from reviewer_app_map m
  where m.seq between 11 and 15
),
assessment_then_interview_interview as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-technical' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-technical@mock.basafy.app>' as internet_message_id,
    'interview_invite'::text as event_type,
    'Interview'::text as parsed_status,
    format('%s Recruiting <recruiting@%s>', m.company, m.mail_domain) as from_address,
    format('Technical interview scheduled with %s', m.company) as subject,
    format(
      'Your technical interview for %s is scheduled for %s.',
      m.company,
      to_char(timezone('America/New_York', m.applied_at + interval '14 days'), 'Mon DD')
    ) as snippet,
    format(
$body$
Hi Tanya,

Thanks for completing the assessment for %1$s. The team would like to invite you to the next step: a 60-minute technical interview for the %2$s role.

This conversation will focus on tradeoffs in services that touch %3$s and %4$s, plus one short debugging scenario drawn from the %5$s roadmap.

Confirmed time: %6$s
Meeting link: %7$s

Looking forward to speaking with you.

Best,
%1$s Recruiting
$body$,
      m.company,
      m.role_title,
      m.stack_primary,
      m.stack_secondary,
      m.team_name,
      to_char(timezone('America/New_York', m.applied_at + interval '14 days'), 'Dy, Mon DD "at" HH12:MI AM') || ' ET',
      'https://meet.google.com/' || substr(md5(m.company || m.role_title || 'technical'), 1, 3) || '-' || substr(md5(m.company || m.role_title || 'technical'), 4, 4) || '-' || substr(md5(m.company || m.role_title || 'technical'), 8, 3)
    ) as body_text,
    m.applied_at + interval '11 days' as received_at,
    'interview'::text as calendar_event_type,
    format('Interview: %s - %s', m.company, m.role_title) as event_title,
    m.applied_at + interval '14 days' as event_start_at,
    m.applied_at + interval '14 days' + interval '60 minutes' as event_end_at,
    'Google Meet'::text as provider,
    'https://meet.google.com/' || substr(md5(m.company || m.role_title || 'technical'), 1, 3) || '-' || substr(md5(m.company || m.role_title || 'technical'), 4, 4) || '-' || substr(md5(m.company || m.role_title || 'technical'), 8, 3) as meeting_link
  from reviewer_app_map m
  where m.seq between 11 and 15
),
two_interviews_first as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-recruiter-screen' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-recruiter-screen@mock.basafy.app>' as internet_message_id,
    'interview_invite'::text as event_type,
    'Interview'::text as parsed_status,
    format('%s Recruiting <recruiting@%s>', m.company, m.mail_domain) as from_address,
    format('Recruiter screen confirmed - %s', m.company) as subject,
    format(
      'Your recruiter screen with %s is booked for %s.',
      m.company,
      to_char(timezone('America/New_York', m.applied_at + interval '6 days'), 'Mon DD')
    ) as snippet,
    format(
$body$
Hi Tanya,

We'd like to confirm your recruiter screen for the %1$s role at %2$s.

We'll spend 30 minutes reviewing your recent product scope, your work with %3$s, and what you're looking for in a team operating at the scale of our %4$s organization.

Confirmed time: %5$s
Meeting link: %6$s

Best,
%2$s Recruiting
$body$,
      m.role_title,
      m.company,
      m.stack_primary,
      m.team_name,
      to_char(timezone('America/New_York', m.applied_at + interval '6 days'), 'Dy, Mon DD "at" HH12:MI AM') || ' ET',
      'https://zoom.us/j/' || lpad((920000000 + m.seq * 173)::text, 9, '0')
    ) as body_text,
    m.applied_at + interval '4 days' as received_at,
    'interview'::text as calendar_event_type,
    format('Interview: %s - %s', m.company, m.role_title) as event_title,
    m.applied_at + interval '6 days' as event_start_at,
    m.applied_at + interval '6 days' + interval '30 minutes' as event_end_at,
    'Zoom'::text as provider,
    'https://zoom.us/j/' || lpad((920000000 + m.seq * 173)::text, 9, '0') as meeting_link
  from reviewer_app_map m
  where m.seq between 16 and 20
),
two_interviews_second as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-onsite' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-onsite@mock.basafy.app>' as internet_message_id,
    'interview_invite'::text as event_type,
    'Interview'::text as parsed_status,
    format('%s Recruiting <recruiting@%s>', m.company, m.mail_domain) as from_address,
    format('Virtual onsite interview for %s', m.company) as subject,
    format(
      'Your follow-up interview loop with %s is set for %s.',
      m.company,
      to_char(timezone('America/New_York', m.applied_at + interval '15 days'), 'Mon DD')
    ) as snippet,
    format(
$body$
Hi Tanya,

The team enjoyed your first conversation and would like to continue with a virtual onsite for the %1$s role.

This round includes two back-to-back conversations covering system design, incident response, and practical tradeoffs involving %2$s and %3$s across the %4$s roadmap.

Confirmed time: %5$s
Meeting link: %6$s

Best,
%7$s Recruiting
$body$,
      m.role_title,
      m.stack_primary,
      m.stack_secondary,
      m.team_name,
      to_char(timezone('America/New_York', m.applied_at + interval '15 days'), 'Dy, Mon DD "at" HH12:MI AM') || ' ET',
      'https://teams.microsoft.com/l/meetup-join/' || substr(md5(m.company || m.role_title || 'onsite'), 1, 24),
      m.company
    ) as body_text,
    m.applied_at + interval '12 days' as received_at,
    'interview'::text as calendar_event_type,
    format('Interview: %s - %s', m.company, m.role_title) as event_title,
    m.applied_at + interval '15 days' as event_start_at,
    m.applied_at + interval '15 days' + interval '90 minutes' as event_end_at,
    'Microsoft Teams'::text as provider,
    'https://teams.microsoft.com/l/meetup-join/' || substr(md5(m.company || m.role_title || 'onsite'), 1, 24) as meeting_link
  from reviewer_app_map m
  where m.seq between 16 and 20
),
interview_then_reject_interview as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-hm' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-hm@mock.basafy.app>' as internet_message_id,
    'interview_invite'::text as event_type,
    'Interview'::text as parsed_status,
    format('%s Recruiting <recruiting@%s>', m.company, m.mail_domain) as from_address,
    format('Hiring manager interview for %s', m.company) as subject,
    format(
      'Your hiring manager interview with %s is scheduled for %s.',
      m.company,
      to_char(timezone('America/New_York', m.applied_at + interval '10 days'), 'Mon DD')
    ) as snippet,
    format(
$body$
Hi Tanya,

We'd like to invite you to a 45-minute hiring manager interview for the %1$s role at %2$s.

The discussion will focus on ownership, architecture decisions, and how you've handled production ambiguity while working with %3$s and %4$s.

Confirmed time: %5$s
Meeting link: %6$s

Thanks,
%2$s Recruiting
$body$,
      m.role_title,
      m.company,
      m.stack_primary,
      m.stack_secondary,
      to_char(timezone('America/New_York', m.applied_at + interval '10 days'), 'Dy, Mon DD "at" HH12:MI AM') || ' ET',
      'https://meet.google.com/' || substr(md5(m.company || m.role_title || 'hm'), 1, 3) || '-' || substr(md5(m.company || m.role_title || 'hm'), 4, 4) || '-' || substr(md5(m.company || m.role_title || 'hm'), 8, 3)
    ) as body_text,
    m.applied_at + interval '7 days' as received_at,
    'interview'::text as calendar_event_type,
    format('Interview: %s - %s', m.company, m.role_title) as event_title,
    m.applied_at + interval '10 days' as event_start_at,
    m.applied_at + interval '10 days' + interval '45 minutes' as event_end_at,
    'Google Meet'::text as provider,
    'https://meet.google.com/' || substr(md5(m.company || m.role_title || 'hm'), 1, 3) || '-' || substr(md5(m.company || m.role_title || 'hm'), 4, 4) || '-' || substr(md5(m.company || m.role_title || 'hm'), 8, 3) as meeting_link
  from reviewer_app_map m
  where m.seq between 21 and 24
),
interview_then_reject_rejection as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-decline' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-decline@mock.basafy.app>' as internet_message_id,
    'rejection'::text as event_type,
    'Rejected'::text as parsed_status,
    format('%s Recruiting <recruiting@%s>', m.company, m.mail_domain) as from_address,
    format('Regarding your %s application', m.company) as subject,
    format(
      'Thank you for your time with %s. We wanted to share a final update.',
      m.company
    ) as snippet,
    format(
$body$
Hi Tanya,

Thank you for taking the time to speak with our hiring manager about the %1$s opportunity.

We had a strong set of candidates in process and ultimately decided to move forward with someone whose recent experience more closely matches the immediate needs of our %2$s roadmap.

We appreciated the depth of your examples and your clarity around tradeoffs in %3$s-heavy systems. We'll keep your information on file for future openings.

Best,
%1$s Recruiting
$body$,
      m.company,
      m.team_name,
      m.stack_primary
    ) as body_text,
    m.applied_at + interval '16 days' as received_at,
    null::text as calendar_event_type,
    null::text as event_title,
    null::timestamptz as event_start_at,
    null::timestamptz as event_end_at,
    null::text as provider,
    null::text as meeting_link
  from reviewer_app_map m
  where m.seq between 21 and 24
),
offer_path_assessment as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-takehome' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-takehome@mock.basafy.app>' as internet_message_id,
    'assessment'::text as event_type,
    'Assessment'::text as parsed_status,
    'HackerRank <noreply@hackerrank.test>' as from_address,
    format('Take-home assessment for %s', m.company) as subject,
    format(
      'Please submit your take-home for %s by %s.',
      m.company,
      to_char(timezone('America/New_York', m.applied_at + interval '5 days'), 'Mon DD')
    ) as snippet,
    format(
$body$
Hi Tanya,

The team at %1$s would like to continue your process for the %2$s role with a take-home exercise.

The assignment mirrors the real work on our %3$s roadmap: designing a small service, documenting tradeoffs, and modeling a dataset that touches %4$s and %5$s.

Submission deadline: %6$s
Assessment link: %7$s

We know interview loops can stack up quickly, so reply if you need a short extension.

Best,
%1$s Recruiting
$body$,
      m.company,
      m.role_title,
      m.team_name,
      m.stack_primary,
      m.stack_secondary,
      to_char(timezone('America/New_York', m.applied_at + interval '5 days'), 'Dy, Mon DD "at" HH12:MI AM') || ' ET',
      'https://www.hackerrank.com/tests/' || substr(md5(m.company || m.role_title || 'takehome'), 1, 24)
    ) as body_text,
    m.applied_at + interval '2 days' as received_at,
    'assessment'::text as calendar_event_type,
    format('Assessment: %s - %s', m.company, m.role_title) as event_title,
    m.applied_at + interval '5 days' as event_start_at,
    m.applied_at + interval '5 days' + interval '2 hours' as event_end_at,
    'HackerRank'::text as provider,
    'https://www.hackerrank.com/tests/' || substr(md5(m.company || m.role_title || 'takehome'), 1, 24) as meeting_link
  from reviewer_app_map m
  where m.seq between 25 and 27
),
offer_path_interview as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-final-round' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-final-round@mock.basafy.app>' as internet_message_id,
    'interview_invite'::text as event_type,
    'Interview'::text as parsed_status,
    format('%s Recruiting <recruiting@%s>', m.company, m.mail_domain) as from_address,
    format('Final round interview with %s', m.company) as subject,
    format(
      'Your final round for %s is scheduled for %s.',
      m.company,
      to_char(timezone('America/New_York', m.applied_at + interval '12 days'), 'Mon DD')
    ) as snippet,
    format(
$body$
Hi Tanya,

Great news - the team would like to move you to a final round interview for the %1$s role at %2$s.

This session includes a systems discussion and a collaboration conversation with the engineering manager. We'll focus on scaling decisions, pragmatic tradeoffs, and how you communicate technical judgment across stakeholders.

Confirmed time: %3$s
Meeting link: %4$s

Please let us know if anything changes on your side.

Best,
%2$s Recruiting
$body$,
      m.role_title,
      m.company,
      to_char(timezone('America/New_York', m.applied_at + interval '12 days'), 'Dy, Mon DD "at" HH12:MI AM') || ' ET',
      'https://zoom.us/j/' || lpad((930000000 + m.seq * 211)::text, 9, '0')
    ) as body_text,
    m.applied_at + interval '9 days' as received_at,
    'interview'::text as calendar_event_type,
    format('Interview: %s - %s', m.company, m.role_title) as event_title,
    m.applied_at + interval '12 days' as event_start_at,
    m.applied_at + interval '12 days' + interval '75 minutes' as event_end_at,
    'Zoom'::text as provider,
    'https://zoom.us/j/' || lpad((930000000 + m.seq * 211)::text, 9, '0') as meeting_link
  from reviewer_app_map m
  where m.seq between 25 and 27
),
offer_path_offer as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-offer' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-offer@mock.basafy.app>' as internet_message_id,
    'offer'::text as event_type,
    'Offer'::text as parsed_status,
    format('%s People Team <people@%s>', m.company, m.mail_domain) as from_address,
    format('Offer for %s at %s', m.role_title, m.company) as subject,
    format(
      'We are excited to extend an offer for %s. Please review the details by %s.',
      m.role_title,
      to_char(timezone('America/New_York', m.applied_at + interval '19 days'), 'Mon DD')
    ) as snippet,
    format(
$body$
Hi Tanya,

We're excited to extend you an offer for the %1$s role at %2$s.

Your package includes a base salary of $%3$s, a sign-on bonus of $%4$s, and equity detailed in the attached offer packet. We aligned on this level based on your experience driving systems involving %5$s and %6$s.

Please review the offer by %7$s. If you'd like to talk through the package, we're happy to set up a call this week.

Congratulations,
%2$s People Team
$body$,
      m.role_title,
      m.company,
      to_char(172000 + m.seq * 1800, 'FM999999'),
      to_char(12000 + m.seq * 250, 'FM999999'),
      m.stack_primary,
      m.stack_secondary,
      to_char(timezone('America/New_York', m.applied_at + interval '19 days'), 'Dy, Mon DD "at" HH12:MI AM') || ' ET'
    ) as body_text,
    m.applied_at + interval '16 days' as received_at,
    null::text as calendar_event_type,
    null::text as event_title,
    null::timestamptz as event_start_at,
    null::timestamptz as event_end_at,
    null::text as provider,
    null::text as meeting_link
  from reviewer_app_map m
  where m.seq between 25 and 27
),
upcoming_path_screen as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-recent-screen' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-recent-screen@mock.basafy.app>' as internet_message_id,
    'interview_invite'::text as event_type,
    'Interview'::text as parsed_status,
    format('%s Recruiting <recruiting@%s>', m.company, m.mail_domain) as from_address,
    format('Recruiter screen with %s', m.company) as subject,
    format(
      'Your recruiter screen for %s took place on %s.',
      m.company,
      to_char(timezone('America/New_York', m.applied_at + interval '3 days'), 'Mon DD')
    ) as snippet,
    format(
$body$
Hi Tanya,

Thanks again for applying to %1$s. This email confirms your recruiter screen for the %2$s role.

We'll use the conversation to cover the scope of our %3$s team, your recent work across %4$s and %5$s, and what you'd want from your next engineering environment.

Confirmed time: %6$s
Meeting link: %7$s

Best,
%1$s Recruiting
$body$,
      m.company,
      m.role_title,
      m.team_name,
      m.stack_primary,
      m.stack_secondary,
      to_char(timezone('America/New_York', m.applied_at + interval '3 days'), 'Dy, Mon DD "at" HH12:MI AM') || ' ET',
      'https://zoom.us/j/' || lpad((940000000 + m.seq * 163)::text, 9, '0')
    ) as body_text,
    m.applied_at + interval '1 day' as received_at,
    'interview'::text as calendar_event_type,
    format('Interview: %s - %s', m.company, m.role_title) as event_title,
    m.applied_at + interval '3 days' as event_start_at,
    m.applied_at + interval '3 days' + interval '30 minutes' as event_end_at,
    'Zoom'::text as provider,
    'https://zoom.us/j/' || lpad((940000000 + m.seq * 163)::text, 9, '0') as meeting_link
  from reviewer_app_map m
  where m.seq between 28 and 30
),
upcoming_path_final as (
  select
    m.application_id,
    m.seq,
    m.company,
    m.role_title,
    m.team_name,
    m.stack_primary,
    m.stack_secondary,
    m.location_name,
    m.mail_domain,
    m.requisition_id,
    m.gmail_thread_id,
    'reviewer-msg-' || lpad(m.seq::text, 3, '0') || '-upcoming-final' as gmail_message_id,
    '<reviewer-' || lpad(m.seq::text, 3, '0') || '-upcoming-final@mock.basafy.app>' as internet_message_id,
    'interview_invite'::text as event_type,
    'Interview'::text as parsed_status,
    format('%s Recruiting <recruiting@%s>', m.company, m.mail_domain) as from_address,
    format('Next interview with %s', m.company) as subject,
    format(
      'We''ve scheduled your next interview with %s for %s.',
      m.company,
      to_char(
        timezone(
          'America/New_York',
          now() + ((m.seq - 27) * interval '2 days') + interval '14 hours'
        ),
        'Mon DD'
      )
    ) as snippet,
    format(
$body$
Hi Tanya,

The team would like to continue your process for the %1$s role with a follow-up interview next week.

You'll meet with two engineers from our %2$s organization to go deeper on system design, debugging habits, and how you balance delivery speed with reliability when working in %3$s-heavy environments.

Confirmed time: %4$s
Meeting link: %5$s

Looking forward to the conversation.

Best,
%1$s Recruiting
$body$,
      m.company,
      m.team_name,
      m.stack_primary,
      to_char(
        timezone(
          'America/New_York',
          now() + ((m.seq - 27) * interval '2 days') + interval '14 hours'
        ),
        'Dy, Mon DD "at" HH12:MI AM'
      ) || ' ET',
      'https://meet.google.com/' || substr(md5(m.company || m.role_title || 'upcoming'), 1, 3) || '-' || substr(md5(m.company || m.role_title || 'upcoming'), 4, 4) || '-' || substr(md5(m.company || m.role_title || 'upcoming'), 8, 3)
    ) as body_text,
    now() - ((31 - m.seq) * interval '6 hours') as received_at,
    'interview'::text as calendar_event_type,
    format('Interview: %s - %s', m.company, m.role_title) as event_title,
    now() + ((m.seq - 27) * interval '2 days') + interval '14 hours' as event_start_at,
    now() + ((m.seq - 27) * interval '2 days') + interval '15 hours' as event_end_at,
    'Google Meet'::text as provider,
    'https://meet.google.com/' || substr(md5(m.company || m.role_title || 'upcoming'), 1, 3) || '-' || substr(md5(m.company || m.role_title || 'upcoming'), 4, 4) || '-' || substr(md5(m.company || m.role_title || 'upcoming'), 8, 3) as meeting_link
  from reviewer_app_map m
  where m.seq between 28 and 30
)
select * from base_messages
union all
select * from assessment_only
union all
select * from screen_then_reject_interview
union all
select * from screen_then_reject_rejection
union all
select * from assessment_then_interview_assessment
union all
select * from assessment_then_interview_interview
union all
select * from two_interviews_first
union all
select * from two_interviews_second
union all
select * from interview_then_reject_interview
union all
select * from interview_then_reject_rejection
union all
select * from offer_path_assessment
union all
select * from offer_path_interview
union all
select * from offer_path_offer
union all
select * from upcoming_path_screen
union all
select * from upcoming_path_final;

insert into public.mock_gmail_messages (
  user_id,
  gmail_message_id,
  gmail_thread_id,
  internet_message_id,
  subject,
  from_address,
  snippet,
  body_text,
  received_at,
  created_at
)
select
  ctx.user_id,
  m.gmail_message_id,
  m.gmail_thread_id,
  m.internet_message_id,
  m.subject,
  m.from_address,
  m.snippet,
  m.body_text,
  m.received_at,
  m.received_at
from reviewer_message_seed m
cross join reviewer_ctx ctx
order by m.received_at asc;

insert into public.job_email_events (
  user_id,
  gmail_message_id,
  gmail_thread_id,
  raw_from,
  received_at,
  event_type,
  parsed_company,
  parsed_role,
  parsed_status,
  confidence,
  application_id,
  canonical_key,
  portal_domain,
  requisition_id,
  job_id,
  external_application_id,
  internet_message_id,
  created_at,
  updated_at
)
select
  ctx.user_id,
  m.gmail_message_id,
  m.gmail_thread_id,
  m.from_address,
  m.received_at,
  m.event_type,
  m.company,
  m.role_title,
  m.parsed_status,
  case
    when m.event_type = 'application_received' then 0.92
    when m.event_type in ('assessment', 'interview_invite') then 0.98
    when m.event_type = 'offer' then 0.99
    else 0.96
  end,
  m.application_id,
  lower(regexp_replace(m.company, '[^a-zA-Z0-9]+', '', 'g')) || '__' || regexp_replace(lower(m.role_title), '[^a-z0-9]+', '_', 'g'),
  m.mail_domain,
  m.requisition_id,
  'JOB-' || lpad(m.seq::text, 4, '0'),
  'reviewer-demo-' || lpad(m.seq::text, 3, '0'),
  trim(both '<>' from m.internet_message_id),
  m.received_at,
  greatest(m.received_at, now() - interval '1 minute')
from reviewer_message_seed m
cross join reviewer_ctx ctx
order by m.received_at asc;

insert into public.events (
  user_id,
  application_id,
  event_type,
  title,
  provider,
  meeting_link,
  start_at,
  end_at,
  location,
  source_type,
  created_at
)
select
  ctx.user_id,
  m.application_id,
  m.calendar_event_type,
  m.event_title,
  m.provider,
  m.meeting_link,
  m.event_start_at,
  m.event_end_at,
  case
    when m.calendar_event_type = 'assessment' then 'Remote'
    else 'Video'
  end,
  'gmail',
  m.received_at
from reviewer_message_seed m
cross join reviewer_ctx ctx
where m.calendar_event_type is not null
order by m.event_start_at asc;

insert into public.notifications (
  user_id,
  type,
  subtype,
  title,
  body,
  channel,
  entity_type,
  entity_id,
  metadata,
  is_read,
  created_at,
  scheduled_for
)
select
  ctx.user_id,
  'update',
  m.event_type,
  case
    when m.event_type = 'interview_invite' then format('Interview update from %s', m.company)
    when m.event_type = 'assessment' then format('Assessment from %s', m.company)
    when m.event_type = 'offer' then format('Offer from %s', m.company)
    else format('Update from %s', m.company)
  end,
  case
    when m.event_type = 'interview_invite' then format('Interview activity for %s - %s.', m.company, m.role_title)
    when m.event_type = 'assessment' then format('Assessment request for %s - %s.', m.company, m.role_title)
    when m.event_type = 'offer' then format('Offer received for %s - %s.', m.company, m.role_title)
    else format('Your %s application has a new status update.', m.company)
  end,
  'both',
  'application',
  m.application_id,
  jsonb_build_object(
    'company', m.company,
    'role', m.role_title,
    'event_type', m.event_type,
    'received_at', m.received_at
  ),
  false,
  m.received_at,
  null
from reviewer_message_seed m
cross join reviewer_ctx ctx
where m.event_type in ('assessment', 'interview_invite', 'rejection', 'offer')
  and m.received_at >= now() - interval '21 days'
order by m.received_at asc;

update public.applications a
set
  updated_at = latest.latest_received_at,
  last_synced_at = now(),
  email_snippet = latest.latest_snippet
from (
  select
    application_id,
    max(received_at) as latest_received_at,
    (
      array_agg(snippet order by received_at desc)
    )[1] as latest_snippet
  from reviewer_message_seed
  group by application_id
) latest
where a.id = latest.application_id;

insert into public.gmail_sync_state (
  user_id,
  connection_id,
  initial_import_status,
  initial_import_progress,
  last_phase1_result_count,
  last_deep_result_count,
  last_sync_summary
)
select
  ctx.user_id,
  gc.id,
  'deep_done',
  100,
  100,
  158,
  'Seeded 100 reviewer demo applications, 58 follow-up emails, and interview/assessment events.'
from reviewer_ctx ctx
join public.gmail_connections gc
  on gc.user_id = ctx.user_id
 and gc.provider = 'google'
on conflict (user_id) do update
set
  connection_id = excluded.connection_id,
  initial_import_status = excluded.initial_import_status,
  initial_import_progress = excluded.initial_import_progress,
  last_phase1_result_count = excluded.last_phase1_result_count,
  last_deep_result_count = excluded.last_deep_result_count,
  last_sync_summary = excluded.last_sync_summary,
  updated_at = now();

select
  (select count(*) from public.applications a join reviewer_ctx ctx on a.user_id = ctx.user_id) as applications_seeded,
  (select count(*) from public.mock_gmail_messages m join reviewer_ctx ctx on m.user_id = ctx.user_id) as mock_messages_seeded,
  (select count(*) from public.job_email_events je join reviewer_ctx ctx on je.user_id = ctx.user_id) as job_email_events_seeded,
  (select count(*) from public.events e join reviewer_ctx ctx on e.user_id = ctx.user_id) as calendar_events_seeded,
  (select count(*) from public.notifications n join reviewer_ctx ctx on n.user_id = ctx.user_id) as notifications_seeded;

commit;
