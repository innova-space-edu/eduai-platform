create index if not exists parvularia_corpus_sources_raw_text_search_idx
  on public.parvularia_corpus_sources
  using gin (to_tsvector('spanish', coalesce(raw_text, '')))
  where active = true;

create or replace function public.search_parvularia_corpus_sources(
  p_query text,
  p_level text default null,
  p_limit integer default 8
)
returns table (
  id uuid, file_name text, category text, level text, topic text, raw_text text, rank double precision
)
language sql
stable
security invoker
set search_path to 'pg_catalog'
as $$
  with params as (
    select case when btrim(coalesce(p_query, '')) = '' then null else websearch_to_tsquery('spanish', p_query) end as tsq
  )
  select s.id,s.file_name,s.category,s.level,s.topic,s.raw_text,
    ts_rank_cd(to_tsvector('spanish', coalesce(s.raw_text, '')), params.tsq)::double precision as rank
  from public.parvularia_corpus_sources s
  cross join params
  where s.active = true
    and params.tsq is not null
    and length(coalesce(s.raw_text, '')) >= 80
    and (p_level is null or s.level = p_level or s.level = 'Sala Cuna')
    and to_tsvector('spanish', coalesce(s.raw_text, '')) @@ params.tsq
  order by rank desc, s.updated_at desc
  limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.search_parvularia_corpus_sources(text, text, integer) from public;
grant execute on function public.search_parvularia_corpus_sources(text, text, integer) to authenticated;
