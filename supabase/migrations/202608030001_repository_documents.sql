-- Repositorio EduAI: archivos educativos y enlaces de YouTube visibles solo para usuarios autenticados de EduAI.

create extension if not exists pgcrypto;

create table if not exists public.repository_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  subject text not null check (char_length(btrim(subject)) between 1 and 160),
  educational_level text not null check (char_length(btrim(educational_level)) between 1 and 120),
  school_year integer not null check (school_year between 1900 and 2200),
  material_type text not null check (material_type in (
    'guia',
    'prueba',
    'rubrica',
    'presentacion',
    'planificacion',
    'actividad',
    'ejercicio',
    'imagen',
    'otro'
  )),
  question_count integer not null default 0 check (question_count >= 0),
  source_type text not null check (source_type in ('file', 'youtube')),
  storage_path text,
  original_file_name text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  youtube_url text,
  youtube_video_id text,
  visibility text not null default 'public' check (visibility = 'public'),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repository_items_source_payload_check check (
    (
      source_type = 'file'
      and storage_path is not null
      and original_file_name is not null
      and youtube_url is null
      and youtube_video_id is null
    )
    or
    (
      source_type = 'youtube'
      and storage_path is null
      and original_file_name is null
      and youtube_url is not null
      and youtube_video_id is not null
      and youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
    )
  )
);

create index if not exists repository_items_created_at_idx
  on public.repository_items (created_at desc);

create index if not exists repository_items_catalog_idx
  on public.repository_items (subject, educational_level, school_year desc, material_type, title);

create index if not exists repository_items_creator_idx
  on public.repository_items (created_by, created_at desc);

create index if not exists repository_items_metadata_gin_idx
  on public.repository_items using gin (metadata);

create or replace function public.set_repository_item_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.visibility = 'public';
  new.metadata = jsonb_build_object(
    'schema_version', 1,
    'id', new.id,
    'title', new.title,
    'subject', new.subject,
    'educational_level', new.educational_level,
    'school_year', new.school_year,
    'material_type', new.material_type,
    'question_count', new.question_count,
    'visibility', 'public',
    'source_type', new.source_type,
    'file', case
      when new.source_type = 'file' then jsonb_build_object(
        'bucket', 'eduai-repository',
        'storage_path', new.storage_path,
        'original_name', new.original_file_name,
        'mime_type', new.mime_type,
        'size', new.file_size
      )
      else null
    end,
    'youtube', case
      when new.source_type = 'youtube' then jsonb_build_object(
        'url', new.youtube_url,
        'video_id', new.youtube_video_id
      )
      else null
    end,
    'created_by', new.created_by,
    'created_at', new.created_at,
    'updated_at', new.updated_at
  );
  return new;
end;
$$;

drop trigger if exists repository_items_sync_metadata on public.repository_items;
create trigger repository_items_sync_metadata
before insert or update on public.repository_items
for each row execute function public.set_repository_item_metadata();

alter table public.repository_items enable row level security;

-- Público dentro de EduAI: todos los usuarios autenticados pueden visualizar el catálogo.
drop policy if exists repository_items_read_public on public.repository_items;
drop policy if exists repository_items_read_authenticated on public.repository_items;
create policy repository_items_read_authenticated
on public.repository_items for select
to authenticated
using (visibility = 'public');

-- Cada usuario crea, modifica y elimina únicamente sus propios registros.
drop policy if exists repository_items_insert_own on public.repository_items;
create policy repository_items_insert_own
on public.repository_items for insert
to authenticated
with check ((select auth.uid()) = created_by and visibility = 'public');

drop policy if exists repository_items_update_own on public.repository_items;
create policy repository_items_update_own
on public.repository_items for update
to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by and visibility = 'public');

drop policy if exists repository_items_delete_own on public.repository_items;
create policy repository_items_delete_own
on public.repository_items for delete
to authenticated
using ((select auth.uid()) = created_by);

revoke all on public.repository_items from anon;
grant select, insert, update, delete on public.repository_items to authenticated;

-- Bucket privado: los documentos no tienen URL pública permanente.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'eduai-repository',
  'eduai-repository',
  false,
  104857600,
  null
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Todos los usuarios autenticados pueden leer y descargar los archivos mediante sesión o URL firmada.
drop policy if exists repository_files_read_authenticated on storage.objects;
create policy repository_files_read_authenticated
on storage.objects for select
to authenticated
using (bucket_id = 'eduai-repository');

-- La primera carpeta de cada archivo corresponde al UUID del docente.
drop policy if exists repository_files_insert_own_folder on storage.objects;
create policy repository_files_insert_own_folder
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'eduai-repository'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists repository_files_update_own_folder on storage.objects;
create policy repository_files_update_own_folder
on storage.objects for update
to authenticated
using (
  bucket_id = 'eduai-repository'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'eduai-repository'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists repository_files_delete_own_folder on storage.objects;
create policy repository_files_delete_own_folder
on storage.objects for delete
to authenticated
using (
  bucket_id = 'eduai-repository'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
