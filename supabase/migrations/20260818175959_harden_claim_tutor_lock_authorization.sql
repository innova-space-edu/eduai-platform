-- Bind collaborative tutor-lock ownership to the authenticated caller and room membership.
create or replace function public.claim_tutor_lock(
  p_room_id uuid,
  p_owner uuid,
  p_seconds integer default 15
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_seconds integer;
  v_count integer;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    return false;
  end if;

  if p_owner is null or p_owner <> v_user_id then
    return false;
  end if;

  v_seconds := greatest(1, least(coalesce(p_seconds, 15), 30));

  update public.study_rooms sr
  set tutor_lock_owner = v_user_id,
      tutor_lock_until = now() + make_interval(secs => v_seconds)
  where sr.id = p_room_id
    and (
      sr.host_id = v_user_id
      or sr.guest_id = v_user_id
      or exists (
        select 1
        from public.room_members rm
        where rm.room_id = sr.id
          and rm.user_id = v_user_id
      )
    )
    and (
      sr.tutor_lock_until is null
      or sr.tutor_lock_until < now()
      or sr.tutor_lock_owner = v_user_id
    );

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke execute on function public.claim_tutor_lock(uuid, uuid, integer) from public;
revoke execute on function public.claim_tutor_lock(uuid, uuid, integer) from anon;
grant execute on function public.claim_tutor_lock(uuid, uuid, integer) to authenticated;
grant execute on function public.claim_tutor_lock(uuid, uuid, integer) to service_role;
