-- EduAI access hardening
-- Reafirma el provisioning desde Auth y protege los campos que deciden edad/permisos.
-- Se mantiene como migración nueva porque 202608140002 fue ampliada después de su creación inicial.

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
    case when lower(coalesce(new.raw_user_meta_data ->> 'terms_accepted', 'false')) = 'true' then now() else null end,
    nullif(new.raw_user_meta_data ->> 'privacy_version', ''),
    case when lower(coalesce(new.raw_user_meta_data ->> 'privacy_accepted', 'false')) = 'true' then now() else null end
  )
  on conflict (user_id) do nothing;

  return new;
exception
  when invalid_datetime_format or datetime_field_overflow then
    raise warning 'EduAI invalid birth_date metadata for %', new.id;
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

-- Backfill defensivo: usuarios que ya existen en Auth, tienen birth_date declarada,
-- pero no alcanzaron a recibir fila en eduai_user_access.
do $$
declare
  rec record;
  birth_value date;
  account_value text;
  country_value text;
begin
  for rec in
    select u.id, u.raw_user_meta_data
    from auth.users u
    left join public.eduai_user_access a on a.user_id = u.id
    where a.user_id is null
      and nullif(u.raw_user_meta_data ->> 'birth_date', '') is not null
  loop
    begin
      birth_value := (rec.raw_user_meta_data ->> 'birth_date')::date;
      if birth_value < date '1900-01-01' or birth_value > current_date then
        continue;
      end if;

      account_value := coalesce(nullif(rec.raw_user_meta_data ->> 'account_type', ''), 'other');
      if account_value not in ('teacher','university_student','researcher','professional','other') then
        account_value := 'other';
      end if;
      country_value := nullif(rec.raw_user_meta_data ->> 'country_code', '');

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
        rec.id,
        birth_value,
        case when birth_value > (current_date - interval '18 years')::date then 'under_18' else 'adult' end,
        account_value,
        case when birth_value > (current_date - interval '18 years')::date then 'restricted' else 'standard' end,
        country_value,
        true,
        nullif(rec.raw_user_meta_data ->> 'terms_version', ''),
        case when lower(coalesce(rec.raw_user_meta_data ->> 'terms_accepted', 'false')) = 'true' then now() else null end,
        nullif(rec.raw_user_meta_data ->> 'privacy_version', ''),
        case when lower(coalesce(rec.raw_user_meta_data ->> 'privacy_accepted', 'false')) = 'true' then now() else null end
      )
      on conflict (user_id) do nothing;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        raise warning 'EduAI skipped invalid legacy birth_date for %', rec.id;
    end;
  end loop;
end;
$$;

-- Un usuario puede completar datos no privilegiados, pero no puede alterar por sí
-- mismo los campos que cambian edad, verificación o tier de autorización.
create or replace function public.guard_eduai_user_access_sensitive_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.role() = 'authenticated' and auth.uid() = old.user_id then
    if new.user_id is distinct from old.user_id
       or new.birth_date is distinct from old.birth_date
       or new.age_band is distinct from old.age_band
       or new.access_tier is distinct from old.access_tier
       or new.age_verified_at is distinct from old.age_verified_at then
      raise exception 'Los campos sensibles del perfil de acceso solo pueden ser modificados por la administración de EduAI.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists eduai_user_access_sensitive_guard on public.eduai_user_access;
create trigger eduai_user_access_sensitive_guard
before update on public.eduai_user_access
for each row execute function public.guard_eduai_user_access_sensitive_update();
