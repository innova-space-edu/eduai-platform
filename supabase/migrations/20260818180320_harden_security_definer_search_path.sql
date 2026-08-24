-- SECURITY DEFINER functions must resolve objects through a fixed search_path.
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.admin_emails
    where email = (select auth.email())
  );
end;
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

alter function public.notify_friend_accept() set search_path = '';
alter function public.notify_friend_request() set search_path = '';
alter function public.notify_new_message() set search_path = '';
