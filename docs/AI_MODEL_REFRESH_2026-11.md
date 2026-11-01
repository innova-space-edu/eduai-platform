# EduAI — catálogo de modelos verificados (01-11-2026)

## Modelos y proveedores
- Groq: `openai/gpt-oss-120b` como modelo de calidad, `openai/gpt-oss-20b`
  para velocidad, `qwen/qwen3.8-27b` como preview. Llama 3.1/3.3,
  Compound, Qwen 3.6 y Scout están retirados de los planes free/developer.
  Fuente: https://console.groq.com/docs/deprecations
- Google: `gemini-3.8-flash`, `gemini-3.5-flash-lite`. Se registra
  `gemini-4-argon` como opt-in inactivo, para no activar un modelo premium por
  accidente. Las rutas de imagen, audio, video siguen con sus modelos dedicados.
  Fuente: https://ai.google.dev/gemini-api/docs/models
- OpenRouter: `openrouter/free` para selección dinámica en routers antiguos.
  El Gateway puede usar `openrouter/auto`; comprobar costos y preferencias
  de privacidad antes de habilitarlo. Fuente: https://openrouter.ai/support
- SambaNova: catálogo existente conservado; requiere simultáneamente
  `EDUAI_SAMBANOVA_ENABLED=true` y una API key server-side. Obtener IDs
  autorizados con `GET https://api.sambanova.ai/v1/models`.
- Cerebras: `gpt-oss-120b` como modelo predeterminado.
- Together: se conserva su configuración actual hasta comprobar con su API.

## Orden seguro de lanzamiento
1. Comprobar CI y tests de modelos.
2. Fusionar una sola PR (un solo despliegue de producción).
3. Aplicar migración Supabase `20261101162200_refresh_active_ai_models.sql`.
4. Probar agentes, examen docente, Audio Lab y Model Lab con claves reales.
5. Revisar variables `GROQ_TEXT_MODEL` y `GROQ_RESEARCH_MODEL` en Vercel:
   el nuevo código filtra automáticamente valores retirados.
6. Consultar `/models` a los proveedores para validar permisos y límites
   concretos de la cuenta. No se conocen esas credenciales desde GitHub.

La falla HTTP 500 de `/api/agents/audio/generate` puede tener otra causa
(Edge TTS, cuota, red); corregir los modelos retira una causa potencial,
pero no permite declarar reparada toda la cadena de audio.
