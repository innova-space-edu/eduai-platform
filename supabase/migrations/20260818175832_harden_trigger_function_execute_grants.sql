-- Trigger-only SECURITY DEFINER functions must not be directly callable as RPCs.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.capture_ai_generation_provider_health()',
    'public.generate_profile_user_code()',
    'public.handle_new_eduai_user_access()',
    'public.handle_new_user()',
    'public.notify_friend_accept()',
    'public.notify_friend_request()',
    'public.notify_new_message()',
    'public.update_user_count()'
  ]
  loop
    execute format('revoke execute on function %s from public', fn);
    execute format('revoke execute on function %s from anon', fn);
    execute format('revoke execute on function %s from authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
