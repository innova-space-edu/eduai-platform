alter table public.eduai_google_file_search_stores
  drop constraint if exists eduai_google_file_search_stores_notebook_id_fkey;
alter table public.eduai_google_file_search_stores
  add constraint eduai_google_file_search_stores_notebook_id_fkey
  foreign key (notebook_id) references public.notebooks(id) on delete restrict;

alter table public.eduai_google_file_search_documents
  drop constraint if exists eduai_google_file_search_documents_source_id_fkey;
alter table public.eduai_google_file_search_documents
  add constraint eduai_google_file_search_documents_source_id_fkey
  foreign key (source_id) references public.notebook_sources(id) on delete restrict;

comment on constraint eduai_google_file_search_stores_notebook_id_fkey on public.eduai_google_file_search_stores is
  'Impide borrar un Notebook antes de limpiar su File Search Store remoto.';
comment on constraint eduai_google_file_search_documents_source_id_fkey on public.eduai_google_file_search_documents is
  'Impide borrar una fuente antes de limpiar su documento remoto de Google File Search.';
