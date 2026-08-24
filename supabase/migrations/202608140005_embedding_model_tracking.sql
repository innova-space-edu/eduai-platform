-- Los vectores de modelos distintos NO se deben comparar entre sí aunque tengan
-- la misma dimensión. EduAI registra el modelo para migrar sin mezclar espacios.

alter table public.notebook_chunks
  add column if not exists embedding_model text;

alter table public.paper_chunks
  add column if not exists embedding_model text;

create index if not exists notebook_chunks_embedding_model_idx
  on public.notebook_chunks (notebook_id, embedding_model)
  where embedding is not null;

create index if not exists paper_chunks_embedding_model_idx
  on public.paper_chunks (document_id, embedding_model)
  where embedding is not null;

comment on column public.notebook_chunks.embedding_model is
  'Modelo que produjo el vector. No mezclar espacios vectoriales de modelos diferentes.';
comment on column public.paper_chunks.embedding_model is
  'Modelo que produjo el vector. No mezclar espacios vectoriales de modelos diferentes.';