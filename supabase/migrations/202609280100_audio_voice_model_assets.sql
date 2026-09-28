-- Audio Lab: biblioteca vocal agnóstica + trabajos privados de render.
alter table public.audio_voice_profiles
  add column if not exists canonical_audio_path text,
  add column if not exists canonical_audio_mime text,
  add column if not exists canonical_sample_rate integer,
  add column if not exists canonical_duration_seconds numeric(10,3),
  add column if not exists source_sha256 text,
  add column if not exists processing_progress integer not null default 0,
  add column if not exists processing_stage text;

create table if not exists public.audio_voice_model_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_profile_id uuid not null references public.audio_voice_profiles(id) on delete cascade,
  engine text not null,
  engine_version text not null default 'default',
  asset_type text not null,
  storage_bucket text not null default 'voice-model-assets',
  storage_path text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (voice_profile_id, engine, engine_version, asset_type)
);

alter table public.audio_voice_model_assets enable row level security;

drop policy if exists audio_voice_model_assets_select_own on public.audio_voice_model_assets;
create policy audio_voice_model_assets_select_own on public.audio_voice_model_assets
for select to authenticated using (auth.uid() = user_id);

drop policy if exists audio_voice_model_assets_insert_own on public.audio_voice_model_assets;
create policy audio_voice_model_assets_insert_own on public.audio_voice_model_assets
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists audio_voice_model_assets_update_own on public.audio_voice_model_assets;
create policy audio_voice_model_assets_update_own on public.audio_voice_model_assets
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists audio_voice_model_assets_delete_own on public.audio_voice_model_assets;
create policy audio_voice_model_assets_delete_own on public.audio_voice_model_assets
for delete to authenticated using (auth.uid() = user_id);

create index if not exists audio_voice_model_assets_profile_idx
  on public.audio_voice_model_assets(voice_profile_id, engine, engine_version);

create table if not exists public.audio_voice_render_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_profile_id uuid not null references public.audio_voice_profiles(id) on delete cascade,
  text text not null default '',
  status text not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  stage text,
  provider text not null default 'google-cloud-run',
  engine text not null default 'gemini-3.8-flash-tts',
  audio_bucket text not null default 'generated-voice-audio',
  audio_path text,
  metadata jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint audio_voice_render_jobs_status_check
    check (status in ('queued','starting','loading_model','generating','uploading','completed','failed'))
);

alter table public.audio_voice_render_jobs enable row level security;

drop policy if exists audio_voice_render_jobs_select_own on public.audio_voice_render_jobs;
create policy audio_voice_render_jobs_select_own on public.audio_voice_render_jobs
for select to authenticated using (auth.uid() = user_id);

drop policy if exists audio_voice_render_jobs_insert_own on public.audio_voice_render_jobs;
create policy audio_voice_render_jobs_insert_own on public.audio_voice_render_jobs
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists audio_voice_render_jobs_update_own on public.audio_voice_render_jobs;
create policy audio_voice_render_jobs_update_own on public.audio_voice_render_jobs
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists audio_voice_render_jobs_delete_own on public.audio_voice_render_jobs;
create policy audio_voice_render_jobs_delete_own on public.audio_voice_render_jobs
for delete to authenticated using (auth.uid() = user_id);

create index if not exists audio_voice_render_jobs_user_created_idx
  on public.audio_voice_render_jobs(user_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('voice-model-assets','voice-model-assets',false,52428800,array['application/octet-stream','application/json','audio/wav','audio/flac']::text[]),
  ('generated-voice-audio','generated-voice-audio',false,52428800,array['audio/wav','audio/x-wav','audio/mpeg','audio/flac','audio/ogg']::text[])
on conflict (id) do update
set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists voice_model_assets_select_own on storage.objects;
create policy voice_model_assets_select_own on storage.objects for select to authenticated
using (bucket_id='voice-model-assets' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists voice_model_assets_insert_own on storage.objects;
create policy voice_model_assets_insert_own on storage.objects for insert to authenticated
with check (bucket_id='voice-model-assets' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists voice_model_assets_update_own on storage.objects;
create policy voice_model_assets_update_own on storage.objects for update to authenticated
using (bucket_id='voice-model-assets' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='voice-model-assets' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists voice_model_assets_delete_own on storage.objects;
create policy voice_model_assets_delete_own on storage.objects for delete to authenticated
using (bucket_id='voice-model-assets' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists generated_voice_audio_select_own on storage.objects;
create policy generated_voice_audio_select_own on storage.objects for select to authenticated
using (bucket_id='generated-voice-audio' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists generated_voice_audio_insert_own on storage.objects;
create policy generated_voice_audio_insert_own on storage.objects for insert to authenticated
with check (bucket_id='generated-voice-audio' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists generated_voice_audio_update_own on storage.objects;
create policy generated_voice_audio_update_own on storage.objects for update to authenticated
using (bucket_id='generated-voice-audio' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='generated-voice-audio' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists generated_voice_audio_delete_own on storage.objects;
create policy generated_voice_audio_delete_own on storage.objects for delete to authenticated
using (bucket_id='generated-voice-audio' and (storage.foldername(name))[1]=auth.uid()::text);
