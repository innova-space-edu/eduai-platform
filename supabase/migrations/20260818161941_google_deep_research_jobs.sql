create table if not exists public.eduai_deep_research_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  notebook_id uuid null references public.notebooks(id) on delete set null,
  generation_request_id uuid null references public.ai_generation_requests(id) on delete set null,
  interaction_id text not null unique,
  agent text not null default 'deep-research-preview-04-2026',
  query text not null,
  fingerprint text not null,
  status text not null default 'running' check (status in ('queued','running','finalizing','completed','failed','cancelled')),
  result_text text null,
  citations jsonb not null default '[]'::jsonb,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists eduai_deep_research_jobs_owner_created_idx
  on public.eduai_deep_research_jobs(owner_id, created_at desc);
create index if not exists eduai_deep_research_jobs_owner_status_idx
  on public.eduai_deep_research_jobs(owner_id, status, updated_at desc);
create index if not exists eduai_deep_research_jobs_fingerprint_idx
  on public.eduai_deep_research_jobs(owner_id, fingerprint, created_at desc);

alter table public.eduai_deep_research_jobs enable row level security;

revoke all on table public.eduai_deep_research_jobs from anon, authenticated;
grant select, delete on table public.eduai_deep_research_jobs to authenticated;

create policy eduai_deep_research_jobs_select_own
  on public.eduai_deep_research_jobs
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy eduai_deep_research_jobs_delete_own
  on public.eduai_deep_research_jobs
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

comment on table public.eduai_deep_research_jobs is
  'Trabajos background de Gemini Deep Research. Escritura solo server/service-role; lectura/borrado restringidos al propietario.';
