alter table public.study_sessions add column if not exists completed_at timestamptz;
create table if not exists public.study_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 weekly_session_goal integer not null default 0 check (weekly_session_goal between 0 and 30),
 updated_at timestamptz not null default now()
);
alter table public.study_preferences enable row level security;
revoke all on public.study_preferences from anon;
grant select,insert,update,delete on public.study_preferences to authenticated;
create policy study_preferences_read_own on public.study_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy study_preferences_insert_own on public.study_preferences for insert to authenticated with check ((select auth.uid())=user_id);
create policy study_preferences_update_own on public.study_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy study_preferences_delete_own on public.study_preferences for delete to authenticated using ((select auth.uid())=user_id);
