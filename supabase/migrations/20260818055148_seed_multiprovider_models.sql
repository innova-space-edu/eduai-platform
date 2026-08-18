-- Registra proveedores alternativos del AI Gateway en Model Lab.
-- Google conserva el primer lugar en el routing global; estas filas son
-- fallbacks por proveedor y solo se usan cuando existe la credencial server-side.
-- ON CONFLICT DO NOTHING evita sobrescribir ajustes administrativos futuros.

insert into public.ai_provider_models
  (provider, model, label, capabilities, is_enabled, is_default, priority, config)
values
  (
    'groq',
    'llama-3.3-70b-versatile',
    'Llama 3.3 70B Versatile · Groq',
    array['text','structured','long_context','code']::text[],
    true,
    true,
    10,
    '{"routing":"fallback","transport":"openai_compatible"}'::jsonb
  ),
  (
    'groq',
    'groq/compound',
    'Groq Compound · Research',
    array['research']::text[],
    true,
    true,
    10,
    '{"routing":"fallback","tools":"managed_search"}'::jsonb
  ),
  (
    'openrouter',
    'openrouter/auto',
    'OpenRouter Auto Router',
    array['text','structured','long_context','research','code']::text[],
    true,
    true,
    10,
    '{"routing":"fallback","provider_sort":"price","data_collection":"deny"}'::jsonb
  ),
  (
    'together',
    'Qwen/Qwen3.5-9B',
    'Qwen 3.5 9B · Together',
    array['text','structured','long_context','code']::text[],
    true,
    true,
    10,
    '{"routing":"fallback","transport":"openai_compatible"}'::jsonb
  ),
  (
    'cerebras',
    'gpt-oss-120b',
    'GPT OSS 120B · Cerebras',
    array['text','structured','long_context','code']::text[],
    true,
    true,
    10,
    '{"routing":"fallback","transport":"openai_compatible"}'::jsonb
  )
on conflict (provider, model) do nothing;
