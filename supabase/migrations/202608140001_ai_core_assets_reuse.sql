-- EduAI AI Core: biblioteca unificada de assets, reutilización persistente y observabilidad.
-- Diseñada para coexistir con generated_images, repository_items, Creator Hub y Notebooks.

create extension if not exists pgcrypto;

create or replace function public.set_eduai_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) Registro de solicitudes de IA. Permite medir generaciones reales vs. reutilizadas.
create table if not exists public.ai_generation_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
  capability text not null,
  fingerprint text not null,
  source_module text,
  provider text,
  model text,
  reuse_policy text not null default 'never' check (reuse_policy in ('never','exact_private','exact_workspace','published')),
  status text not null default 'running' check (status in ('running','completed','failed','reused','cancelled')),
  request_json jsonb not null default '{}'::jsonb,
  response_metadata jsonb not null default '{}'::jsonb,
  error_message text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  estimated_cost_usd numeric(14,8) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  asset_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_generation_requests_owner_created_idx
  on public.ai_generation_requests (owner_id, created_at desc);
create index if not exists ai_generation_requests_fingerprint_idx
  on public.ai_generation_requests (owner_id, capability, fingerprint, created_at desc);
create index if not exists ai_generation_requests_status_idx
  on public.ai_generation_requests (status, created_at desc);

-- 2) Asset Library interna. Un mismo archivo puede ser usado por Notebook, Creator, examen, pizarra, etc.
create table if not exists public.eduai_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null,
  title text,
  mime_type text,
  storage_bucket text,
  storage_path text,
  external_url text,
  text_content text,
  content_json jsonb,
  source_module text,
  source_id text,
  generation_request_id uuid references public.ai_generation_requests(id) on delete set null,
  fingerprint text,
  visibility text not null default 'private' check (visibility in ('private','workspace','shared','public')),
  workspace_id uuid,
  parent_asset_id uuid references public.eduai_assets(id) on delete set null,
  root_asset_id uuid references public.eduai_assets(id) on delete set null,
  version integer not null default 1 check (version >= 1),
  metadata jsonb not null default '{}'::jsonb,
  data_classification text not null default 'standard' check (data_classification in ('standard','personal','sensitive','confidential')),
  processing_purpose text,
  contains_personal_data boolean not null default false,
  retention_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eduai_assets_payload_check check (
    storage_path is not null
    or external_url is not null
    or text_content is not null
    or content_json is not null
  )
);

create index if not exists eduai_assets_owner_created_idx
  on public.eduai_assets (owner_id, created_at desc)
  where deleted_at is null;
create index if not exists eduai_assets_type_idx
  on public.eduai_assets (owner_id, asset_type, created_at desc)
  where deleted_at is null;
create index if not exists eduai_assets_fingerprint_idx
  on public.eduai_assets (owner_id, fingerprint)
  where deleted_at is null and fingerprint is not null;
create index if not exists eduai_assets_root_version_idx
  on public.eduai_assets (root_asset_id, version desc)
  where deleted_at is null;
create index if not exists eduai_assets_metadata_gin_idx
  on public.eduai_assets using gin (metadata);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_generation_requests_asset_id_fkey'
  ) then
    alter table public.ai_generation_requests
      add constraint ai_generation_requests_asset_id_fkey
      foreign key (asset_id) references public.eduai_assets(id) on delete set null;
  end if;
end $$;

-- 3) Cache persistente exacto. Por defecto es privado por usuario.
create table if not exists public.ai_generation_cache (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
  capability text not null,
  fingerprint text not null,
  provider text,
  model text,
  result_json jsonb not null default '{}'::jsonb,
  asset_id uuid references public.eduai_assets(id) on delete set null,
  reuse_policy text not null default 'exact_private' check (reuse_policy in ('never','exact_private','exact_workspace','published')),
  visibility text not null default 'private' check (visibility in ('private','workspace','shared','public')),
  hit_count bigint not null default 0 check (hit_count >= 0),
  last_hit_at timestamptz,
  expires_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, capability, fingerprint)
);

create index if not exists ai_generation_cache_lookup_idx
  on public.ai_generation_cache (owner_id, capability, fingerprint)
  where invalidated_at is null;
create index if not exists ai_generation_cache_expiry_idx
  on public.ai_generation_cache (expires_at)
  where expires_at is not null and invalidated_at is null;

-- 4) Enlaces: el asset físico se guarda una vez y distintos módulos lo reutilizan.
create table if not exists public.eduai_asset_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.eduai_assets(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  relation text not null default 'uses',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (asset_id, target_type, target_id, relation)
);

create index if not exists eduai_asset_links_target_idx
  on public.eduai_asset_links (owner_id, target_type, target_id);

-- 5) Registro configurable de modelos. Evita hardcodear el catálogo en cada módulo.
create table if not exists public.ai_provider_models (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  label text not null,
  capabilities text[] not null default '{}'::text[],
  is_enabled boolean not null default true,
  is_default boolean not null default false,
  priority integer not null default 100,
  config jsonb not null default '{}'::jsonb,
  deprecated_at timestamptz,
  shutdown_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, model)
);

