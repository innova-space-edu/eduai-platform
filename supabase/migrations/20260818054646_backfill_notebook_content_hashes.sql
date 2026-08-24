-- Backfill seguro para fuentes legacy de Notebook.
-- Solo completa content_hash desde extracted_text ya persistido.
-- No reextrae documentos, no regenera chunks y no recalcula embeddings.

update public.notebook_sources
set content_hash = encode(digest(convert_to(extracted_text, 'UTF8'), 'sha256'), 'hex')
where content_hash is null
  and status = 'ready'
  and extracted_text is not null
  and length(extracted_text) >= 20;
