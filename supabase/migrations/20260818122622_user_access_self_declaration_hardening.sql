begin;

-- El onboarding legacy puede crear su fila una sola vez con edad autodeclarada,
-- pero nunca puede autoconcederse verificación de edad ni un estado incoherente.
drop policy if exists eduai_user_access_insert_own on public.eduai_user_access;
create policy eduai_user_access_insert_own
on public.eduai_user_access
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and age_self_declared is true
  and age_verified_at is null
  and (
    (
      birth_date > (current_date - interval '18 years')::date
      and age_band = 'under_18'
      and access_tier = 'restricted'
    )
    or
    (
      birth_date <= (current_date - interval '18 years')::date
      and age_band = 'adult'
      and access_tier = 'standard'
    )
  )
);

-- age_self_declared pasa a ser sensible junto con birth_date/age_band/tier/verification.
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
       or new.age_self_declared is distinct from old.age_self_declared
       or new.age_verified_at is distinct from old.age_verified_at then
      raise exception 'Los campos sensibles del perfil de acceso solo pueden ser modificados por la administración de EduAI.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_eduai_user_access_sensitive_update() from public, anon;
grant execute on function public.guard_eduai_user_access_sensitive_update() to authenticated, service_role;

commit;
