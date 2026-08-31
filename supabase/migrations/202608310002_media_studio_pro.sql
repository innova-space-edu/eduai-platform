-- EDUAI Media Studio Pro
-- Procesamiento pesado desacoplado: proxy, denoise, normalización y separación de stems.

alter table public.media_assets
  add column if not exists proxy_storage_path text,
  add column if not exists processed_at timestamptz;

create table if not exists public.media_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text references public.media_projects(id) on delete cascade,
  asset_id uuid references public.media_assets(id) on delete cascade,
  job_type text not null check (job_type in ('proxy','denoise','normalize','stems','transcribe-align')),
  status text not null default 'queued' check (status in ('queued','processing','done','error','cancelled')),
  input_storage_path text,
  output_storage_path text,
  progress numeric not null default 0 check (progress >= 0 and progress <= 1),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  result_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists media_processing_jobs_user_status_idx on public.media_processing_jobs(user_id, status, created_at desc);
create index if not exists media_processing_jobs_asset_idx on public.media_processing_jobs(asset_id, created_at desc);

alter table public.media_processing_jobs enable row level security;

drop policy if exists "media_processing_jobs_select_own" on public.media_processing_jobs;
drop policy if exists "media_processing_jobs_insert_own" on public.media_processing_jobs;
drop policy if exists "media_processing_jobs_update_own" on public.media_processing_jobs;
drop policy if exists "media_processing_jobs_delete_own" on public.media_processing_jobs;
create policy "media_processing_jobs_select_own" on public.media_processing_jobs for select using (auth.uid() = user_id);
create policy "media_processing_jobs_insert_own" on public.media_processing_jobs for insert with check (auth.uid() = user_id);
create policy "media_processing_jobs_update_own" on public.media_processing_jobs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "media_processing_jobs_delete_own" on public.media_processing_jobs for delete using (auth.uid() = user_id);

comment on table public.media_processing_jobs is 'Media Studio Pro background processing queue: proxy, denoise, normalize, stems and alignment.';
