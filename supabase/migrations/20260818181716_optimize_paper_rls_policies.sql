-- Paper/RAG ownership policies: authenticated-only, statement-scoped auth.uid(),
-- and no overlapping permissive policies for paper_extractions.

alter policy paper_documents_delete_own on public.paper_documents to authenticated using ((select auth.uid()) = user_id);
alter policy paper_documents_insert_own on public.paper_documents to authenticated with check ((select auth.uid()) = user_id);
alter policy paper_documents_select_own on public.paper_documents to authenticated using ((select auth.uid()) = user_id);
alter policy paper_documents_update_own on public.paper_documents to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy paper_chunks_delete_own on public.paper_chunks to authenticated using ((select auth.uid()) = user_id);
alter policy paper_chunks_insert_own on public.paper_chunks to authenticated with check ((select auth.uid()) = user_id);
alter policy paper_chunks_select_own on public.paper_chunks to authenticated using ((select auth.uid()) = user_id);
alter policy paper_chunks_update_own on public.paper_chunks to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists paper_extractions_insert_own on public.paper_extractions;
drop policy if exists paper_extractions_select_own on public.paper_extractions;
drop policy if exists paper_extractions_update_own on public.paper_extractions;

alter policy "Users can insert own paper extractions" on public.paper_extractions to authenticated
  with check ((select auth.uid()) = user_id);
alter policy "Users can read own paper extractions" on public.paper_extractions to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users can update own paper extractions" on public.paper_extractions to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy paper_extractions_delete_own on public.paper_extractions to authenticated
  using ((select auth.uid()) = user_id);
