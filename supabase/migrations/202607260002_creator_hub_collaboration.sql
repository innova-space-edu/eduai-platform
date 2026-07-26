begin;

create table if not exists public.creator_hub_project_collaborators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.creator_hub_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  collaborator_id uuid not null references auth.users(id) on delete cascade,
  permission text not null default 'view' check (permission in ('view', 'comment', 'edit')),
  invited_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, collaborator_id)
);

create index if not exists creator_hub_project_collaborators_project_idx
  on public.creator_hub_project_collaborators(project_id);
create index if not exists creator_hub_project_collaborators_user_idx
  on public.creator_hub_project_collaborators(collaborator_id);

create table if not exists public.creator_hub_project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.creator_hub_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.creator_hub_project_comments(id) on delete cascade,
  block_path text,
  body text not null check (char_length(body) between 1 and 4000),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_hub_project_comments_project_idx
  on public.creator_hub_project_comments(project_id, created_at);

create table if not exists public.creator_hub_project_share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.creator_hub_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  permission text not null default 'view' check (permission in ('view', 'comment')),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_hub_project_share_links_project_idx
  on public.creator_hub_project_share_links(project_id);

alter table public.creator_hub_project_collaborators enable row level security;
alter table public.creator_hub_project_comments enable row level security;
alter table public.creator_hub_project_share_links enable row level security;

create or replace function public.creator_hub_can_access_project(
  p_project_id uuid,
  p_required_permission text default 'view'
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.creator_hub_projects p
    where p.id = p_project_id
      and (
        p.user_id = auth.uid()
        or exists (
          select 1
          from public.creator_hub_project_collaborators c
          where c.project_id = p.id
            and c.collaborator_id = auth.uid()
            and case
              when p_required_permission = 'edit' then c.permission = 'edit'
              when p_required_permission = 'comment' then c.permission in ('comment', 'edit')
              else c.permission in ('view', 'comment', 'edit')
            end
        )
      )
  );
$$;

grant execute on function public.creator_hub_can_access_project(uuid, text) to authenticated;

create policy "creator collaborators visible to members"
  on public.creator_hub_project_collaborators
  for select
  to authenticated
  using (public.creator_hub_can_access_project(project_id, 'view'));

create policy "creator collaborators managed by owner"
  on public.creator_hub_project_collaborators
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "creator comments visible to project members"
  on public.creator_hub_project_comments
  for select
  to authenticated
  using (public.creator_hub_can_access_project(project_id, 'view'));

create policy "creator comments created by members"
  on public.creator_hub_project_comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.creator_hub_can_access_project(project_id, 'comment')
  );

create policy "creator comments updated by author or owner"
  on public.creator_hub_project_comments
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.creator_hub_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.creator_hub_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "creator comments deleted by author or owner"
  on public.creator_hub_project_comments
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.creator_hub_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "creator share links visible to owner"
  on public.creator_hub_project_share_links
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "creator share links managed by owner"
  on public.creator_hub_project_share_links
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create or replace function public.creator_hub_invite_collaborator(
  p_project_id uuid,
  p_email text,
  p_permission text default 'view'
) returns public.creator_hub_project_collaborators
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner uuid;
  v_collaborator uuid;
  v_result public.creator_hub_project_collaborators;
begin
  select user_id into v_owner
  from public.creator_hub_projects
  where id = p_project_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Solo el propietario puede invitar colaboradores';
  end if;

  if p_permission not in ('view', 'comment', 'edit') then
    raise exception 'Permiso inválido';
  end if;

  select id into v_collaborator
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_collaborator is null then
    raise exception 'No existe una cuenta EduAI con ese correo';
  end if;

  if v_collaborator = v_owner then
    raise exception 'El propietario ya tiene acceso completo';
  end if;

  insert into public.creator_hub_project_collaborators (
    project_id,
    owner_id,
    collaborator_id,
    permission,
    invited_email,
    updated_at
  ) values (
    p_project_id,
    v_owner,
    v_collaborator,
    p_permission,
    lower(trim(p_email)),
    now()
  )
  on conflict (project_id, collaborator_id)
  do update set permission = excluded.permission, invited_email = excluded.invited_email, updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.creator_hub_invite_collaborator(uuid, text, text) to authenticated;

create or replace function public.creator_hub_shared_project(p_token uuid)
returns table (
  project_id uuid,
  format text,
  title text,
  data jsonb,
  accent_color text,
  design_template_id text,
  permission text,
  owner_name text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.format,
    p.title,
    p.data,
    p.accent_color,
    p.design_template_id,
    s.permission,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.email, 'Usuario EduAI'),
    p.updated_at
  from public.creator_hub_project_share_links s
  join public.creator_hub_projects p on p.id = s.project_id
  join auth.users u on u.id = s.owner_id
  where s.token = p_token
    and s.is_active = true
    and (s.expires_at is null or s.expires_at > now())
  limit 1;
$$;

grant execute on function public.creator_hub_shared_project(uuid) to anon, authenticated;

commit;
