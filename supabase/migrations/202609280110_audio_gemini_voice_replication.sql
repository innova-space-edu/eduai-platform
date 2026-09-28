-- Gemini Voice Replication requiere muestra de referencia + grabación separada de consentimiento.
alter table public.audio_voice_profiles
  add column if not exists consent_audio_path text,
  add column if not exists consent_audio_mime text,
  add column if not exists consent_language text not null default 'es-US',
  add column if not exists provider_voice_expires_at timestamptz;

create index if not exists audio_voice_profiles_provider_voice_idx
  on public.audio_voice_profiles(provider_voice_id)
  where provider_voice_id is not null and deleted_at is null;
