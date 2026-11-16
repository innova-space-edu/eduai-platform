create table if not exists public.eduai_social_conversations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 state jsonb not null,
 revision integer not null default 0,
 busy_until timestamptz,
 updated_at timestamptz not null default now()
);
create index if not exists eduai_social_conversations_owner_updated_idx on public.eduai_social_conversations(user_id,updated_at desc);
alter table public.eduai_social_conversations enable row level security;
revoke all on public.eduai_social_conversations from anon;
grant select,insert,update,delete on public.eduai_social_conversations to authenticated;
create policy social_conversations_select_own on public.eduai_social_conversations for select to authenticated using ((select auth.uid())=user_id);
create policy social_conversations_insert_own on public.eduai_social_conversations for insert to authenticated with check ((select auth.uid())=user_id);
create policy social_conversations_update_own on public.eduai_social_conversations for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy social_conversations_delete_own on public.eduai_social_conversations for delete to authenticated using ((select auth.uid())=user_id);
