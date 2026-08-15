# EduAI AI Core — despliegue seguro

> Objetivo: modernizar EduAI sin duplicar módulos ni romper producción.

> Durante pruebas usar siempre el HEAD actual de la rama correspondiente; no hacer Redeploy sobre deployments antiguos porque Vercel conserva el commit original.

## Principios

- Las interfaces existentes permanecen: Claw, Open EDUAI Work, Notebooks, Chat Paper, Creator Hub, Image Studio, Video Studio, Audio Lab, MIRA, Exámenes, Planificador, Pizarra, Repositorio y Workspace.
- Los proveedores de IA pasan a ser motores intercambiables detrás de un AI Gateway común.
- Ninguna API key privada se expone con prefijo `NEXT_PUBLIC_`.
- La reutilización persistente es privada por usuario por defecto.
- Los recursos generados se guardan una vez y los módulos se enlazan mediante `asset_id`.
- Las cuentas restringidas no pueden usar IA generativa cloud.
- Video Studio usa **free-first routing**: reutilización → proveedores gratuitos/cuota gratuita → Veo premium como último fallback.

## 1. Supabase

Proyecto EduAI confirmado: `jfytmdvcqrjbbtyuklyf`.

No ejecutar migraciones de EduAI sobre bases con tablas ajenas `company_*`.

Migraciones aplicadas durante el rollout:

1. `202608140001_ai_core_assets_reuse.sql`
2. `202608140002_user_access_profiles.sql`
3. `202608140003_video_jobs_repair.sql`
4. `202608140004_notebook_content_reuse.sql`
5. `202608140005_embedding_model_tracking.sql`
6. `202608140006_ai_core_fk_indexes.sql`
7. `202608140007_ai_core_registry_defaults.sql`
8. `202608150008_legacy_gallery_assets.sql`

Buckets usados:

- `eduai-assets` — privado, destino definitivo de assets reutilizables.
- `generated-images` — compatibilidad temporal con la galería legacy.

Después de migraciones ejecutar Supabase Security Advisor y Performance Advisor.

## 2. Variables base de Vercel

### Obligatorias para el núcleo actual

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

`GEMINI_API_KEY` puede seguir usándose para texto/imagen dentro del free tier disponible. Video de Google/Veo no debe considerarse gratuito.

### Recomendadas

