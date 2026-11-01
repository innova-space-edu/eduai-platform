-- EduAI 2026-11-01: actualizar catálogo de modelos accesibles en Groq/Gemini.
-- Se preservan los flags de conexión de proveedores y las credenciales.
update public.ai_provider_models
set is_enabled = false, is_default = false,
    deprecated_at = coalesce(deprecated_at, '2026-08-16T00:00:00Z'::timestamptz),
    shutdown_at = coalesce(shutdown_at, '2026-11-01T00:00:00Z'::timestamptz)
where provider = 'groq' and model in (
  'llama-3.1-8b-instant', 'llama-3.3-70b-versatile',
  'qwen/qwen3-32b', 'qwen-qwq-32b', 'qwen/qwen3.6-27b',
  'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-4-scout-17b-16e-instruct',
  'groq/compound', 'groq/compound-mini'
);

update public.ai_provider_models
set is_default = false
where provider = 'groq'
  and capabilities && array['text','structured','long_context','code','research']::text[];

insert into public.ai_provider_models
  (provider, model, label, capabilities, is_enabled, is_default, priority, config)
values
  ('groq','openai/gpt-oss-120b','GPT OSS 120B · Groq',
   array['text','structured','long_context','code','research']::text[],true,true,10,
   '{"routing":"fallback","transport":"openai_compatible","catalog_checked":"2026-11-01"}'::jsonb),
  ('groq','openai/gpt-oss-20b','GPT OSS 20B · Groq (rápido)',
   array['text','structured','long_context','code']::text[],true,false,20,
   '{"routing":"fallback","transport":"openai_compatible","catalog_checked":"2026-11-01"}'::jsonb),
  ('groq','qwen/qwen3.8-27b','Qwen 3.8 27B · Groq (Preview)',
   array['text','structured','long_context','code','vision']::text[],true,false,30,
   '{"routing":"fallback","transport":"openai_compatible","channel":"preview","catalog_checked":"2026-11-01"}'::jsonb),
  ('openrouter','openrouter/free','OpenRouter · gratuito (enrutamiento dinámico)',
   array['text','long_context','code']::text[],true,false,20,
   '{"routing":"fallback","provider_sort":"price","data_collection":"deny"}'::jsonb),
  ('google','gemini-3.8-flash','Gemini 3.8 Flash · Google',
   array['text','structured','long_context','code','vision','research']::text[],true,true,5,
   '{"routing":"primary","catalog_checked":"2026-11-01"}'::jsonb),
  ('google','gemini-3.5-flash-lite','Gemini 3.5 Flash-Lite · Google',
   array['text','structured','long_context','code','vision']::text[],true,false,15,
   '{"routing":"primary","cost_tier":"lite","catalog_checked":"2026-11-01"}'::jsonb),
  ('google','gemini-4-argon','Gemini 4 Argon · Google (opt-in)',
   array['text','structured','long_context','code','research']::text[],false,false,25,
   '{"routing":"manual","cost_tier":"premium","catalog_checked":"2026-11-01"}'::jsonb)
on conflict (provider, model) do update set
 label = excluded.label, capabilities = excluded.capabilities, priority = excluded.priority,
 config = excluded.config,
 is_enabled = excluded.is_enabled, is_default = excluded.is_default,
 deprecated_at = null, shutdown_at = null;

-- Gemini 3.6 queda habilitado como alternativa, no como default de texto.
update public.ai_provider_models set is_default = false
where provider = 'google' and model <> 'gemini-3.8-flash'
  and capabilities && array['text','structured','long_context','code','research']::text[];
