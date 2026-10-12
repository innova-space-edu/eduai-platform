-- E13 / RAT-EDUAI-2026-001: clonación de voz SOLO para administración.
-- No altera la transcripción ordinaria ni los servicios de audio genéricos.
-- Requiere una cuenta autenticada, presente en admin_emails y MFA AAL2.
create or replace function public.is_voice_cloning_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.role()) = 'authenticated'
    and (select auth.uid()) is not null
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (
      select 1 from public.admin_emails ae
      where lower(ae.email) = lower((select auth.jwt() ->> 'email'))
    ), false
  );
$$;
revoke all on function public.is_voice_cloning_admin() from public, anon;
grant execute on function public.is_voice_cloning_admin() to authenticated, service_role;

-- Las políticas restrictivas se suman a las políticas existentes del propietario.
-- El acceso privilegiado service_role queda fuera del alcance de RLS.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'audio_voice_profiles', 'audio_voice_events', 'audio_voice_model_assets',
    'audio_voice_render_jobs', 'voice_security_sessions'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists voice_admin_only on public.%I', tbl);
    execute format(
      'create policy voice_admin_only on public.%I as restrictive for all to authenticated '
      || 'using (public.is_voice_cloning_admin()) with check (public.is_voice_cloning_admin())',
      tbl
    );
  end loop;
end $$;

drop policy if exists voice_admin_only_buckets on storage.objects;
create policy voice_admin_only_buckets on storage.objects
as restrictive for all to authenticated
using (
  bucket_id not in ('voice-clones', 'voice-model-assets', 'generated-voice-audio')
  or public.is_voice_cloning_admin()
)
with check (
  bucket_id not in ('voice-clones', 'voice-model-assets', 'generated-voice-audio')
  or public.is_voice_cloning_admin()
);

-- Proteger las RPC SECURITY DEFINER que podrían modificar perfiles de voz sin RLS.
revoke execute on function public.mark_audio_voice_processing(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.mark_audio_voice_processing(uuid, text, text, text, text, text)
  to service_role;
revoke execute on function public.set_default_audio_voice(uuid) from public, anon, authenticated;
grant execute on function public.set_default_audio_voice(uuid) to service_role;
