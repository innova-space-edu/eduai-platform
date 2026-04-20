-- ═══════════════════════════════════════════════════════════════════
-- EduAI Notebooks — BM25 Full-Text Search Migration
-- Ejecutar en Supabase SQL Editor DESPUÉS de migration.sql
-- ═══════════════════════════════════════════════════════════════════

-- Índice GIN para full-text search en español + inglés
-- No requiere nueva columna — usa to_tsvector() inline
create index if not exists idx_notebook_chunks_fts_es
  on public.notebook_chunks
  using gin(to_tsvector('spanish', chunk_text));

create index if not exists idx_notebook_chunks_fts_en
  on public.notebook_chunks
  using gin(to_tsvector('english', chunk_text));

-- ─── RPC: búsqueda full-text (BM25-like con ts_rank_cd) ─────────────
-- Combina español e inglés con fallback
create or replace function search_notebook_chunks_fts(
  p_notebook_id uuid,
  p_query       text,
  p_limit       int     default 20,
  p_active_only boolean default true
)
returns table (
  id         uuid,
  source_id  uuid,
  chunk_text text,
  rank       float
)
language plpgsql stable
as $$
declare
  v_ts_es tsvector;
  v_q_es  tsquery;
  v_q_en  tsquery;
begin
  -- Intentar parsear la query en ambos idiomas
  begin
    v_q_es := plainto_tsquery('spanish', p_query);
  exception when others then
    v_q_es := null;
  end;

  begin
    v_q_en := plainto_tsquery('english', p_query);
  exception when others then
    v_q_en := null;
  end;

  -- Si no se puede parsear en ninguno, devolver vacío
  if v_q_es is null and v_q_en is null then
    return;
  end if;

  return query
    select
      c.id,
      c.source_id,
      c.chunk_text,
      greatest(
        case when v_q_es is not null
          then ts_rank_cd(to_tsvector('spanish', c.chunk_text), v_q_es)
          else 0
        end,
        case when v_q_en is not null
          then ts_rank_cd(to_tsvector('english', c.chunk_text), v_q_en)
          else 0
        end
      )::float as rank
    from public.notebook_chunks c
    join public.notebook_sources s on s.id = c.source_id
    where c.notebook_id = p_notebook_id
      and (not p_active_only or s.is_active = true)
      and (
        (v_q_es is not null and to_tsvector('spanish', c.chunk_text) @@ v_q_es)
        or
        (v_q_en is not null and to_tsvector('english', c.chunk_text) @@ v_q_en)
      )
    order by rank desc
    limit p_limit;
end;
$$;