```env
GROQ_API_KEY=
OPENROUTER_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Redis/Upstash es opcional: Supabase mantiene la reutilización persistente aunque Redis no esté configurado.

### Google opcionales por cuota/separación

```env
GEMINI_API_KEY_TEXT=
GEMINI_API_KEY_IMAGE=
GEMINI_API_KEY_VIDEO=
GOOGLE_TEXT_MODEL_PRIMARY=gemini-3.6-flash
GOOGLE_TEXT_MODEL_LITE=gemini-3.5-flash-lite
GOOGLE_EMBEDDING_MODEL=gemini-embedding-2
GOOGLE_IMAGE_MODEL_PRIMARY=gemini-3.1-flash-image
GOOGLE_VIDEO_MODEL_PRIMARY=veo-3.1-lite-generate-preview
GOOGLE_VIDEO_RESOLUTION=720p
```

Veo queda implementado pero no es requisito para que Video Studio funcione.

## 3. Video Studio — orden de proveedores

Orden recomendado:

```env
VIDEO_PROVIDER_ORDER=wan,hf-gradio,hf-space,google
```

Significado:

1. `wan`: Alibaba Model Studio/Wan, mientras haya cuota gratuita o una cuenta habilitada.
2. `hf-gradio`: Space/worker Gradio compatible, por ejemplo Wan 2.1 1.3B.
3. `hf-space`: adapter legacy HTTP opcional.
4. `google`: Veo premium; queda como último fallback.

Antes de cualquier proveedor, Video Studio consulta el Reuse Engine. Un video idéntico ya terminado se reutiliza sin una nueva inferencia.

Los intentos fallidos **no consumen el cupo diario de EduAI**. El cupo se calcula con videos realmente completados.

### 3.1 Alibaba WAN

Variables:

```env
DASHSCOPE_API_KEY=
DASHSCOPE_WORKSPACE_ID=
WAN_VIDEO_REGION=singapore
# Opcionales:
WAN_VIDEO_API_BASE_URL=
WAN_VIDEO_MODEL_TEXT=wan2.7-t2v-2026-06-12
WAN_VIDEO_MODEL_IMAGE=wan2.7-i2v-2026-04-25
WAN_VIDEO_WATERMARK=true
```

Si la cuenta de Alibaba ofrece modo/cuota gratuita, activar la opción equivalente a **Free Quota Only** para impedir cargos accidentales cuando la cuota se termine.

El adapter es asíncrono: guarda `task_id`, consulta el estado y copia el MP4 a `eduai-assets` antes de que expire la URL temporal del proveedor.

### 3.2 Hugging Face / Gradio

Variables:

```env
HF_GRADIO_VIDEO_BASE_URL=https://TU-SPACE.hf.space
HF_GRADIO_VIDEO_API_NAME=generate
HF_GRADIO_VIDEO_MODEL=Wan-AI/Wan2.1-T2V-1.3B-Diffusers
HF_TOKEN=
```

`HF_TOKEN` no lleva prefijo `NEXT_PUBLIC_`.

La carpeta `workers/hf-wan-video/` contiene una plantilla de Space/worker Gradio con Wan 2.1 1.3B para texto→video. La disponibilidad gratuita/ZeroGPU depende de la cuenta y de las cuotas de Hugging Face; EduAI no asume capacidad ilimitada.

El adapter Gradio también es asíncrono:

```text
POST /gradio_api/call/generate -> event_id
GET  /gradio_api/call/generate/{event_id} -> SSE
```

Cuando el Space termina, EduAI copia el video a `eduai-assets`.

### 3.3 Adapter legacy opcional

```env
HF_SPACE_VIDEO_API_URL=
HF_SPACE_VIDEO_API_TOKEN=
```

Se conserva temporalmente por compatibilidad.

### 3.4 Procesamiento de cola

```env
CRON_SECRET=
VIDEO_CRON_SECRET=
```

Preview puede iniciar jobs desde el polling autenticado. En producción, el procesador/cron queda como respaldo para jobs abandonados o sin pestaña abierta.

## 4. Variables de investigación opcionales

```env
TAVILY_API_KEY=
FIRECRAWL_API_KEY=
```

## 5. Nunca configurar

```env
NEXT_PUBLIC_GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_DASHSCOPE_API_KEY=
NEXT_PUBLIC_HF_TOKEN=
```

## 6. Entornos

Separar secretos al menos para:

- Preview
- Production

No usar credenciales de producción para una rama de prueba si existe alternativa.

El repositorio declara Node.js 22.x. Mantener Vercel en Node 22.x durante este rollout.

## 7. Pruebas mínimas antes de merge

### Núcleo

```bash
npm run test:ai-core
npx tsc --noEmit
```

### Existentes

```bash
npm run test:curriculum
npm run test:planner
npm run test:creator
npm run test:whiteboard
npm run test:exam
npm run test:paper
npm run build
```

### Video

1. Sin proveedor gratuito configurado, Google 429 debe quedar como error claro; no debe quedarse en cola.
2. Configurar WAN o HF Gradio y confirmar que se usa antes que Google.
3. Confirmar `queued -> processing -> completed`.
4. Confirmar que el MP4 final queda en `eduai-assets`.
5. Repetir exactamente la solicitud y verificar `generationAvoided=true`.
6. Confirmar que un intento fallido no reduce `Disponibles hoy`.
7. Probar texto→video.
8. Probar imagen→video con un proveedor que soporte I2V.
9. Cerrar/reabrir Video Studio durante un job y confirmar que el polling puede retomarlo.

### Flujos generales

1. Crear cuenta adulta.
2. Crear cuenta restringida y comprobar que Image/Video/Research cloud devuelven 403.
3. Generar la misma imagen dos veces y comprobar `generationAvoided=true` en la segunda.
4. Generar el mismo material Creator dos veces y comprobar reutilización.
5. Subir el mismo PDF a dos Notebooks del mismo usuario y comprobar reutilización de chunks/embeddings.
6. Probar Notebook chat con citas.
7. Probar Chat Paper.
8. Abrir `/admin/model-lab` y verificar métricas.
9. Verificar que otro usuario no pueda leer assets privados ni cache de otro usuario.

## 8. Estrategia de embeddings

EduAI no mezcla vectores de modelos distintos.

- Modelo actual: `gemini-embedding-2`
- Dimensión de almacenamiento: 768
- Fuentes antiguas siguen funcionando mediante full-text/BM25.
- Búsqueda vectorial se reactiva cuando las fuentes activas hayan sido reingestadas con el modelo actual.
- Chat Paper registra `embedding_model`.

## 9. Reutilización

### Cache rápido

Upstash/Redis:

- rate limiting
- locks
- health temporal
- respuestas calientes

### Cache persistente

Supabase:

- `ai_generation_cache`
- `ai_generation_requests`
- `eduai_assets`
- `eduai_asset_links`

Alcance predeterminado: `exact_private`.

No usar cache persistente para resultados que necesiten actualidad web.

## 10. Asset Library

Los módulos reutilizan recursos por `asset_id` en vez de subir/generar copias.

El bucket `eduai-assets` es privado y las vistas entregan URLs firmadas de corta duración.

Los videos externos se descargan y guardan en EduAI inmediatamente para no depender de URLs temporales de proveedores.

## 11. Rollback

Los routers anteriores permanecen durante esta fase.

Si un proveedor falla:

- cambiar `VIDEO_PROVIDER_ORDER` o el orden de proveedores correspondiente;
- deshabilitar proveedor/modelo en Model Lab cuando aplique;
- usar fallback existente;
- no eliminar rutas legacy hasta terminar smoke tests.

No ejecutar scripts destructivos manualmente en producción.

## 12. Fase de privacidad posterior

La arquitectura reserva campos para:

- clasificación del dato;
- finalidad;
- presencia de datos personales;
- retención;
- borrado lógico;
- auditoría de generación;
- visibilidad y ownership.

La auditoría legal/técnica completa de Ley 21.719 se realiza después de estabilizar el núcleo funcional, antes de su entrada en vigencia el 1 de diciembre de 2026.
