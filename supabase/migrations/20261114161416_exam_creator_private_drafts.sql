create table if not exists public.exam_creator_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  payload jsonb,
  updated_at timestamptz not null default now(),
  constraint exam_creator_draft_payload_object check (payload is null or (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 8388608))
);
alter table public.exam_creator_drafts enable row level security;
revoke all on public.exam_creator_drafts from public, anon, authenticated;
grant select, insert, update on public.exam_creator_drafts to authenticated;
drop policy if exists exam_creator_draft_select_own on public.exam_creator_drafts;
create policy exam_creator_draft_select_own on public.exam_creator_drafts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists exam_creator_draft_insert_own on public.exam_creator_drafts;
create policy exam_creator_draft_insert_own on public.exam_creator_drafts for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists exam_creator_draft_update_own on public.exam_creator_drafts;
create policy exam_creator_draft_update_own on public.exam_creator_drafts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.save_exam_creator_draft(expected_revision integer, draft_payload jsonb)
returns integer language plpgsql security invoker set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  next_revision integer;
begin
  if caller is null or expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid draft authorization or revision';
  end if;
  if expected_revision = 0 then
    insert into public.exam_creator_drafts(user_id, revision, payload, updated_at)
    values (caller, 1, draft_payload, now())
    on conflict (user_id) do nothing
    returning revision into next_revision;
  else
    update public.exam_creator_drafts
      set revision = revision + 1, payload = draft_payload, updated_at = now()
      where user_id = caller and revision = expected_revision
      returning revision into next_revision;
  end if;
  return next_revision;
end;
$$;
revoke all on function public.save_exam_creator_draft(integer, jsonb) from public, anon, authenticated;
grant execute on function public.save_exam_creator_draft(integer, jsonb) to authenticated;
