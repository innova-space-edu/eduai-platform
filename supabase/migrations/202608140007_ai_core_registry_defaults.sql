-- AI Core: defaults iniciales del registro dinámico de Google.
-- Después de esta migración el administrador puede cambiarlos desde Model Lab.
-- Se ejecuta una sola vez; no sobrescribe cambios administrativos futuros.

-- Familia texto/razonamiento/structured.
update public.ai_provider_models
set is_default = false
where provider = 'google'
  and capabilities && array['text','structured','code','vision','long_context','research']::text[];

update public.ai_provider_models
set is_enabled = true,
    is_default = true,
    priority = least(coalesce(priority, 10), 10)
where provider = 'google'
  and model = 'gemini-3.6-flash';

-- Familia de imagen: Nano Banana 2.
update public.ai_provider_models
set is_default = false
where provider = 'google'
  and capabilities && array['image']::text[];

update public.ai_provider_models
set is_enabled = true,
    is_default = true,
    priority = least(coalesce(priority, 10), 10)
where provider = 'google'
  and model = 'gemini-3.1-flash-image';

-- Familia de video: Veo 3.1.
update public.ai_provider_models
set is_default = false
where provider = 'google'
  and capabilities && array['video']::text[];

update public.ai_provider_models
set is_enabled = true,
    is_default = true,
    priority = least(coalesce(priority, 10), 10)
where provider = 'google'
  and model = 'veo-3.1-generate-preview';
