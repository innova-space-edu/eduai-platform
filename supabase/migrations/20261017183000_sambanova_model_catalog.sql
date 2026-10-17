-- SambaNova es adicional: no altera ni sustituye Google/Gemini ni otros proveedores.
-- Registrar los seis IDs del catálogo oficial (octubre de 2026).
-- La conexión de producción exige EDUAI_SAMBANOVA_ENABLED=true Y clave server-side.
-- El adaptador del Gateway es SOLO TEXTO por ahora. Los modelos de visión se
-- catalogan, pero no se enrutan como visión hasta validar imágenes en el adapter.
insert into public.ai_provider_models
  (provider, model, label, capabilities, is_enabled, is_default, priority, config)
values
  ('sambanova','gpt-oss-120b','GPT OSS 120B · SambaNova',
   array['text','structured','long_context','code']::text[],true,true,10,
   '{"transport":"openai_compatible","routing":"fallback","modality":"text"}'::jsonb),
  ('sambanova','DeepSeek-V3.1','DeepSeek V3.1 · SambaNova',
   array['text','structured','long_context','code']::text[],true,false,20,
   '{"transport":"openai_compatible","routing":"fallback","modality":"text"}'::jsonb),
  ('sambanova','DeepSeek-V3.2','DeepSeek V3.2 · SambaNova (Preview)',
   array['text','structured','long_context','code']::text[],true,false,30,
   '{"transport":"openai_compatible","routing":"fallback","channel":"preview","modality":"text"}'::jsonb),
  ('sambanova','Meta-Llama-3.3-70B-Instruct','Llama 3.3 70B · SambaNova',
   array['text','structured','long_context','code']::text[],true,false,40,
   '{"transport":"openai_compatible","routing":"fallback","modality":"text"}'::jsonb),
  ('sambanova','gemma-4-31B-it','Gemma 4 31B · SambaNova (Preview)',
   array['text','structured','long_context','code','vision']::text[],true,false,50,
   '{"transport":"openai_compatible","routing":"fallback","channel":"preview","vision_adapter":"pending"}'::jsonb),
  ('sambanova','MiniMax-M3','MiniMax M3 · SambaNova (Preview)',
   array['text','structured','long_context','code','vision']::text[],true,false,60,
   '{"transport":"openai_compatible","routing":"fallback","channel":"preview","vision_adapter":"pending","free_tier":"unverified"}'::jsonb)
on conflict (provider, model) do nothing;

-- Cola de experimentación: no cambia los estados que ya haya asignado un admin.
insert into public.ai_model_candidates
  (provider, model, label, capabilities, source_url, release_channel, status, priority, metadata)
values
  ('sambanova','gpt-oss-120b','GPT OSS 120B · SambaNova',
   array['text','structured','long_context','code','reasoning'],
   'https://cloud.sambanova.ai/apis','stable','discovered',10,
   '{"catalog_checked":"2026-10-17","kind":"external_api","vision_adapter":"none"}'::jsonb),
  ('sambanova','DeepSeek-V3.1','DeepSeek V3.1 · SambaNova',
   array['text','structured','long_context','code','reasoning'],
   'https://cloud.sambanova.ai/apis','stable','discovered',20,
   '{"catalog_checked":"2026-10-17","kind":"external_api"}'::jsonb),
  ('sambanova','DeepSeek-V3.2','DeepSeek V3.2 · SambaNova',
   array['text','structured','long_context','code','reasoning'],
   'https://cloud.sambanova.ai/apis','preview','discovered',30,
   '{"catalog_checked":"2026-10-17","kind":"external_api"}'::jsonb),
  ('sambanova','Meta-Llama-3.3-70B-Instruct','Llama 3.3 70B · SambaNova',
   array['text','structured','long_context','code'],
   'https://cloud.sambanova.ai/apis','stable','discovered',40,
   '{"catalog_checked":"2026-10-17","kind":"external_api"}'::jsonb),
  ('sambanova','gemma-4-31B-it','Gemma 4 31B · SambaNova',
   array['text','structured','long_context','code','vision'],
   'https://cloud.sambanova.ai/apis','preview','discovered',50,
   '{"catalog_checked":"2026-10-17","kind":"external_api","vision_adapter":"pending"}'::jsonb),
  ('sambanova','MiniMax-M3','MiniMax M3 · SambaNova',
   array['text','structured','long_context','code','vision'],
   'https://cloud.sambanova.ai/apis','preview','discovered',60,
   '{"catalog_checked":"2026-10-17","kind":"external_api","vision_adapter":"pending","free_tier":"unverified"}'::jsonb)
on conflict (provider, model) do nothing;
