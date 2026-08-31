-- EDUAI Media Studio v2
-- Proyectos audiovisuales, activos reutilizables, exportaciones y almacenamiento privado.

create table if not exists public.media_projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Proyecto sin título',
  aspect_ratio text not null default '16:9' check (aspect_ratio in ('16:9','9:16','1:1','4:5')),
  width integer not null default 1920 check (width > 0),
  height integer not null default 1080 check (height > 0),
  fps integer not null default 30 check (fps between 1 and 120),
  duration_seconds numeric not null default 0 check (duration_seconds >= 0),
  timeline_json jsonb not null default '{}'::jsonb,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_projects_user_updated_idx on public.media_projects(user_id, updated_at desc);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text references public.media_projects(id) on delete set null,
  asset_type text not null check (asset_type in ('video','audio','image','music','sfx','text')),
  name text not null,
  source text not null default 'upload',
  provider text,
  storage_path text,
  remote_url text,
  thumbnail_url text,
  mime_type text,
  duration_seconds numeric,
  width integer,
  height integer,
  license text,
  attribution text,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists media_assets_user_created_idx on public.media_assets(user_id, created_at desc);
create index if not exists media_assets_project_idx on public.media_assets(project_id);

create table if not exists public.media_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null references public.media_projects(id) on delete cascade,
  format text not null,
  resolution text,
  status text not null default 'queued' check (status in ('queued','rendering','done','error','cancelled')),
  storage_path text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.media_projects enable row level security;
alter table public.media_assets enable row level security;
alter table public.media_exports enable row level security;

drop policy if exists "media_projects_select_own" on public.media_projects;
drop policy if exists "media_projects_insert_own" on public.media_projects;
drop policy if exists "media_projects_update_own" on public.media_projects;
drop policy if exists "media_projects_delete_own" on public.media_projects;
create policy "media_projects_select_own" on public.media_projects for select using (auth.uid() = user_id);
create policy "media_projects_insert_own" on public.media_projects for insert with check (auth.uid() = user_id);
create policy "media_projects_update_own" on public.media_projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "media_projects_delete_own" on public.media_projects for delete using (auth.uid() = user_id);

drop policy if exists "media_assets_select_own" on public.media_assets;
drop policy if exists "media_assets_insert_own" on public.media_assets;
drop policy if exists "media_assets_update_own" on public.media_assets;
drop policy if exists "media_assets_delete_own" on public.media_assets;
create policy "media_assets_select_own" on public.media_assets for select using (auth.uid() = user_id);
create policy "media_assets_insert_own" on public.media_assets for insert with check (auth.uid() = user_id);
create policy "media_assets_update_own" on public.media_assets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "media_assets_delete_own" on public.media_assets for delete using (auth.uid() = user_id);

drop policy if exists "media_exports_select_own" on public.media_exports;
drop policy if exists "media_exports_insert_own" on public.media_exports;
drop policy if exists "media_exports_update_own" on public.media_exports;
drop policy if exists "media_exports_delete_own" on public.media_exports;
create policy "media_exports_select_own" on public.media_exports for select using (auth.uid() = user_id);
create policy "media_exports_insert_own" on public.media_exports for insert with check (auth.uid() = user_id);
create policy "media_exports_update_own" on public.media_exports for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "media_exports_delete_own" on public.media_exports for delete using (auth.uid() = user_id);

-- Bucket privado. Cada usuario sólo puede operar dentro de /<user_id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media-studio',
  'media-studio',
  false,
  524288000,
  array['video/mp4','video/webm','video/quicktime','audio/mpeg','audio/wav','audio/mp4','audio/ogg','audio/webm','image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media_studio_storage_select_own" on storage.objects;
drop policy if exists "media_studio_storage_insert_own" on storage.objects;
drop policy if exists "media_studio_storage_update_own" on storage.objects;
drop policy if exists "media_studio_storage_delete_own" on storage.objects;
create policy "media_studio_storage_select_own" on storage.objects for select
  using (bucket_id = 'media-studio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_studio_storage_insert_own" on storage.objects for insert
  with check (bucket_id = 'media-studio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_studio_storage_update_own" on storage.objects for update
  using (bucket_id = 'media-studio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'media-studio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_studio_storage_delete_own" on storage.objects for delete
  using (bucket_id = 'media-studio' and (storage.foldername(name))[1] = auth.uid()::text);

comment on table public.media_projects is 'EDUAI Media Studio: project/timeline state.';
comment on table public.media_assets is 'Reusable user media and external licensed assets used by Media Studio.';
comment on table public.media_exports is 'Server-render queue and completed Media Studio exports.';
