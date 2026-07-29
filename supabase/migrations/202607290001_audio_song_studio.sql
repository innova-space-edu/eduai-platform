-- Audio Lab · Estudio de canciones IA

create table if not exists public.audio_song_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Canción sin título',
  prompt text not null default '',
  caption text not null default '',
  lyrics text not null default '',
  genre text not null default '',
  mood text not null default '',
  vocal_language text not null default 'es',
  duration_seconds integer not null default 45 check (duration_seconds between 10 and 180),
  bpm integer check (bpm is null or bpm between 30 and 300),
  key_scale text not null default '',
  time_signature text not null default '4',
  instrumental boolean not null default false,
  vocal_style text not null default 'automatic',
  voice_profile_id uuid references public.audio_voice_profiles(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','composing','generating','uploading','completed','failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  provider text not null default 'ace-step-1.5',
  provider_job_id text,
  audio_path text,
  metadata jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.audio_voice_profiles
  add column if not exists singing_enabled boolean not null default false,
  add column if not exists singing_consent_at timestamptz,
  add column if not exists singing_engine text;

create index if not exists audio_song_jobs_user_updated_idx
  on public.audio_song_jobs(user_id, updated_at desc);

create index if not exists audio_song_jobs_status_idx
  on public.audio_song_jobs(status, created_at);

alter table public.audio_song_jobs enable row level security;

drop policy if exists "audio_song_jobs_select_own" on public.audio_song_jobs;
create policy "audio_song_jobs_select_own"
  on public.audio_song_jobs for select
  using (auth.uid() = user_id);

drop policy if exists "audio_song_jobs_insert_own" on public.audio_song_jobs;
create policy "audio_song_jobs_insert_own"
  on public.audio_song_jobs for insert
  with check (auth.uid() = user_id);

drop policy if exists "audio_song_jobs_update_own" on public.audio_song_jobs;
create policy "audio_song_jobs_update_own"
  on public.audio_song_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "audio_song_jobs_delete_own" on public.audio_song_jobs;
create policy "audio_song_jobs_delete_own"
  on public.audio_song_jobs for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-songs',
  'generated-songs',
  false,
  52428800,
  array['audio/wav','audio/x-wav','audio/mpeg','audio/flac','audio/ogg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "generated_songs_select_own" on storage.objects;
create policy "generated_songs_select_own"
  on storage.objects for select
  using (
    bucket_id = 'generated-songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "generated_songs_insert_own" on storage.objects;
create policy "generated_songs_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'generated-songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "generated_songs_update_own" on storage.objects;
create policy "generated_songs_update_own"
  on storage.objects for update
  using (
    bucket_id = 'generated-songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'generated-songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "generated_songs_delete_own" on storage.objects;
create policy "generated_songs_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'generated-songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
