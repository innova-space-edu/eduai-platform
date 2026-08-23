create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.model_lab_admin_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  require_aal2 boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on private.model_lab_admin_access from public, anon, authenticated;

create or replace function public.has_model_lab_admin_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.model_lab_admin_access a
    where a.user_id = (select auth.uid())
      and a.enabled = true
  );
$$;

create or replace function public.is_model_lab_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.model_lab_admin_access a
    where a.user_id = (select auth.uid())
      and a.enabled = true
      and (
        a.require_aal2 = false
        or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      )
  );
$$;

revoke all on function public.has_model_lab_admin_access() from public;
revoke all on function public.is_model_lab_admin() from public;
grant execute on function public.has_model_lab_admin_access() to authenticated;
grant execute on function public.is_model_lab_admin() to authenticated;

create table if not exists public.model_lab_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  provider text,
  model_id text,
  decision text not null check (decision in ('allowed', 'blocked', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.model_lab_audit_logs enable row level security;

drop policy if exists "model_lab_admin_reads_audit" on public.model_lab_audit_logs;
create policy "model_lab_admin_reads_audit"
on public.model_lab_audit_logs
for select
to authenticated
using (public.is_model_lab_admin());

drop policy if exists "model_lab_admin_inserts_audit" on public.model_lab_audit_logs;
create policy "model_lab_admin_inserts_audit"
on public.model_lab_audit_logs
for insert
to authenticated
with check (
  public.is_model_lab_admin()
  and user_id = (select auth.uid())
);

create table if not exists public.model_lab_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null check (job_type in ('chat', 'image', 'image_edit', 'video')),
  provider text not null,
  model_id text not null,
  prompt text,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'blocked')),
  external_job_id text,
  output_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.model_lab_jobs enable row level security;

drop policy if exists "model_lab_admin_manages_jobs" on public.model_lab_jobs;
create policy "model_lab_admin_manages_jobs"
on public.model_lab_jobs
for all
to authenticated
using (
  public.is_model_lab_admin()
  and user_id = (select auth.uid())
)
with check (
  public.is_model_lab_admin()
  and user_id = (select auth.uid())
);

-- Enable first Model Lab administrator after replacing the email:
-- insert into private.model_lab_admin_access (user_id, enabled, require_aal2)
-- select id, true, true
-- from auth.users
-- where lower(email) = lower('TU_CORREO_ADMIN')
-- on conflict (user_id) do update set
--   enabled = true,
--   require_aal2 = true,
--   updated_at = now();
