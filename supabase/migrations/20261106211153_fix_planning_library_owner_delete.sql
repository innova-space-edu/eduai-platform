create or replace function public.sync_saved_planning_library()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  asset public.eduai_assets%rowtype;
  preferred uuid;
  body text;
  config jsonb;
begin
  if tg_op = 'DELETE' then
    delete from public.eduai_assets
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
