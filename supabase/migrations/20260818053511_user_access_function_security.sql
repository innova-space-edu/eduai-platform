-- EduAI access function security hardening.
-- Corrige la exposición de funciones trigger creadas por la migración de provisioning sin asumir
-- que esa migración aún no haya sido aplicada en producción.

begin;

-- El trigger AFTER INSERT de auth.users necesita privilegios elevados para
-- insertar fuera del schema auth. Se conserva SECURITY DEFINER, pero con
-- search_path vacío, relaciones calificadas y sin EXECUTE para clientes.
create or replace function public.handle_new_eduai_user_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  birth_text text;
  birth_value date;
  account_text text;
  country_text text;
begin
  birth_text := nullif(new.raw_user_meta_data ->> 'birth_date', '');
  if birth_text is null then
    return new;
  end if;

  begin
    birth_value := birth_text::date;
  exception
    when invalid_datetime_format or datetime_field_overflow then
      raise warning 'EduAI invalid birth_date metadata for %', new.id;
      return new;
  end;

  if birth_value < date '1900-01-01' or birth_value > current_date then
    raise warning 'EduAI out-of-range birth_date metadata for %', new.id;
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
    birth_value,
    case when birth_value > (current_date - interval '18 years')::date then 'under_18' else 'adult' end,
    account_text,
    case when birth_value > (current_date - interval '18 years')::date then 'restricted' else 'standard' end,
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
  when others then
    raise warning 'EduAI access profile provisioning failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke execute on function public.handle_new_eduai_user_access() from public, anon, authenticated;
grant execute on function public.handle_new_eduai_user_access() to supabase_auth_admin;

-- Este trigger solo necesita inspeccionar OLD/NEW y auth.uid(). No necesita
-- bypass de RLS, por lo que se cambia a SECURITY INVOKER. El chequeo usa
-- auth.uid() directamente y no depende de auth.role().
create or replace function public.guard_eduai_user_access_sensitive_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) = old.user_id then
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

-- El trigger puede ejecutarse en operaciones autenticadas o administrativas,
-- pero la función ya no eleva privilegios. Se elimina el acceso anónimo/PUBLIC
-- y se conserva solo para los roles que legítimamente actualizan la tabla.
revoke execute on function public.guard_eduai_user_access_sensitive_update() from public, anon;
grant execute on function public.guard_eduai_user_access_sensitive_update() to authenticated, service_role;

commit;
