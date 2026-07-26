begin;

create table if not exists public.creator_hub_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('generate-material', 'educational-document', 'source-studio', 'transform', 'quality-review', 'comic-storyboard')),
  title text not null default 'Trabajo de Creator Hub',
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  stage text,
  request jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  project_id uuid references public.creator_hub_projects(id) on delete set null,
  attempts integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_hub_jobs_user_created_idx
  on public.creator_hub_jobs(user_id, created_at desc);
create index if not exists creator_hub_jobs_status_idx
  on public.creator_hub_jobs(status, created_at);

alter table public.creator_hub_jobs enable row level security;

create policy "creator jobs visible to owner"
  on public.creator_hub_jobs
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "creator jobs created by owner"
  on public.creator_hub_jobs
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "creator jobs updated by owner"
  on public.creator_hub_jobs
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "creator jobs deleted by owner"
  on public.creator_hub_jobs
  for delete
  to authenticated
  using (user_id = auth.uid());

commit;
