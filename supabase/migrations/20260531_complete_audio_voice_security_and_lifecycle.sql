alter table public.audio_voice_profiles
  add column if not exists subject_name text,
  add column if not exists authorization_date date,
  add column if not exists authorization_type text,
  add column if not exists authorization_document_path text,
  add column if not exists processing_error text,
  add column if not exists processed_at timestamptz,
  add column if not exists embedding_path text,
  add column if not exists last_used_at timestamptz;

alter table public.voice_security_sessions
  add column if not exists auth_session_id text;

create index if not exists audio_voice_profiles_user_active_idx
  on public.audio_voice_profiles(user_id, created_at desc)
  where deleted_at is null;

create index if not exists audio_voice_events_user_created_idx
  on public.audio_voice_events(user_id, created_at desc);

create index if not exists voice_security_sessions_user_scope_idx
  on public.voice_security_sessions(user_id, scope, revoked_at, expires_at desc);

alter table public.audio_voice_profiles enable row level security;
alter table public.audio_voice_events enable row level security;
alter table public.voice_security_sessions enable row level security;
alter table public.audio_transcriptions enable row level security;

create or replace function public.cleanup_audio_voice_security_sessions()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  deleted_count integer;
begin
  delete from public.voice_security_sessions
  where revoked_at is not null
     or expires_at < now() - interval '7 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

create or replace function public.mark_audio_voice_processing(
  p_profile_id uuid,
  p_status text,
  p_model_provider text default null,
  p_provider_voice_id text default null,
  p_embedding_path text default null,
  p_processing_error text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.audio_voice_profiles
  set status = p_status,
      model_provider = coalesce(p_model_provider, model_provider),
      provider_voice_id = coalesce(p_provider_voice_id, provider_voice_id),
      embedding_path = coalesce(p_embedding_path, embedding_path),
      processing_error = p_processing_error,
      processed_at = case when p_status = 'ready' then now() else processed_at end,
      internal_use_enabled = case when p_status = 'ready' then true else internal_use_enabled end,
      updated_at = now()
  where id = p_profile_id
    and user_id = auth.uid()
    and deleted_at is null;
  return found;
end;
$function$;
