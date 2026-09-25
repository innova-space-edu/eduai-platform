alter table public.parvularia_activity_bank
  add column if not exists embedding extensions.vector(768),
  add column if not exists embedding_model text;

create index if not exists parvularia_activity_bank_embedding_hnsw_idx
  on public.parvularia_activity_bank
  using hnsw (embedding vector_cosine_ops)
  where active = true and embedding is not null;

create or replace function public.search_parvularia_activities_hybrid(
  p_query text,
  p_query_embedding extensions.vector(768) default null,
  p_level text default null,
  p_limit integer default 24
)
returns table (
  id uuid, source_id uuid, level text, topic text, sequence_label text, day_label text,
  ambito_nucleo text, oa_text text, oat_text text, skill_text text, experience_text text,
  inicio text, desarrollo text, cierre text, evaluation text, resources text, tags text[],
  quality_score numeric, search_text text, embedding_model text, keyword_rank bigint,
  semantic_rank bigint, hybrid_score double precision
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'extensions'
as $$
  with params as (
    select case when btrim(coalesce(p_query, '')) = '' then null else websearch_to_tsquery('spanish', p_query) end as tsq
  ),
  keyword as (
    select a.id,
      row_number() over (order by ts_rank_cd(to_tsvector('spanish', coalesce(a.search_text, '')), params.tsq) desc, a.quality_score desc, a.updated_at desc) as rank_ix
    from public.parvularia_activity_bank a
    cross join params
    where a.active = true
      and (p_level is null or a.level = p_level or a.level = 'Sala Cuna')
      and params.tsq is not null
      and to_tsvector('spanish', coalesce(a.search_text, '')) @@ params.tsq
    order by rank_ix
    limit least(greatest(p_limit, 1), 50) * 3
  ),
  semantic as (
    select a.id,
      row_number() over (order by a.embedding <=> p_query_embedding, a.quality_score desc, a.updated_at desc) as rank_ix
    from public.parvularia_activity_bank a
    where a.active = true
      and (p_level is null or a.level = p_level or a.level = 'Sala Cuna')
      and p_query_embedding is not null
      and a.embedding is not null
    order by rank_ix
    limit least(greatest(p_limit, 1), 50) * 3
  ),
  fused as (
    select coalesce(k.id, s.id) as id, k.rank_ix as keyword_rank, s.rank_ix as semantic_rank,
      coalesce(1.0 / (60 + k.rank_ix), 0.0) + coalesce(1.0 / (60 + s.rank_ix), 0.0) as rrf_score
    from keyword k full outer join semantic s on s.id = k.id
  )
  select a.id,a.source_id,a.level,a.topic,a.sequence_label,a.day_label,a.ambito_nucleo,a.oa_text,a.oat_text,
    a.skill_text,a.experience_text,a.inicio,a.desarrollo,a.cierre,a.evaluation,a.resources,a.tags,a.quality_score,
    a.search_text,a.embedding_model,fused.keyword_rank,fused.semantic_rank,
    (fused.rrf_score + least(greatest(coalesce(a.quality_score, 0), 0), 10)::double precision * 0.0001)::double precision as hybrid_score
  from fused join public.parvularia_activity_bank a on a.id = fused.id
  order by hybrid_score desc, a.quality_score desc, a.updated_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.search_parvularia_activities_hybrid(text, extensions.vector, text, integer) from public;
grant execute on function public.search_parvularia_activities_hybrid(text, extensions.vector, text, integer) to authenticated;
