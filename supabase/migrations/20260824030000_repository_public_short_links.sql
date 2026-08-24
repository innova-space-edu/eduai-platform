-- Nube EduAI: alias cortos y revocables para el acceso público global.

create table if not exists public.repository_public_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[A-Za-z0-9_-]{10,24}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists repository_public_links_one_active_owner_idx
  on public.repository_public_links (owner_id)
  where active = true;

create index if not exists repository_public_links_slug_active_idx
  on public.repository_public_links (slug, active);

alter table public.repository_public_links enable row level security;

-- Los alias se resuelven exclusivamente server-side con service role.
-- No se expone esta tabla directamente a usuarios ni visitantes.
revoke all on public.repository_public_links from anon;
revoke all on public.repository_public_links from authenticated;

grant all on public.repository_public_links to service_role;

create or replace function public.touch_repository_public_link_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists repository_public_links_touch_updated_at on public.repository_public_links;
create trigger repository_public_links_touch_updated_at
before update on public.repository_public_links
for each row execute function public.touch_repository_public_link_updated_at();
