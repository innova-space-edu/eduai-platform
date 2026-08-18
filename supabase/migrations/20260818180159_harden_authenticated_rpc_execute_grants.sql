-- Prevent cross-user age probing while keeping an authenticated self-check and service-role administration.
create or replace function public.is_adult_profile(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.role()) = 'service_role' then exists (
      select 1 from public.profiles
      where id = p_user_id
        and birth_date is not null
        and birth_date <= (current_date - interval '18 years')::date
    )
    when (select auth.uid()) is null or p_user_id is distinct from (select auth.uid()) then false
    else exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and birth_date is not null
        and birth_date <= (current_date - interval '18 years')::date
    )
  end;
$$;

-- Internal helpers and global maintenance are server-only.
revoke execute on function public.generate_exam_code() from public, anon, authenticated;
grant execute on function public.generate_exam_code() to service_role;
revoke execute on function public.generate_user_code() from public, anon, authenticated;
grant execute on function public.generate_user_code() to service_role;
revoke execute on function public.cleanup_audio_voice_security_sessions() from public, anon, authenticated;
grant execute on function public.cleanup_audio_voice_security_sessions() to service_role;

-- User-facing RPCs require an authenticated session. Public QR/share-token RPCs remain intentionally unchanged.
revoke execute on function public.accept_voice_cloning_terms(text, date, text) from public, anon;
grant execute on function public.accept_voice_cloning_terms(text, date, text) to authenticated, service_role;

revoke execute on function public.creator_hub_can_access_project(uuid, text) from public, anon;
grant execute on function public.creator_hub_can_access_project(uuid, text) to authenticated, service_role;

revoke execute on function public.creator_hub_invite_collaborator(uuid, text, text) from public, anon;
grant execute on function public.creator_hub_invite_collaborator(uuid, text, text) to authenticated, service_role;

revoke execute on function public.has_model_lab_admin_access() from public, anon;
grant execute on function public.has_model_lab_admin_access() to authenticated, service_role;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke execute on function public.is_adult_profile(uuid) from public, anon;
grant execute on function public.is_adult_profile(uuid) to authenticated, service_role;

revoke execute on function public.is_model_lab_admin() from public, anon;
grant execute on function public.is_model_lab_admin() to authenticated, service_role;

revoke execute on function public.mark_audio_voice_processing(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.mark_audio_voice_processing(uuid, text, text, text, text, text) to authenticated, service_role;

revoke execute on function public.open_voice_security_session() from public, anon;
grant execute on function public.open_voice_security_session() to authenticated, service_role;

revoke execute on function public.revoke_voice_security_session(text) from public, anon;
grant execute on function public.revoke_voice_security_session(text) to authenticated, service_role;

revoke execute on function public.set_default_audio_voice(uuid) from public, anon;
grant execute on function public.set_default_audio_voice(uuid) to authenticated, service_role;

revoke execute on function public.touch_voice_security_session(text) from public, anon;
grant execute on function public.touch_voice_security_session(text) to authenticated, service_role;

revoke execute on function public.validate_voice_security_session(text) from public, anon;
grant execute on function public.validate_voice_security_session(text) to authenticated, service_role;
