-- Creator Hub: proyectos sincronizados, versiones y biblioteca universal de plantillas

create extension if not exists pgcrypto;

-- Amplía la biblioteca existente para soportar archivos de referencia y metadatos de diseño.
alter table if exists public.creative_templates
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists file_kind text not null default 'image',
  add column if not exists formats text[] not null default array[]::text[],
  add column if not exists accent_color text,
  add column if not exists secondary_color text,
  add column if not exists instructions text,
  add column if not exists preview_path text,
  add column if not exists is_creator_template boolean not null default false;

alter table if exists public.creative_templates
  drop constraint if exists creative_templates_file_kind_check;

alter table if exists public.creative_templates
  add constraint creative_templates_file_kind_check
  check (file_kind in ('image', 'pdf', 'presentation', 'document', 'other'));

create index if not exists creative_templates_creator_idx
  on public.creative_templates (user_id, is_creator_template, updated_at desc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'creative-templates',
  'creative-templates',
  false,
  26214400,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.creator_hub_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  format text not null,
  title text not null check (char_length(title) between 1 and 240),
  data jsonb not null default '{}'::jsonb,
  accent_color text,
  design_template_id text,
  thumbnail_url text,
  status text not null default 'draft' check (status in ('draft', 'final', 'archived', 'trashed')),
  current_version integer not null default 1 check (current_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_hub_projects_user_updated_idx
  on public.creator_hub_projects (user_id, updated_at desc);

create index if not exists creator_hub_projects_user_format_idx
  on public.creator_hub_projects (user_id, format, updated_at desc);

create table if not exists public.creator_hub_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.creator_hub_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_no integer not null check (version_no >= 1),
  title text not null,
  data jsonb not null default '{}'::jsonb,
  accent_color text,
  design_template_id text,
  note text,
  created_at timestamptz not null default now(),
  unique (project_id, version_no)
);

create index if not exists creator_hub_versions_project_idx
  on public.creator_hub_project_versions (project_id, version_no desc);

create or replace function public.set_creator_hub_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creator_hub_projects_set_updated_at on public.creator_hub_projects;
create trigger creator_hub_projects_set_updated_at
before update on public.creator_hub_projects
for each row execute function public.set_creator_hub_updated_at();

alter table public.creator_hub_projects enable row level security;
alter table public.creator_hub_project_versions enable row level security;

drop policy if exists creator_hub_projects_select_own on public.creator_hub_projects;
create policy creator_hub_projects_select_own
on public.creator_hub_projects for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists creator_hub_projects_insert_own on public.creator_hub_projects;
create policy creator_hub_projects_insert_own
on public.creator_hub_projects for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists creator_hub_projects_update_own on public.creator_hub_projects;
create policy creator_hub_projects_update_own
on public.creator_hub_projects for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists creator_hub_projects_delete_own on public.creator_hub_projects;
create policy creator_hub_projects_delete_own
on public.creator_hub_projects for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists creator_hub_versions_select_own on public.creator_hub_project_versions;
create policy creator_hub_versions_select_own
on public.creator_hub_project_versions for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists creator_hub_versions_insert_own on public.creator_hub_project_versions;
create policy creator_hub_versions_insert_own
on public.creator_hub_project_versions for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists creator_hub_versions_delete_own on public.creator_hub_project_versions;
create policy creator_hub_versions_delete_own
on public.creator_hub_project_versions for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.creator_hub_projects to authenticated;
grant select, insert, delete on public.creator_hub_project_versions to authenticated;
