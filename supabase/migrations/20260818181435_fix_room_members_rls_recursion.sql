-- Avoid recursive RLS on room_members while preserving participant visibility.
create or replace function public.is_current_user_room_participant(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    else exists (
      select 1
      from public.study_rooms sr
      where sr.id = p_room_id
        and (
          sr.host_id = (select auth.uid())
          or sr.guest_id = (select auth.uid())
          or exists (
            select 1
            from public.room_members rm
            where rm.room_id = p_room_id
              and rm.user_id = (select auth.uid())
          )
        )
    )
  end;
$$;

revoke execute on function public.is_current_user_room_participant(uuid) from public, anon;
grant execute on function public.is_current_user_room_participant(uuid) to authenticated, service_role;

drop policy if exists "Users can view room memberships" on public.room_members;
create policy "Users can view room memberships"
on public.room_members
for select
to authenticated
using (public.is_current_user_room_participant(room_id));
