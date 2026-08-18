-- Remove legacy permissive room-message policies. The authenticated policies already
-- cover hosts, guests, and room members while binding INSERT user_id to auth.uid().
drop policy if exists "users insert room messages" on public.room_messages;
drop policy if exists "users read room messages" on public.room_messages;
