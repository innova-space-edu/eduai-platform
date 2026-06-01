create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.model_lab_admin_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  require_aal2 boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on private.model_lab_admin_access from public, anon, authenticated;

create or replace function public.has_model_lab_admin_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.model_lab_admin_access a
    where a.user_id = (select auth.uid())
      and a.enabled = true
  );
$$;

create or replace function public.is_model_lab_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.model_lab_admin_access a
    where a.user_id = (select auth.uid())
      and a.enabled = true
      and (
        a.require_aal2 = false
        or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      )
  );
$$;

revoke all on function public.has_model_lab_admin_access() from public;
revoke all on function public.is_model_lab_admin() from public;
grant execute on function public.has_model_lab_admin_access() to authenticated;
grant execute on function public.is_model_lab_admin() to authenticated;
