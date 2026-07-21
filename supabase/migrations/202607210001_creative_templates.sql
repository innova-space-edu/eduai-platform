-- Biblioteca privada de plantillas del Cuaderno Creativo

create extension if not exists pgcrypto;

create table if not exists public.creative_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  source text not null default 'other'
    check (source in ('generated', 'uploaded', 'pattern', 'other')),
  prompt text,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_templates_user_updated_idx
  on public.creative_templates (user_id, updated_at desc);

create or replace function public.set_creative_templates_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creative_templates_set_updated_at on public.creative_templates;
create trigger creative_templates_set_updated_at
before update on public.creative_templates
for each row execute function public.set_creative_templates_updated_at();

alter table public.creative_templates enable row level security;

drop policy if exists creative_templates_select_own on public.creative_templates;
create policy creative_templates_select_own
on public.creative_templates
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists creative_templates_insert_own on public.creative_templates;
create policy creative_templates_insert_own
on public.creative_templates
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists creative_templates_update_own on public.creative_templates;
create policy creative_templates_update_own
on public.creative_templates
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists creative_templates_delete_own on public.creative_templates;
create policy creative_templates_delete_own
on public.creative_templates
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.creative_templates to authenticated;

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
  8388608,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists creative_templates_storage_select_own on storage.objects;
create policy creative_templates_storage_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'creative-templates'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists creative_templates_storage_insert_own on storage.objects;
create policy creative_templates_storage_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'creative-templates'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists creative_templates_storage_update_own on storage.objects;
create policy creative_templates_storage_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'creative-templates'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'creative-templates'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists creative_templates_storage_delete_own on storage.objects;
create policy creative_templates_storage_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'creative-templates'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
