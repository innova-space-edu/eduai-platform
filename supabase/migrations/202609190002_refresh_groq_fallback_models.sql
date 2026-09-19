-- Actualiza modelos de fallback tras el retiro de Llama 3.x en Groq para planes free/developer.
-- Mantiene Google como proveedor principal, pero evita seleccionar modelos Groq retirados
-- desde el registro dinámico cuando el AI Gateway necesita un fallback.

update public.ai_provider_models
set is_enabled = false,
    is_default = false,
    deprecated_at = coalesce(deprecated_at, '2026-06-17T00:00:00Z'::timestamptz),
    shutdown_at = coalesce(shutdown_at, '2026-08-16T00:00:00Z'::timestamptz)
where provider = 'groq'
  and model in ('llama-3.1-8b-instant', 'llama-3.3-70b-versatile');

update public.ai_provider_models
set is_default = false
where provider = 'groq'
  and capabilities && array['text','structured','long_context','code']::text[];

insert into public.ai_provider_models
  (provider, model, label, capabilities, is_enabled, is_default, priority, config)
values
  (
    'groq',
    'openai/gpt-oss-120b',
    'GPT OSS 120B · Groq',
    array['text','structured','long_context','code']::text[],
    true,
    true,
    10,
    '{"routing":"fallback","transport":"openai_compatible","replacement_for":"llama-3.3-70b-versatile"}'::jsonb
  ),
  (
    'groq',
    'qwen/qwen3.6-27b',
    'Qwen 3.6 27B · Groq',
    array['text','structured','long_context','code']::text[],
    true,
    false,
    20,
    '{"routing":"fallback","transport":"openai_compatible"}'::jsonb
  ),
  (
    'groq',
    'openai/gpt-oss-20b',
    'GPT OSS 20B · Groq',
    array['text','structured','long_context','code']::text[],
    true,
    false,
    30,
    '{"routing":"fallback","transport":"openai_compatible"}'::jsonb
  )
on conflict (provider, model) do update
set label = excluded.label,
    capabilities = excluded.capabilities,
    is_enabled = excluded.is_enabled,
    is_default = excluded.is_default,
    priority = excluded.priority,
    config = excluded.config,
    deprecated_at = null,
    shutdown_at = null;