create table if not exists public.ai_provider_health (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text,
  capability text,
  status text not null check (status in ('healthy','degraded','down','unknown')),
  latency_ms integer,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists ai_provider_health_recent_idx
  on public.ai_provider_health (provider, model, checked_at desc);

insert into public.ai_provider_models (provider, model, label, capabilities, is_enabled, is_default, priority)
values
  ('google', 'gemini-3.6-flash', 'Gemini 3.6 Flash', array['text','structured','vision','long_context','research','code'], true, true, 10),
  ('google', 'gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', array['text','structured','vision','long_context'], true, true, 20),
  ('google', 'gemini-3.1-flash-image', 'Nano Banana 2', array['image'], true, true, 10),
  ('google', 'gemini-3-pro-image', 'Nano Banana Pro', array['image'], true, false, 20),
  ('google', 'veo-3.1-generate-preview', 'Veo 3.1', array['video'], true, true, 10),
  ('google', 'veo-3.1-fast-generate-preview', 'Veo 3.1 Fast', array['video'], true, false, 20),
  ('google', 'veo-3.1-lite-generate-preview', 'Veo 3.1 Lite', array['video'], true, false, 30)
on conflict (provider, model) do update set
  label = excluded.label,
  capabilities = excluded.capabilities,
  is_enabled = excluded.is_enabled,
  is_default = excluded.is_default,
  priority = excluded.priority,
  updated_at = now();

-- updated_at triggers

drop trigger if exists ai_generation_requests_updated_at on public.ai_generation_requests;
create trigger ai_generation_requests_updated_at
before update on public.ai_generation_requests
for each row execute function public.set_eduai_updated_at();

drop trigger if exists eduai_assets_updated_at on public.eduai_assets;
create trigger eduai_assets_updated_at
before update on public.eduai_assets
for each row execute function public.set_eduai_updated_at();

drop trigger if exists ai_generation_cache_updated_at on public.ai_generation_cache;
create trigger ai_generation_cache_updated_at
before update on public.ai_generation_cache
for each row execute function public.set_eduai_updated_at();

drop trigger if exists ai_provider_models_updated_at on public.ai_provider_models;
create trigger ai_provider_models_updated_at
before update on public.ai_provider_models
for each row execute function public.set_eduai_updated_at();

-- RLS -------------------------------------------------------------------------
alter table public.ai_generation_requests enable row level security;
alter table public.eduai_assets enable row level security;
alter table public.ai_generation_cache enable row level security;
alter table public.eduai_asset_links enable row level security;
alter table public.ai_provider_models enable row level security;
alter table public.ai_provider_health enable row level security;

drop policy if exists ai_generation_requests_owner_all on public.ai_generation_requests;
create policy ai_generation_requests_owner_all
on public.ai_generation_requests
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists eduai_assets_owner_select on public.eduai_assets;
create policy eduai_assets_owner_select
on public.eduai_assets
for select
to authenticated
using (
  deleted_at is null
  and ((select auth.uid()) = owner_id or visibility = 'public')
);

drop policy if exists eduai_assets_owner_insert on public.eduai_assets;
create policy eduai_assets_owner_insert
on public.eduai_assets
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists eduai_assets_owner_update on public.eduai_assets;
create policy eduai_assets_owner_update
on public.eduai_assets
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists eduai_assets_owner_delete on public.eduai_assets;
create policy eduai_assets_owner_delete
on public.eduai_assets
for delete
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists ai_generation_cache_owner_all on public.ai_generation_cache;
create policy ai_generation_cache_owner_all
on public.ai_generation_cache
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists eduai_asset_links_owner_all on public.eduai_asset_links;
create policy eduai_asset_links_owner_all
on public.eduai_asset_links
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.eduai_assets a
    where a.id = asset_id and a.owner_id = (select auth.uid())
  )
);

-- El catálogo de modelos y estado son legibles para usuarios autenticados.
-- Escrituras quedan reservadas a service_role porque no existe policy de INSERT/UPDATE/DELETE.
drop policy if exists ai_provider_models_read on public.ai_provider_models;
create policy ai_provider_models_read
on public.ai_provider_models
for select
to authenticated
using (true);

drop policy if exists ai_provider_health_read on public.ai_provider_health;
create policy ai_provider_health_read
on public.ai_provider_health
for select
to authenticated
using (true);

grant select, insert, update, delete on public.ai_generation_requests to authenticated;
grant select, insert, update, delete on public.eduai_assets to authenticated;
grant select, insert, update, delete on public.ai_generation_cache to authenticated;
grant select, insert, update, delete on public.eduai_asset_links to authenticated;
grant select on public.ai_provider_models to authenticated;
grant select on public.ai_provider_health to authenticated;

-- Storage privado para assets. La primera carpeta SIEMPRE es el UUID del propietario.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eduai-assets', 'eduai-assets', false, 524288000, null)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit;

drop policy if exists eduai_assets_storage_read_own on storage.objects;
create policy eduai_assets_storage_read_own
on storage.objects for select
to authenticated
using (
  bucket_id = 'eduai-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists eduai_assets_storage_insert_own on storage.objects;
create policy eduai_assets_storage_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'eduai-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists eduai_assets_storage_update_own on storage.objects;
create policy eduai_assets_storage_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'eduai-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'eduai-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists eduai_assets_storage_delete_own on storage.objects;
create policy eduai_assets_storage_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'eduai-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
