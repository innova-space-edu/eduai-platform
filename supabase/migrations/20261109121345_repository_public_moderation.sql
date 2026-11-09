create table if not exists public.repository_public_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text unique,
  material jsonb not null check (jsonb_typeof(material) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  item_id uuid references public.repository_items(id) on delete set null
);

create index if not exists repository_public_submissions_pending_idx
  on public.repository_public_submissions (created_at, id) where status = 'pending';

alter table public.repository_public_submissions enable row level security;
revoke all on public.repository_public_submissions from public, anon, authenticated;
grant select, insert, update on public.repository_public_submissions to service_role;

-- The staging namespace is only writable by the server or a signed upload.
-- Authenticated readers can open its objects only after catalog publication.
drop policy if exists repository_staged_files_read on storage.objects;
create policy repository_staged_files_read on storage.objects as restrictive
  for select to authenticated
  using (
    bucket_id <> 'eduai-repository' or (storage.foldername(name))[1] is distinct from '_moderation'
    or exists (
      select 1 from public.repository_items item
      where item.storage_path = storage.objects.name and item.visibility = 'public'
    )
  );

drop policy if exists repository_staged_files_anon on storage.objects;
create policy repository_staged_files_anon on storage.objects as restrictive
  for select to anon
  using (bucket_id <> 'eduai-repository' or (storage.foldername(name))[1] is distinct from '_moderation');

create index if not exists repository_items_staged_path_idx on public.repository_items (storage_path)
  where storage_path is not null;

create or replace function public.review_repository_submission(
  submission_id uuid, reviewer_id uuid, approve boolean
)
returns text language plpgsql security invoker set search_path = ''
as $$
declare
  submission public.repository_public_submissions%rowtype;
  material public.repository_items%rowtype;
  published_id uuid;
begin
  select * into submission from public.repository_public_submissions where id = submission_id for update;
  if not found then return null; end if;
  if submission.status <> 'pending' then return submission.status; end if;

  if approve then
    if submission.storage_path is not null and not exists (
      select 1 from storage.objects where bucket_id = 'eduai-repository' and name = submission.storage_path
    ) then return 'missing_file'; end if;

    material := jsonb_populate_record(null::public.repository_items, submission.material);
    insert into public.repository_items (
      title, subject, educational_level, school_year, material_type, question_count,
      source_type, storage_path, original_file_name, mime_type, file_size, youtube_url,
      youtube_video_id, visibility, created_by
    ) values (
      material.title, material.subject, material.educational_level, material.school_year,
      material.material_type, material.question_count, material.source_type, submission.storage_path,
      material.original_file_name, material.mime_type, material.file_size, material.youtube_url,
      material.youtube_video_id, 'public', submission.owner_id
    ) returning id into published_id;
  end if;

  update public.repository_public_submissions
  set status = case when approve then 'approved' else 'rejected' end,
      reviewed_at = now(), reviewed_by = reviewer_id, item_id = published_id
  where id = submission_id returning status into submission.status;
  return submission.status;
end;
$$;

revoke all on function public.review_repository_submission(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.review_repository_submission(uuid, uuid, boolean) to service_role;

-- A normal user must not be able to register a staged object in the catalog.
drop policy if exists repository_catalog_no_staged_insert on public.repository_items;
create policy repository_catalog_no_staged_insert on public.repository_items as restrictive
  for insert to authenticated
  with check (split_part(coalesce(storage_path, ''), '/', 1) <> '_moderation');

drop policy if exists repository_catalog_no_staged_update on public.repository_items;
create policy repository_catalog_no_staged_update on public.repository_items as restrictive
  for update to authenticated
  with check (split_part(coalesce(storage_path, ''), '/', 1) <> '_moderation');
