-- Additive integration with existing owner-scoped tables. No new public data policies.
create or replace function public.increment_ai_cache_hit(p_cache_id uuid)
returns bigint language sql security invoker set search_path = '' as $$
  update public.ai_generation_cache
  set hit_count = hit_count + 1, last_hit_at = now()
  where id = p_cache_id and owner_id = (select auth.uid()) and invalidated_at is null
    and (expires_at is null or expires_at > now())
  returning hit_count;
$$;
revoke all on function public.increment_ai_cache_hit(uuid) from public, anon;
grant execute on function public.increment_ai_cache_hit(uuid) to authenticated;

create or replace function public.increment_planning_asset_hit(p_asset_id uuid)
returns bigint language sql security invoker set search_path = '' as $$
  update public.eduai_assets
  set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{reuse_count}',
    to_jsonb(coalesce((metadata->>'reuse_count')::bigint, 0) + 1))
  where id = p_asset_id and owner_id = (select auth.uid()) and deleted_at is null
    and source_module = 'educador-library' and asset_type = 'planning'
  returning (metadata->>'reuse_count')::bigint;
$$;
revoke all on function public.increment_planning_asset_hit(uuid) from public, anon;
grant execute on function public.increment_planning_asset_hit(uuid) to authenticated;

create index if not exists eduai_assets_private_planning_lookup_idx
on public.eduai_assets(owner_id, fingerprint, updated_at desc)
where deleted_at is null and source_module = 'educador-library' and asset_type = 'planning';
create unique index if not exists eduai_assets_saved_planning_source_idx
on public.eduai_assets(owner_id, source_id)
where source_module = 'educador-library' and asset_type = 'planning' and source_id is not null;
create index if not exists saved_plannings_reuse_scope_idx
on public.saved_plannings(user_id, nivel, curso, asignatura);
create index if not exists saved_plannings_reuse_text_idx
on public.saved_plannings using gin(to_tsvector('spanish'::regconfig,
  coalesce(contexto, '') || ' ' || coalesce(nullif(content, ''), planning_text, '')));

create or replace function public.search_private_planning_references(
  p_query text, p_level text, p_course text, p_subject text, p_oa_ids text[], p_limit integer default 3
) returns table(id uuid, title text, excerpt text, rank real)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.title, left(coalesce(nullif(p.content, ''), p.planning_text, ''), 1200),
    ts_rank(to_tsvector('spanish'::regconfig, coalesce(p.contexto, '') || ' ' || coalesce(nullif(p.content, ''), p.planning_text, '')),
      websearch_to_tsquery('spanish'::regconfig, left(p_query, 1200)))
  from public.saved_plannings p
  where p.user_id = (select auth.uid()) and p.nivel = p_level
    and coalesce(nullif(p.curso, ''), p.course) = p_course
    and coalesce(nullif(p.asignatura, ''), p.subject) = p_subject
    and cardinality(p_oa_ids) > 0 and cardinality(p.selected_oa_ids) > 0
    and p.selected_oa_ids <@ p_oa_ids
    and to_tsvector('spanish'::regconfig, coalesce(p.contexto, '') || ' ' || coalesce(nullif(p.content, ''), p.planning_text, ''))
      @@ websearch_to_tsquery('spanish'::regconfig, left(p_query, 1200))
  order by 4 desc, p.updated_at desc
  limit greatest(0, least(coalesce(p_limit, 3), 3));
$$;
revoke all on function public.search_private_planning_references(text,text,text,text,text[],integer) from public, anon;
grant execute on function public.search_private_planning_references(text,text,text,text,text[],integer) to authenticated;

create or replace function public.sync_saved_planning_library()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  asset public.eduai_assets%rowtype;
  preferred uuid;
  body text;
  config jsonb;
