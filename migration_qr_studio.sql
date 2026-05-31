-- ═══════════════════════════════════════════════════════════════════
-- EduAI Platform — QR Studio MVP + shared workspace assets
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.workspace_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null,
  title text not null,
  storage_bucket text,
  storage_path text,
  external_url text,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qr_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  short_code text not null unique,
  title text not null,
  description text,
  resource_type text not null check (resource_type in ('url','text','notebook','creator_project','asset')),
  target_url text,
  text_content text,
  notebook_id uuid references public.notebooks(id) on delete set null,
  creator_project_id uuid,
  asset_id uuid references public.workspace_assets(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public','authenticated')),
  expires_at timestamptz,
  scan_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_assets_user_id on public.workspace_assets(user_id);
create index if not exists idx_qr_resources_user_id on public.qr_resources(user_id);
create index if not exists idx_qr_resources_short_code on public.qr_resources(short_code);

alter table public.workspace_assets enable row level security;
alter table public.qr_resources enable row level security;

create policy "workspace_assets_owner_all"
on public.workspace_assets for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "qr_resources_owner_all"
on public.qr_resources for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "qr_resources_public_read"
on public.qr_resources for select
to anon, authenticated
using (
  visibility = 'public'
  and (expires_at is null or expires_at > now())
);

create policy "qr_resources_authenticated_read"
on public.qr_resources for select
to authenticated
using (
  visibility = 'authenticated'
  and (expires_at is null or expires_at > now())
);

create or replace function public.record_qr_scan(p_short_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.qr_resources
  set scan_count = scan_count + 1,
      updated_at = now()
  where short_code = p_short_code
    and (expires_at is null or expires_at > now())
    and (
      visibility = 'public'
      or (visibility = 'authenticated' and auth.uid() is not null)
    );
end;
$$;

grant execute on function public.record_qr_scan(text) to anon, authenticated;
