-- EDUAI Media Studio v3
-- Cola para proxies, limpieza/normalización de audio y separación de stems.

create table if not exists public.media_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text references public.media_projects(id) on delete cascade,
  asset_id uuid references public.media_assets(id) on delete set null,
  operation text not null check (operation in ('proxy','denoise','normalize','stems','extract_audio')),
  status text not null default 'queued' check (status in ('queued','processing','done','error','cancelled')),
  progress numeric not null default 0 check (progress >= 0 and progress <= 1),
  input_storage_path text not null,
  output_storage_paths jsonb not null default '[]'::jsonb,
  parameters jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists media_processing_jobs_user_created_idx
  on public.media_processing_jobs(user_id, created_at desc);
create index if not exists media_processing_jobs_status_idx
  on public.media_processing_jobs(status, created_at);
create index if not exists media_processing_jobs_asset_idx
  on public.media_processing_jobs(asset_id);

alter table public.media_processing_jobs enable row level security;

drop policy if exists "media_processing_select_own" on public.media_processing_jobs;
drop policy if exists "media_processing_insert_own" on public.media_processing_jobs;
drop policy if exists "media_processing_update_own" on public.media_processing_jobs;
drop policy if exists "media_processing_delete_own" on public.media_processing_jobs;

create policy "media_processing_select_own" on public.media_processing_jobs
  for select using (auth.uid() = user_id);
create policy "media_processing_insert_own" on public.media_processing_jobs
  for insert with check (auth.uid() = user_id);
create policy "media_processing_update_own" on public.media_processing_jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "media_processing_delete_own" on public.media_processing_jobs
  for delete using (auth.uid() = user_id);

comment on table public.media_processing_jobs is
  'EDUAI Media Studio queue for proxy generation, audio cleanup/normalization and Demucs stems.';
