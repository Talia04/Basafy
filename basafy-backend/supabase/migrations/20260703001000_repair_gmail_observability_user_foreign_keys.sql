do $$
declare
  target_table text;
  constraint_name text;
begin
  foreach target_table in array array[
    'gmail_sync_runs',
    'gmail_retrieval_evidence',
    'email_parse_attempts',
    'gmail_match_decisions',
    'company_entities'
  ] loop
    constraint_name := target_table || '_user_id_fkey';
    execute format(
      'alter table public.%I drop constraint if exists %I',
      target_table,
      constraint_name
    );
    execute format(
      'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade not valid',
      target_table,
      constraint_name
    );
    execute format(
      'alter table public.%I validate constraint %I',
      target_table,
      constraint_name
    );
  end loop;
end $$;

comment on constraint gmail_retrieval_evidence_user_id_fkey
  on public.gmail_retrieval_evidence is
  'Evidence ownership uses the authenticated Supabase user ID.';

comment on constraint company_entities_user_id_fkey
  on public.company_entities is
  'Company normalization ownership uses the authenticated Supabase user ID.';
