-- Nube EduAI: enlaces públicos permanentes para compartir un solo material.

create extension if not exists pgcrypto;

create table if not exists public.repository_public_shares (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.repository_items(id) on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{24,80}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id)
);

create index if not exists repository_public_shares_token_idx
  on public.repository_public_shares (token)
  where is_active = true;

create index if not exists repository_public_shares_creator_idx
  on public.repository_public_shares (created_by, created_at desc);

create or replace function public.touch_repository_public_share()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists repository_public_shares_touch on public.repository_public_shares;
create trigger repository_public_shares_touch
before update on public.repository_public_shares
for each row execute function public.touch_repository_public_share();

alter table public.repository_public_shares enable row level security;

-- Solo la persona que subió el material puede crear o administrar su enlace público.
drop policy if exists repository_public_shares_select_own on public.repository_public_shares;
create policy repository_public_shares_select_own
on public.repository_public_shares for select
to authenticated
using ((select auth.uid()) = created_by);

drop policy if exists repository_public_shares_insert_own on public.repository_public_shares;
create policy repository_public_shares_insert_own
on public.repository_public_shares for insert
to authenticated
with check (
  (select auth.uid()) = created_by
  and exists (
    select 1
    from public.repository_items item
    where item.id = item_id
      and item.created_by = (select auth.uid())
  )
);

drop policy if exists repository_public_shares_update_own on public.repository_public_shares;
create policy repository_public_shares_update_own
on public.repository_public_shares for update
to authenticated
using ((select auth.uid()) = created_by)
with check (
  (select auth.uid()) = created_by
  and exists (
    select 1
    from public.repository_items item
    where item.id = item_id
      and item.created_by = (select auth.uid())
  )
);

drop policy if exists repository_public_shares_delete_own on public.repository_public_shares;
create policy repository_public_shares_delete_own
on public.repository_public_shares for delete
to authenticated
using ((select auth.uid()) = created_by);

revoke all on public.repository_public_shares from anon;
grant select, insert, update, delete on public.repository_public_shares to authenticated;
