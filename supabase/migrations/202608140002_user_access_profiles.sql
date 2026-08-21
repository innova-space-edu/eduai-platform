-- EduAI access profile: separa permisos/edad del perfil social para minimizar exposición de datos.

create extension if not exists pgcrypto;

create table if not exists public.eduai_user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null,
  age_band text not null check (age_band in ('under_18','adult')),
  account_type text not null default 'other' check (
    account_type in ('teacher','university_student','researcher','professional','other')
  ),
  access_tier text not null default 'standard' check (
    access_tier in ('restricted','standard','teacher','researcher','admin')
  ),
  country_code text,
  age_self_declared boolean not null default true,
  age_verified_at timestamptz,
  terms_version text,
  terms_accepted_at timestamptz,
  privacy_version text,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eduai_user_access_birth_date_check check (
    birth_date >= date '1900-01-01' and birth_date <= current_date
  )
);

create index if not exists eduai_user_access_tier_idx
  on public.eduai_user_access (access_tier, age_band);

create or replace function public.set_eduai_user_access_defaults()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();

  if new.birth_date > (current_date - interval '18 years')::date then
    new.age_band = 'under_18';
    new.access_tier = 'restricted';
  else
    new.age_band = 'adult';
    -- Los roles privilegiados solo los eleva el backend/admin.
    if tg_op = 'INSERT' then
      new.access_tier = 'standard';
    elsif old.access_tier not in ('teacher','researcher','admin') then
      new.access_tier = 'standard';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists eduai_user_access_defaults on public.eduai_user_access;
create trigger eduai_user_access_defaults
before insert or update of birth_date, account_type on public.eduai_user_access
for each row execute function public.set_eduai_user_access_defaults();

-- Crea el perfil de acceso desde metadata de Auth incluso si la confirmación de email
-- impide que el navegador tenga sesión inmediatamente después del signUp.
create or replace function public.handle_new_eduai_user_access()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  birth_text text;
  account_text text;
  country_text text;
begin
  birth_text := nullif(new.raw_user_meta_data ->> 'birth_date', '');
  if birth_text is null then
    return new;
  end if;

  account_text := coalesce(nullif(new.raw_user_meta_data ->> 'account_type', ''), 'other');
  if account_text not in ('teacher','university_student','researcher','professional','other') then
    account_text := 'other';
  end if;

  country_text := nullif(new.raw_user_meta_data ->> 'country_code', '');

  insert into public.eduai_user_access (
    user_id,
    birth_date,
    age_band,
    account_type,
    access_tier,
    country_code,
    age_self_declared,
    terms_version,
    terms_accepted_at,
    privacy_version,
    privacy_accepted_at
  ) values (
    new.id,
    birth_text::date,
    case when birth_text::date > (current_date - interval '18 years')::date then 'under_18' else 'adult' end,
    account_text,
    case when birth_text::date > (current_date - interval '18 years')::date then 'restricted' else 'standard' end,
    country_text,
    true,
    nullif(new.raw_user_meta_data ->> 'terms_version', ''),
    case when coalesce((new.raw_user_meta_data ->> 'terms_accepted')::boolean, false) then now() else null end,
    nullif(new.raw_user_meta_data ->> 'privacy_version', ''),
    case when coalesce((new.raw_user_meta_data ->> 'privacy_accepted')::boolean, false) then now() else null end
  )
  on conflict (user_id) do update set
    birth_date = excluded.birth_date,
    account_type = excluded.account_type,
    country_code = excluded.country_code,
    updated_at = now();

  return new;
exception
  when invalid_datetime_format then
    return new;
  when others then
    raise warning 'EduAI access profile provisioning failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_eduai_access on auth.users;
create trigger on_auth_user_created_eduai_access
after insert on auth.users
for each row execute function public.handle_new_eduai_user_access();

alter table public.eduai_user_access enable row level security;

drop policy if exists eduai_user_access_read_own on public.eduai_user_access;
create policy eduai_user_access_read_own
on public.eduai_user_access
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists eduai_user_access_insert_own on public.eduai_user_access;
create policy eduai_user_access_insert_own
on public.eduai_user_access
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and access_tier in ('restricted','standard')
);

drop policy if exists eduai_user_access_update_own on public.eduai_user_access;
create policy eduai_user_access_update_own
on public.eduai_user_access
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and access_tier in ('restricted','standard')
);

grant select, insert, update on public.eduai_user_access to authenticated;
revoke delete on public.eduai_user_access from authenticated;
