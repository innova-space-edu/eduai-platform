-- EDUAI Multimedia · biblioteca de proyectos sincronizada entre dispositivos

create table if not exists public.multimedia_project_folders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.multimedia_projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Proyecto multimedia',
  folder_id text references public.multimedia_project_folders(id) on delete set null,
  project jsonb not null default '{}'::jsonb,
  assets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists multimedia_project_folders_user_updated_idx
  on public.multimedia_project_folders(user_id, updated_at desc);
create index if not exists multimedia_projects_user_updated_idx
  on public.multimedia_projects(user_id, updated_at desc);
create index if not exists multimedia_projects_folder_idx
  on public.multimedia_projects(user_id, folder_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.multimedia_project_folders to authenticated;
grant select, insert, update, delete on table public.multimedia_projects to authenticated;

alter table public.multimedia_project_folders enable row level security;
alter table public.multimedia_projects enable row level security;

drop policy if exists "multimedia_folders_select_own" on public.multimedia_project_folders;
create policy "multimedia_folders_select_own"
  on public.multimedia_project_folders for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "multimedia_folders_insert_own" on public.multimedia_project_folders;
create policy "multimedia_folders_insert_own"
  on public.multimedia_project_folders for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "multimedia_folders_update_own" on public.multimedia_project_folders;
create policy "multimedia_folders_update_own"
  on public.multimedia_project_folders for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "multimedia_folders_delete_own" on public.multimedia_project_folders;
create policy "multimedia_folders_delete_own"
  on public.multimedia_project_folders for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "multimedia_projects_select_own" on public.multimedia_projects;
create policy "multimedia_projects_select_own"
  on public.multimedia_projects for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "multimedia_projects_insert_own" on public.multimedia_projects;
create policy "multimedia_projects_insert_own"
  on public.multimedia_projects for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "multimedia_projects_update_own" on public.multimedia_projects;
create policy "multimedia_projects_update_own"
  on public.multimedia_projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "multimedia_projects_delete_own" on public.multimedia_projects;
create policy "multimedia_projects_delete_own"
  on public.multimedia_projects for delete to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'multimedia-projects',
  'multimedia-projects',
  false,
  524288000,
  array[
    'video/mp4','video/webm','video/quicktime','video/x-matroska','video/x-msvideo',
    'audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/ogg','audio/flac',
    'image/png','image/jpeg','image/webp','image/gif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "multimedia_storage_select_own" on storage.objects;
create policy "multimedia_storage_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'multimedia-projects'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "multimedia_storage_insert_own" on storage.objects;
create policy "multimedia_storage_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'multimedia-projects'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "multimedia_storage_update_own" on storage.objects;
create policy "multimedia_storage_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'multimedia-projects'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'multimedia-projects'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "multimedia_storage_delete_own" on storage.objects;
create policy "multimedia_storage_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'multimedia-projects'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
