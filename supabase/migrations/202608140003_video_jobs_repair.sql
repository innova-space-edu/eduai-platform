-- Video Studio: crea/repara las tablas que el código ya utiliza y agrega soporte
-- para operaciones asíncronas de Google, assets persistentes y reutilización.

create extension if not exists pgcrypto;

create table if not exists public.video_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued',
  plan text not null default 'free',
  mode text not null default 'text_to_video',
  prompt text not null,
  prompt_hash text not null,
  style text,
  duration_seconds integer not null default 6,
  include_audio boolean not null default false,
  image_url text,
  provider text,
  model text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  moderation_payload jsonb,
  video_url text,
  thumbnail_url text,
  error_message text,
  retry_count integer not null default 0,
  operation_name text,
  fingerprint text,
  asset_id uuid references public.eduai_assets(id) on delete set null,
  reuse_count bigint not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reparación idempotente por si una instalación ya creó una versión parcial.
alter table public.video_jobs add column if not exists status text not null default 'queued';
alter table public.video_jobs add column if not exists plan text not null default 'free';
alter table public.video_jobs add column if not exists mode text not null default 'text_to_video';
alter table public.video_jobs add column if not exists prompt text;
alter table public.video_jobs add column if not exists prompt_hash text;
alter table public.video_jobs add column if not exists style text;
alter table public.video_jobs add column if not exists duration_seconds integer not null default 6;
alter table public.video_jobs add column if not exists include_audio boolean not null default false;
alter table public.video_jobs add column if not exists image_url text;
alter table public.video_jobs add column if not exists provider text;
alter table public.video_jobs add column if not exists model text;
alter table public.video_jobs add column if not exists request_payload jsonb not null default '{}'::jsonb;
alter table public.video_jobs add column if not exists response_payload jsonb;
alter table public.video_jobs add column if not exists moderation_payload jsonb;
alter table public.video_jobs add column if not exists video_url text;
alter table public.video_jobs add column if not exists thumbnail_url text;
alter table public.video_jobs add column if not exists error_message text;
alter table public.video_jobs add column if not exists retry_count integer not null default 0;
alter table public.video_jobs add column if not exists operation_name text;
alter table public.video_jobs add column if not exists fingerprint text;
alter table public.video_jobs add column if not exists asset_id uuid;
alter table public.video_jobs add column if not exists reuse_count bigint not null default 0;
alter table public.video_jobs add column if not exists started_at timestamptz;
alter table public.video_jobs add column if not exists completed_at timestamptz;
alter table public.video_jobs add column if not exists created_at timestamptz not null default now();
alter table public.video_jobs add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'video_jobs_asset_id_fkey') then
    alter table public.video_jobs
      add constraint video_jobs_asset_id_fkey
      foreign key (asset_id) references public.eduai_assets(id) on delete set null;
  end if;
end $$;

create index if not exists video_jobs_user_created_idx
  on public.video_jobs (user_id, created_at desc);
create index if not exists video_jobs_queue_idx
  on public.video_jobs (status, created_at asc);
create index if not exists video_jobs_hash_idx
  on public.video_jobs (user_id, prompt_hash, created_at desc);
create index if not exists video_jobs_operation_idx
  on public.video_jobs (operation_name)
  where operation_name is not null and status = 'processing';
create index if not exists video_jobs_fingerprint_idx
  on public.video_jobs (user_id, fingerprint, created_at desc)
  where fingerprint is not null;

create table if not exists public.video_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  plan text not null default 'free',
  videos_created integer not null default 0 check (videos_created >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);

create index if not exists video_usage_daily_user_date_idx
  on public.video_usage_daily (user_id, usage_date desc);

drop trigger if exists video_jobs_updated_at on public.video_jobs;
create trigger video_jobs_updated_at
before update on public.video_jobs
for each row execute function public.set_eduai_updated_at();

drop trigger if exists video_usage_daily_updated_at on public.video_usage_daily;
create trigger video_usage_daily_updated_at
before update on public.video_usage_daily
for each row execute function public.set_eduai_updated_at();

alter table public.video_jobs enable row level security;
alter table public.video_usage_daily enable row level security;

drop policy if exists video_jobs_read_own on public.video_jobs;
create policy video_jobs_read_own
on public.video_jobs for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists video_jobs_insert_own on public.video_jobs;
create policy video_jobs_insert_own
on public.video_jobs for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- El procesamiento/modificación del job se realiza con service_role.
-- El usuario no recibe UPDATE directo sobre video_jobs.

drop policy if exists video_usage_daily_read_own on public.video_usage_daily;
create policy video_usage_daily_read_own
on public.video_usage_daily for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists video_usage_daily_insert_own on public.video_usage_daily;
create policy video_usage_daily_insert_own
on public.video_usage_daily for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists video_usage_daily_update_own on public.video_usage_daily;
create policy video_usage_daily_update_own
on public.video_usage_daily for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert on public.video_jobs to authenticated;
grant select, insert, update on public.video_usage_daily to authenticated;
revoke update, delete on public.video_jobs from authenticated;
