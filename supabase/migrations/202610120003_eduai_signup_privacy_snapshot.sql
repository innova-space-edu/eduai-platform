-- Capture the user's affirmative declarations at initial signup, even if
-- Supabase requires email confirmation and returns no immediate session.
-- The origin is explicitly logged as a signup declaration, not identity verification.
create or replace function public.eduai_capture_initial_signup_privacy()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data,'{}'::jsonb);
  v_choices jsonb := '{}'::jsonb;
  v_birth date;
  v_minor boolean := true;
  v_snapshot jsonb;
begin
  if coalesce(v_meta->>'terms_version','') <> '2026-10-11-v1'
     or v_meta->>'privacy_version' <> '2026-10-11-v1'
     or v_meta->>'terms_accepted' <> 'true'
     or v_meta->>'data_warning_acknowledged' <> 'true'
     or v_meta->>'privacy_information_acknowledged' <> 'true'
  then return new; end if;

  select declared_birth_date into v_birth
    from public.family_age_status where user_id = new.id;
  if v_birth is not null then
    v_minor := v_birth > (current_date - interval '18 years')::date;
  end if;
  v_choices := v_meta->'optional_privacy_choices_requested';
  if pg_catalog.jsonb_typeof(v_choices) is distinct from 'object' then
    v_choices := '{}'::jsonb;
  end if;
  v_snapshot := pg_catalog.jsonb_build_object(
    'ai_generation', case when not v_minor and v_choices->>'ai_generation'='true' then true else false end,
    'ai_documents', case when not v_minor and v_choices->>'ai_documents'='true' then true else false end,
    'ai_voice', case when not v_minor and v_choices->>'ai_voice'='true' then true else false end,
    'optional_analytics', case when not v_minor and v_choices->>'optional_analytics'='true' then true else false end
  );

  insert into public.eduai_privacy_choices (
    user_id,policy_version,terms_acknowledged_at,data_warning_acknowledged_at,
    ai_generation,ai_documents,ai_voice,optional_analytics,updated_at
  ) values (
    new.id, '2026-10-11-v1', now(),now(),
    (v_snapshot->>'ai_generation')::boolean, (v_snapshot->>'ai_documents')::boolean,
    (v_snapshot->>'ai_voice')::boolean, (v_snapshot->>'optional_analytics')::boolean,now()
  ) on conflict (user_id) do nothing;

  insert into public.eduai_privacy_choice_events (
    user_id,policy_version,choices,event_type,recorded_at
  ) values (
    new.id,'2026-10-11-v1',v_snapshot,'signup_declarations',now()
  );
  return new;
end; $$;

revoke all on function public.eduai_capture_initial_signup_privacy() from public,anon,authenticated;
drop trigger if exists zz_eduai_initial_privacy_on_signup on auth.users;
-- Runs after family_capture_age_insert (trigger names are alphabetic),
-- preserving default-deny permissions for minors.
create trigger zz_eduai_initial_privacy_on_signup after insert on auth.users
for each row execute function public.eduai_capture_initial_signup_privacy();