begin
  if tg_op = 'DELETE' then
    update public.eduai_assets set deleted_at = now()
      where owner_id = old.user_id and source_id = old.id::text
        and source_module = 'educador-library' and asset_type = 'planning';
    return old;
  end if;
  body := coalesce(nullif(new.content, ''), new.planning_text, '');
  if btrim(body) = '' then return new; end if;
  config := coalesce(new.planning_json, '{}'::jsonb) || jsonb_build_object(
    'nivel', new.nivel, 'curso', coalesce(new.curso, new.course), 'asignatura', coalesce(new.asignatura, new.subject),
    'contexto', new.contexto, 'mes', new.mes, 'unidad_id', new.unidad_id,
    'selected_oa_ids', new.selected_oa_ids, 'selected_oat_ids', new.selected_oat_ids,
    'tiempo_planificacion', new.tiempo_planificacion, 'sesiones', new.sesiones, 'duracion_minutos', new.duracion_minutos);
  -- A saved copy receives its own asset. Reusing it cannot overwrite another saved document.
  select * into asset from public.eduai_assets
    where owner_id = new.user_id and source_id = new.id::text
      and source_module = 'educador-library' and asset_type = 'planning';
  if asset.id is null then
    begin preferred := (new.planning_json #>> '{_eduaiReuse,assetId}')::uuid;
    exception when invalid_text_representation then preferred := null; end;
    select * into asset from public.eduai_assets
      where id = preferred and owner_id = new.user_id and source_module = 'educador-library'
        and asset_type = 'planning' and deleted_at is null;
    if asset.id is not null and asset.source_id is not null and asset.source_id <> new.id::text then
      -- Copy identity/provenance, but never share the mutable saved version.
      insert into public.eduai_assets(owner_id,asset_type,title,text_content,content_json,source_module,source_id,fingerprint,visibility,metadata,contains_personal_data,data_classification)
      values(new.user_id,'planning',new.title,body,asset.content_json,'educador-library',new.id::text,asset.fingerprint,'private',asset.metadata,true,'personal')
      returning * into asset;
    end if;
  end if;
  if asset.id is null then
    insert into public.eduai_assets(owner_id,asset_type,title,text_content,content_json,source_module,source_id,visibility,metadata,contains_personal_data,data_classification)
    values(new.user_id,'planning',new.title,body,jsonb_build_object('sourceConfig',config),'educador-library',new.id::text,'private',
      jsonb_build_object('learning_version',1,'review_state','saved'),true,'personal') returning * into asset;
  end if;
  update public.eduai_assets set
    title = new.title, text_content = body, source_id = new.id::text, visibility = 'private', deleted_at = null,
    root_asset_id = coalesce(asset.root_asset_id, asset.id),
    version = asset.version + case when asset.text_content is distinct from body then 1 else 0 end,
    content_json = coalesce(asset.content_json, '{}'::jsonb) || jsonb_build_object('sourceConfig', config),
    metadata = coalesce(asset.metadata, '{}'::jsonb) || jsonb_build_object('review_state','saved','saved_planning_id',new.id,'source_updated_at',new.updated_at),
    updated_at = now()
    where id = asset.id and owner_id = new.user_id;
  new.planning_json := coalesce(new.planning_json, '{}'::jsonb) || jsonb_build_object('_eduaiReuse',
    coalesce(nullif(new.planning_json->'_eduaiReuse','null'::jsonb),'{}'::jsonb) || jsonb_build_object('assetId',asset.id));
  return new;
end;
$$;
revoke all on function public.sync_saved_planning_library() from public, anon;
grant execute on function public.sync_saved_planning_library() to authenticated;
drop trigger if exists saved_plannings_document_library on public.saved_plannings;
create trigger saved_plannings_document_library before insert or update or delete on public.saved_plannings
for each row execute function public.sync_saved_planning_library();

-- Existing documents become private reference material; no invented request/curriculum fingerprints.
insert into public.eduai_assets(owner_id,asset_type,title,text_content,content_json,source_module,source_id,visibility,metadata,contains_personal_data,data_classification)
select p.user_id,'planning',p.title,coalesce(nullif(p.content,''),p.planning_text),
  jsonb_build_object('sourceConfig',coalesce(p.planning_json,'{}'::jsonb)), 'educador-library',p.id::text,'private',
  jsonb_build_object('learning_version',1,'review_state','saved','saved_planning_id',p.id,'source_updated_at',p.updated_at,'legacy_reference_only',true),true,'personal'
from public.saved_plannings p
where length(coalesce(nullif(p.content,''),p.planning_text,'')) > 0
and not exists(select 1 from public.eduai_assets a where a.owner_id=p.user_id and a.source_id=p.id::text and a.source_module='educador-library' and a.asset_type='planning');
update public.eduai_assets set root_asset_id=id
where source_module='educador-library' and asset_type='planning' and root_asset_id is null;
