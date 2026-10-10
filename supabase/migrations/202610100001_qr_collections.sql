-- QR Studio: una URL corta estable con hasta 25 enlaces ordenados.
-- Los permisos existentes de qr_resources protegen también la colección JSON.
ALTER TABLE public.qr_resources
  ADD COLUMN IF NOT EXISTS link_items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.qr_resources
  DROP CONSTRAINT IF EXISTS qr_resources_resource_type_check;
ALTER TABLE public.qr_resources
  ADD CONSTRAINT qr_resources_resource_type_check
  CHECK (resource_type IN ('url', 'text', 'notebook', 'creator_project', 'asset', 'collection'));

ALTER TABLE public.qr_resources
  ADD CONSTRAINT qr_resources_collection_items_check
  CHECK (
    jsonb_typeof(link_items) = 'array'
    AND jsonb_array_length(link_items) <= 25
    AND (resource_type <> 'collection' OR jsonb_array_length(link_items) BETWEEN 1 AND 25)
  );

COMMENT ON COLUMN public.qr_resources.link_items IS
  'Enlaces completos ordenados, con título y descripción. Sólo se modifica por el propietario mediante la API de QR Studio.';
