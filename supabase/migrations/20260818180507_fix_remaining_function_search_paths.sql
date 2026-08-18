-- Fix mutable search_path warnings without moving extensions during this release.
alter function public.set_paper_updated_at() set search_path = '';
alter function public.update_updated_at() set search_path = '';
alter function public.update_audio_updated_at() set search_path = '';
alter function public.set_updated_at_saved_plannings() set search_path = '';
alter function public.set_saved_plannings_updated_at() set search_path = '';
alter function public.search_notebook_chunks_fts(uuid, text, integer, boolean) set search_path = '';
alter function public.set_video_jobs_updated_at() set search_path = '';
alter function public.set_updated_at() set search_path = '';
alter function public.update_updated_at_column() set search_path = '';

-- pgvector type and <=> operator are installed in extensions on this project.
alter function public.match_notebook_chunks(uuid, extensions.vector, integer, boolean) set search_path = pg_catalog, extensions;
alter function public.match_paper_chunks(extensions.vector, integer, uuid, uuid) set search_path = pg_catalog, extensions;
