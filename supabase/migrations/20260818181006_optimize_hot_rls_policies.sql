-- Targeted RLS optimization for high-value/hot EduAI paths.
-- Authorization semantics are preserved; auth.uid() is evaluated once per statement.

alter policy notebooks_delete on public.notebooks to authenticated using ((select auth.uid()) = user_id);
alter policy notebooks_insert on public.notebooks to authenticated with check ((select auth.uid()) = user_id);
alter policy notebooks_select on public.notebooks to authenticated using ((select auth.uid()) = user_id);
alter policy notebooks_update on public.notebooks to authenticated using ((select auth.uid()) = user_id);

alter policy nb_sources_delete on public.notebook_sources to authenticated using (
  exists (select 1 from public.notebooks n where n.id = notebook_sources.notebook_id and n.user_id = (select auth.uid()))
);
alter policy nb_sources_insert on public.notebook_sources to authenticated with check (
  exists (select 1 from public.notebooks n where n.id = notebook_sources.notebook_id and n.user_id = (select auth.uid()))
);
alter policy nb_sources_select on public.notebook_sources to authenticated using (
  exists (select 1 from public.notebooks n where n.id = notebook_sources.notebook_id and n.user_id = (select auth.uid()))
);
alter policy nb_sources_update on public.notebook_sources to authenticated using (
  exists (select 1 from public.notebooks n where n.id = notebook_sources.notebook_id and n.user_id = (select auth.uid()))
);

alter policy nb_chunks_delete on public.notebook_chunks to authenticated using (
  exists (select 1 from public.notebooks n where n.id = notebook_chunks.notebook_id and n.user_id = (select auth.uid()))
);
alter policy nb_chunks_insert on public.notebook_chunks to authenticated with check (
  exists (select 1 from public.notebooks n where n.id = notebook_chunks.notebook_id and n.user_id = (select auth.uid()))
);
alter policy nb_chunks_select on public.notebook_chunks to authenticated using (
  exists (select 1 from public.notebooks n where n.id = notebook_chunks.notebook_id and n.user_id = (select auth.uid()))
);

alter policy nb_messages_insert on public.notebook_messages to authenticated with check (
  exists (select 1 from public.notebooks n where n.id = notebook_messages.notebook_id and n.user_id = (select auth.uid()))
);
alter policy nb_messages_select on public.notebook_messages to authenticated using (
  exists (select 1 from public.notebooks n where n.id = notebook_messages.notebook_id and n.user_id = (select auth.uid()))
);

alter policy messages_insert_own on public.messages to authenticated with check (sender_id = (select auth.uid()));
alter policy messages_select_own on public.messages to authenticated using ((sender_id = (select auth.uid())) or (receiver_id = (select auth.uid())));
alter policy messages_update_own on public.messages to authenticated
  using ((sender_id = (select auth.uid())) or (receiver_id = (select auth.uid())))
  with check ((sender_id = (select auth.uid())) or (receiver_id = (select auth.uid())));

-- Collapse overlapping permissive Video Studio policies to one canonical policy per operation.
drop policy if exists "Users can insert their own video jobs" on public.video_jobs;
drop policy if exists "Users can read their own video jobs" on public.video_jobs;
drop policy if exists "Users can update their own video jobs" on public.video_jobs;
drop policy if exists "Users can view their own video jobs" on public.video_jobs;
drop policy if exists video_jobs_select_own on public.video_jobs;

alter policy video_jobs_insert_own on public.video_jobs to authenticated with check ((select auth.uid()) = user_id);
alter policy video_jobs_read_own on public.video_jobs to authenticated using ((select auth.uid()) = user_id);
alter policy video_jobs_update_own on public.video_jobs to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
