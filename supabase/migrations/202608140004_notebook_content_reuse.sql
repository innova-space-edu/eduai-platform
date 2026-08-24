-- Notebook reuse: evita volver a extraer, chunkear y generar embeddings para
-- el mismo contenido dentro de la cuenta del usuario.

alter table public.notebook_sources
  add column if not exists content_hash text,
  add column if not exists reused_from_source_id uuid references public.notebook_sources(id) on delete set null,
  add column if not exists ingestion_model text,
  add column if not exists ingestion_reused_at timestamptz;

create index if not exists notebook_sources_content_hash_idx
  on public.notebook_sources (content_hash, status)
  where content_hash is not null and status = 'ready';

create index if not exists notebook_sources_reused_from_idx
  on public.notebook_sources (reused_from_source_id)
  where reused_from_source_id is not null;

comment on column public.notebook_sources.content_hash is
  'SHA-256 del texto normalizado extraído. Se usa para reutilización exacta del pipeline.';
comment on column public.notebook_sources.reused_from_source_id is
  'Fuente previa del mismo propietario desde la cual se reutilizaron texto/chunks/embeddings.';
comment on column public.notebook_sources.ingestion_model is
  'Modelo de embeddings usado para esta fuente; permite migraciones futuras de espacios vectoriales.';