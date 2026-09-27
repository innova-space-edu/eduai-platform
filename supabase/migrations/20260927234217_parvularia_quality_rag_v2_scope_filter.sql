create or replace function public.search_parvularia_activities_hybrid_v2(
  p_query text,
  p_query_embedding extensions.vector(768) default null,
  p_levels text[] default null,
  p_nucleo text default null,
  p_oa_terms text[] default '{}'::text[],
  p_oat_terms text[] default '{}'::text[],
  p_exclude_ids uuid[] default '{}'::uuid[],
  p_exclude_fingerprints text[] default '{}'::text[],
  p_limit integer default 24
)
returns table (
  id uuid,
  source_id uuid,
  level text,
  topic text,
  sequence_label text,
  day_label text,
  ambito_nucleo text,
  ambito_canon text,
  nucleo_canon text,
  oa_text text,
  oat_text text,
  skill_text text,
  experience_text text,
  inicio text,
  desarrollo text,
  cierre text,
  evaluation text,
  resources text,
  tags text[],
  quality_score numeric,
  curricular_completeness_score numeric,
  experience_fingerprint text,
  search_text text,
  embedding_model text,
  keyword_rank bigint,
  semantic_rank bigint,
  hybrid_score double precision
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public', 'extensions'
as $$
  with params as (
    select
      case
        when btrim(coalesce(p_query, '')) = '' then null
        else websearch_to_tsquery('spanish', p_query)
      end as tsq,
      public.parvularia_canonical_nucleo(p_nucleo) as requested_nucleo
  ),
  eligible as (
    select
      a.*,
      case
        when params.requested_nucleo is not null and a.nucleo_canon = params.requested_nucleo then 1
        else 0
      end as nucleus_match,
      case
        when cardinality(coalesce(p_oa_terms,'{}'::text[])) > 0
          and exists (
            select 1
            from unnest(coalesce(p_oa_terms,'{}'::text[])) term
            where public.parvularia_normalize_key(
              concat_ws(' ', coalesce(a.oa_text,''), coalesce(a.oat_text,''))
            ) like '%' || public.parvularia_normalize_key(term) || '%'
          )
          then 1 else 0
      end as oa_match,
      case
        when cardinality(coalesce(p_oat_terms,'{}'::text[])) > 0
          and exists (
            select 1
            from unnest(coalesce(p_oat_terms,'{}'::text[])) term
            where public.parvularia_normalize_key(coalesce(a.oat_text,'')) like
              '%' || public.parvularia_normalize_key(term) || '%'
          )
          then 1 else 0
      end as oat_match,
      case
        when a.ambito_canon = 'Desarrollo personal y social'
          then case when nullif(btrim(coalesce(a.oat_text,'')), '') is null then 1 else 0 end
        else case when nullif(btrim(coalesce(a.oa_text,'')), '') is null then 1 else 0 end
      end as objective_missing
    from public.parvularia_activity_bank a
    cross join params
    where a.active = true
      and a.is_redundant = false
      and (params.requested_nucleo is null or a.nucleo_canon = params.requested_nucleo)
      and (
        cardinality(coalesce(p_levels,'{}'::text[])) = 0
        or a.level = any(p_levels)
        or (a.level = 'Sala Cuna' and exists (
          select 1 from unnest(coalesce(p_levels,'{}'::text[])) lvl
          where lvl ilike 'Sala Cuna%'
        ))
      )
      and not (a.id = any(coalesce(p_exclude_ids,'{}'::uuid[])))
      and not (coalesce(a.experience_fingerprint,'') = any(coalesce(p_exclude_fingerprints,'{}'::text[])))
  ),
  keyword as (
    select
      e.id,
      row_number() over (
        order by
          ts_rank_cd(to_tsvector('spanish', coalesce(e.search_text,'')), params.tsq) desc,
          e.oa_match desc,
          e.oat_match desc,
          e.objective_missing asc,
          e.curricular_completeness_score desc,
          e.quality_score desc,
          e.updated_at desc
      ) as rank_ix
    from eligible e
    cross join params
    where params.tsq is not null
      and to_tsvector('spanish', coalesce(e.search_text,'')) @@ params.tsq
    order by rank_ix
    limit least(greatest(p_limit,1),60) * 4
  ),
  semantic as (
    select
      e.id,
      row_number() over (
        order by
          e.embedding <=> p_query_embedding,
          e.oa_match desc,
          e.oat_match desc,
          e.objective_missing asc,
          e.curricular_completeness_score desc,
          e.quality_score desc,
          e.updated_at desc
      ) as rank_ix
    from eligible e
    where p_query_embedding is not null
      and e.embedding is not null
    order by rank_ix
    limit least(greatest(p_limit,1),60) * 4
  ),
  fused as (
    select
      coalesce(k.id,s.id) as id,
      k.rank_ix as keyword_rank,
      s.rank_ix as semantic_rank,
      coalesce(1.0/(60+k.rank_ix),0.0) + coalesce(1.0/(60+s.rank_ix),0.0) as rrf_score
    from keyword k
    full outer join semantic s on s.id = k.id
  ),
  scored as (
    select
      e.*,
      f.keyword_rank,
      f.semantic_rank,
      (
        f.rrf_score
        + e.oa_match * 0.010
        + e.oat_match * 0.005
        + least(greatest(coalesce(e.curricular_completeness_score,0),0),10)::double precision * 0.0012
        + least(greatest(coalesce(e.quality_score,0),0),10)::double precision * 0.0004
        - e.objective_missing * 0.004
      )::double precision as final_score
    from fused f
    join eligible e on e.id = f.id
  ),
  dedup as (
    select
      s.*,
      row_number() over (
        partition by
          coalesce(s.experience_fingerprint,s.id::text),
          s.level,
          public.parvularia_normalize_key(coalesce(s.oa_text,'')),
          public.parvularia_normalize_key(coalesce(s.oat_text,'')),
          coalesce(s.nucleo_canon,'')
        order by s.final_score desc, s.curricular_completeness_score desc, s.quality_score desc
      ) as dedup_rank
    from scored s
  )
  select
    d.id,d.source_id,d.level,d.topic,d.sequence_label,d.day_label,d.ambito_nucleo,
    d.ambito_canon,d.nucleo_canon,d.oa_text,d.oat_text,d.skill_text,d.experience_text,
    d.inicio,d.desarrollo,d.cierre,d.evaluation,d.resources,d.tags,d.quality_score,
    d.curricular_completeness_score,d.experience_fingerprint,d.search_text,d.embedding_model,
    d.keyword_rank,d.semantic_rank,d.final_score as hybrid_score
  from dedup d
  where d.dedup_rank = 1
  order by d.final_score desc, d.curricular_completeness_score desc, d.quality_score desc, d.updated_at desc
  limit least(greatest(p_limit,1),60);
$$;

revoke all on function public.search_parvularia_activities_hybrid_v2(
  text, extensions.vector, text[], text, text[], text[], uuid[], text[], integer
) from public, anon;
grant execute on function public.search_parvularia_activities_hybrid_v2(
  text, extensions.vector, text[], text, text[], text[], uuid[], text[], integer
) to authenticated, service_role;
