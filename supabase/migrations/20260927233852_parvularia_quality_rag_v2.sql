alter table public.parvularia_activity_bank
  add column if not exists ambito_canon text,
  add column if not exists nucleo_canon text,
  add column if not exists curricular_completeness_score numeric not null default 0,
  add column if not exists experience_fingerprint text,
  add column if not exists is_redundant boolean not null default false,
  add column if not exists duplicate_of uuid references public.parvularia_activity_bank(id) on delete set null;

create or replace function public.parvularia_normalize_key(p_value text)
returns text
language sql
immutable
strict
security invoker
set search_path to 'pg_catalog'
as $$
  select btrim(
    regexp_replace(
      translate(lower(p_value), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.parvularia_canonical_ambito(p_value text)
returns text
language sql
immutable
security invoker
set search_path to 'pg_catalog', 'public'
as $$
  with x as (select public.parvularia_normalize_key(coalesce(p_value,'')) as k)
  select case
    when k like '%identidad%autonomia%'
      or k like '%convivencia%ciudadania%'
      or k like '%corporalidad%movimiento%'
      or k like '%desarrollo personal%social%'
      then 'Desarrollo personal y social'
    when k like '%lenguaje verbal%'
      or k like '%lenguajes artisticos%'
      or k like '%comunicacion integral%'
      then 'Comunicación integral'
    when k like '%exploracion%entorno natural%'
      or k like '%comprension%entorno sociocultural%'
      or k like '%pensamiento matematico%'
      or k like '%interaccion%comprension%entorno%'
      then 'Interacción y comprensión del entorno'
    else null
  end
  from x;
$$;

create or replace function public.parvularia_canonical_nucleo(p_value text)
returns text
language sql
immutable
security invoker
set search_path to 'pg_catalog', 'public'
as $$
  with x as (select public.parvularia_normalize_key(coalesce(p_value,'')) as k)
  select case
    when k like '%identidad%autonomia%' then 'Identidad y autonomía'
    when k like '%convivencia%ciudadania%' then 'Convivencia y ciudadanía'
    when k like '%corporalidad%movimiento%' then 'Corporalidad y movimiento'
    when k like '%lenguaje verbal%' then 'Lenguaje verbal'
    when k like '%lenguajes artisticos%' then 'Lenguajes artísticos'
    when k like '%exploracion%entorno natural%' then 'Exploración del entorno natural'
    when k like '%comprension%entorno sociocultural%' then 'Comprensión del entorno sociocultural'
    when k like '%pensamiento matematico%' then 'Pensamiento matemático'
    else null
  end
  from x;
$$;

create or replace function private.parvularia_prepare_activity()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $$
begin
  new.ambito_canon := public.parvularia_canonical_ambito(new.ambito_nucleo);
  new.nucleo_canon := public.parvularia_canonical_nucleo(new.ambito_nucleo);
  new.curricular_completeness_score :=
      (case when nullif(btrim(coalesce(new.level,'')), '') is not null then 0.50 else 0 end)
    + (case when nullif(btrim(coalesce(new.topic,'')), '') is not null then 0.50 else 0 end)
    + (case when new.ambito_canon is not null then 1.00 else 0 end)
    + (case when new.nucleo_canon is not null then 1.00 else 0 end)
    + (case when nullif(btrim(coalesce(new.oa_text,'')), '') is not null then 2.00 else 0 end)
    + (case when nullif(btrim(coalesce(new.oat_text,'')), '') is not null then 1.00 else 0 end)
    + (case when length(btrim(coalesce(new.inicio,''))) >= 40 then 0.75 else 0 end)
    + (case when length(btrim(coalesce(new.desarrollo,''))) >= 120 then 1.50 else 0 end)
    + (case when length(btrim(coalesce(new.cierre,''))) >= 35 then 0.75 else 0 end)
    + (case when length(btrim(coalesce(new.evaluation,''))) >= 30 then 0.50 else 0 end)
    + (case when length(btrim(coalesce(new.resources,''))) >= 20 then 0.50 else 0 end);

  new.experience_fingerprint := md5(public.parvularia_normalize_key(coalesce(new.experience_text,'')));

  select coalesce(array_agg(distinct tag order by tag), '{}'::text[])
    into new.tags
  from unnest(
    coalesce(new.tags, '{}'::text[]) ||
    array[
      nullif(btrim(coalesce(new.level,'')), ''),
      nullif(btrim(coalesce(new.topic,'')), ''),
      new.ambito_canon,
      new.nucleo_canon
    ]
  ) as tag
  where tag is not null and btrim(tag) <> '';

  return new;
end;
$$;

drop trigger if exists parvularia_activity_prepare_trg on public.parvularia_activity_bank;
create trigger parvularia_activity_prepare_trg
before insert or update of
  level, topic, ambito_nucleo, oa_text, oat_text, inicio, desarrollo, cierre,
  evaluation, resources, experience_text, tags
on public.parvularia_activity_bank
for each row execute function private.parvularia_prepare_activity();

create or replace function public.refresh_parvularia_corpus_quality()
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_redundant integer := 0;
  v_active integer := 0;
begin
  update public.parvularia_activity_bank
  set active = true, is_redundant = false, duplicate_of = null
  where is_redundant = true;

  update public.parvularia_activity_bank
  set ambito_nucleo = ambito_nucleo;

  with ranked as (
    select
      id,
      first_value(id) over (
        partition by
          experience_fingerprint,
          level,
          public.parvularia_normalize_key(coalesce(oa_text,'')),
          public.parvularia_normalize_key(coalesce(oat_text,'')),
          coalesce(nucleo_canon,'')
        order by curricular_completeness_score desc, quality_score desc, updated_at desc, id
      ) as keeper_id,
      row_number() over (
        partition by
          experience_fingerprint,
          level,
          public.parvularia_normalize_key(coalesce(oa_text,'')),
          public.parvularia_normalize_key(coalesce(oat_text,'')),
          coalesce(nucleo_canon,'')
        order by curricular_completeness_score desc, quality_score desc, updated_at desc, id
      ) as rn
    from public.parvularia_activity_bank
    where active = true
      and nullif(experience_fingerprint,'') is not null
  )
  update public.parvularia_activity_bank a
  set is_redundant = true,
      duplicate_of = r.keeper_id,
      active = false
  from ranked r
  where a.id = r.id and r.rn > 1;

  get diagnostics v_redundant = row_count;

  update public.parvularia_corpus_sources s
  set active = false
  where s.active = true
    and length(btrim(coalesce(s.raw_text,''))) < 80
    and not exists (
      select 1 from public.parvularia_activity_bank a
      where a.source_id = s.id and a.active = true
    );

  select count(*) into v_active
  from public.parvularia_activity_bank
  where active = true;

  return jsonb_build_object(
    'active_activities', v_active,
    'redundant_activities', v_redundant
  );
end;
$$;

create index if not exists parvularia_activity_bank_scope_idx
  on public.parvularia_activity_bank(level, nucleo_canon)
  where active = true;

create index if not exists parvularia_activity_bank_completeness_idx
  on public.parvularia_activity_bank(curricular_completeness_score desc, quality_score desc)
  where active = true;

create index if not exists parvularia_activity_bank_fingerprint_idx
  on public.parvularia_activity_bank(experience_fingerprint)
  where active = true;

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
            where public.parvularia_normalize_key(coalesce(a.oa_text,'')) like
              '%' || public.parvularia_normalize_key(term) || '%'
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
      end as oat_match
    from public.parvularia_activity_bank a
    cross join params
    where a.active = true
      and a.is_redundant = false
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
          e.nucleus_match desc,
          e.oa_match desc,
          e.oat_match desc,
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
          e.nucleus_match desc,
          e.oa_match desc,
          e.oat_match desc,
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
        + e.nucleus_match * 0.012
        + e.oa_match * 0.010
        + e.oat_match * 0.005
        + least(greatest(coalesce(e.curricular_completeness_score,0),0),10)::double precision * 0.0012
        + least(greatest(coalesce(e.quality_score,0),0),10)::double precision * 0.0004
        - case when nullif(btrim(coalesce(e.oa_text,'')),'') is null then 0.004 else 0 end
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

create or replace function public.search_parvularia_corpus_sources_v2(
  p_query text,
  p_levels text[] default null,
  p_limit integer default 8
)
returns table (
  id uuid,
  file_name text,
  category text,
  level text,
  topic text,
  raw_text text,
  rank double precision
)
language sql
stable
security invoker
set search_path to 'pg_catalog'
as $$
  with params as (
    select case
      when btrim(coalesce(p_query,'')) = '' then null
      else websearch_to_tsquery('spanish',p_query)
    end as tsq
  )
  select
    s.id,s.file_name,s.category,s.level,s.topic,s.raw_text,
    ts_rank_cd(to_tsvector('spanish',coalesce(s.raw_text,'')),params.tsq)::double precision as rank
  from public.parvularia_corpus_sources s
  cross join params
  where s.active = true
    and params.tsq is not null
    and length(coalesce(s.raw_text,'')) >= 80
    and (
      cardinality(coalesce(p_levels,'{}'::text[])) = 0
      or s.level = any(p_levels)
      or (s.level = 'Sala Cuna' and exists (
        select 1 from unnest(coalesce(p_levels,'{}'::text[])) lvl
        where lvl ilike 'Sala Cuna%'
      ))
    )
    and to_tsvector('spanish',coalesce(s.raw_text,'')) @@ params.tsq
  order by rank desc,s.updated_at desc
  limit least(greatest(p_limit,1),20);
$$;

revoke all on function public.parvularia_normalize_key(text) from public;
revoke all on function public.parvularia_canonical_ambito(text) from public;
revoke all on function public.parvularia_canonical_nucleo(text) from public;
grant execute on function public.parvularia_normalize_key(text) to authenticated, service_role;
grant execute on function public.parvularia_canonical_ambito(text) to authenticated, service_role;
grant execute on function public.parvularia_canonical_nucleo(text) to authenticated, service_role;

revoke all on function public.refresh_parvularia_corpus_quality() from public, anon, authenticated;
grant execute on function public.refresh_parvularia_corpus_quality() to service_role;

revoke all on function public.search_parvularia_activities_hybrid_v2(
  text, extensions.vector, text[], text, text[], text[], uuid[], text[], integer
) from public, anon;
grant execute on function public.search_parvularia_activities_hybrid_v2(
  text, extensions.vector, text[], text, text[], text[], uuid[], text[], integer
) to authenticated, service_role;

revoke all on function public.search_parvularia_corpus_sources_v2(text,text[],integer) from public, anon;
grant execute on function public.search_parvularia_corpus_sources_v2(text,text[],integer) to authenticated, service_role;

revoke all on table public.parvularia_activity_bank from anon, authenticated;
grant select on table public.parvularia_activity_bank to authenticated;

revoke all on table public.parvularia_corpus_sources from anon, authenticated;
grant select on table public.parvularia_corpus_sources to authenticated;

revoke all on table public.parvularia_generation_history from anon, authenticated;
grant select, insert, delete on table public.parvularia_generation_history to authenticated;

revoke all on table public.parvularia_generation_runs from anon, authenticated;
grant select, insert, update on table public.parvularia_generation_runs to authenticated;

revoke all on table public.saved_plannings from anon, authenticated;
grant select, insert, update, delete on table public.saved_plannings to authenticated;

drop index if exists public.idx_saved_plannings_user_id;

select public.refresh_parvularia_corpus_quality();
