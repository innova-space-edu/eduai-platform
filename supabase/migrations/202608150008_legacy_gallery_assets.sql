-- Backfill liviano de Mi Galería al AI Core.
-- No duplica las data URLs Base64: cada asset referencia generated_images.id y
-- /api/assets resuelve la imagen legacy cuando se solicita.

insert into public.eduai_assets (
  owner_id,
  asset_type,
  title,
  content_json,
  source_module,
  source_id,
  visibility,
  metadata,
  processing_purpose,
  contains_personal_data,
  created_at,
  updated_at
)
select
  gi.user_id,
  'image',
  left(coalesce(nullif(btrim(gi.prompt), ''), 'Imagen EduAI'), 240),
  jsonb_build_object(
    'legacyGallery', true,
    'generatedImageId', gi.id::text
  ),
  'legacy-gallery',
  gi.id::text,
  'private',
  jsonb_strip_nulls(jsonb_build_object(
    'legacyGeneratedImageId', gi.id::text,
    'provider', gi.provider,
    'style', gi.style,
    'width', gi.width,
    'height', gi.height,
    'source', gi.source,
    'topic', gi.topic,
    'optimizedPrompt', gi.optimized_prompt,
    'backfilledToAiCore', true
  )),
  'Reutilizar una imagen generada anteriormente en EduAI sin duplicar su contenido',
  false,
  coalesce(gi.created_at at time zone 'UTC', now()),
  coalesce(gi.created_at at time zone 'UTC', now())
from public.generated_images gi
where not exists (
  select 1
  from public.eduai_assets a
  where a.owner_id = gi.user_id
    and a.source_module = 'legacy-gallery'
    and a.source_id = gi.id::text
    and a.deleted_at is null
);

update public.eduai_assets
set root_asset_id = id
where source_module = 'legacy-gallery'
  and root_asset_id is null
  and deleted_at is null;
