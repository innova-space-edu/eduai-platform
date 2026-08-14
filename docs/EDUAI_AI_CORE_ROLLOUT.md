# EduAI AI Core — despliegue seguro

> Objetivo: modernizar EduAI sin duplicar módulos ni romper producción.

## Principios

- Las interfaces existentes permanecen: Claw, Open EDUAI Work, Notebooks, Chat Paper, Creator Hub, Image Studio, Video Studio, Audio Lab, MIRA, Exámenes, Planificador, Pizarra, Repositorio y Workspace.
- Los proveedores de IA pasan a ser motores intercambiables detrás de un AI Gateway común.
- Ninguna API key privada se expone con prefijo `NEXT_PUBLIC_`.
- La reutilización persistente es privada por usuario por defecto.
- Los recursos generados se guardan una vez y los módulos se enlazan mediante `asset_id`.
- Las cuentas restringidas no pueden usar IA generativa cloud.

## 1. Antes de aplicar SQL

1. Confirmar el **proyecto Supabase real de EduAI**.
2. Verificar que contiene las tablas base de EduAI (`profiles`, `notebooks`, `notebook_sources`, etc.).
3. No ejecutar estas migraciones sobre una base con tablas ajenas `company_*`.
4. Crear backup/snapshot de la base de producción.
5. Probar primero en una rama de Supabase o proyecto staging cuando sea posible.

## 2. Orden de migraciones

Aplicar en este orden:

1. `202608140001_ai_core_assets_reuse.sql`
2. `202608140002_user_access_profiles.sql`
3. `202608140003_video_jobs_repair.sql`
4. `202608140004_notebook_content_reuse.sql`
5. `202608140005_embedding_model_tracking.sql`

Después de aplicar, ejecutar los Supabase Advisors de seguridad y rendimiento.

## 3. Variables de Vercel

### Obligatorias

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

### Recomendadas

```env
GROQ_API_KEY=
OPENROUTER_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### Google opcionales por cuota/separación

```env
GEMINI_API_KEY_TEXT=
GEMINI_API_KEY_IMAGE=
GEMINI_API_KEY_VIDEO=
GOOGLE_TEXT_MODEL_PRIMARY=gemini-3.6-flash
GOOGLE_TEXT_MODEL_LITE=gemini-3.5-flash-lite
GOOGLE_EMBEDDING_MODEL=gemini-embedding-2
GOOGLE_IMAGE_MODEL_PRIMARY=gemini-3.1-flash-image
GOOGLE_VIDEO_MODEL_PRIMARY=veo-3.1-generate-preview
GOOGLE_VIDEO_RESOLUTION=720p
```

### Video

```env
VIDEO_PROVIDER_ORDER=google,hf-space
CRON_SECRET=
VIDEO_CRON_SECRET=
HF_SPACE_VIDEO_API_URL=
HF_SPACE_VIDEO_API_TOKEN=
```

El polling del frontend puede completar una operación Veo sin cron. El cron queda como respaldo para jobs abandonados.

### Investigación opcional

```env
TAVILY_API_KEY=
FIRECRAWL_API_KEY=
```

### Nunca configurar

```env
NEXT_PUBLIC_GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=
```

## 4. Entornos

Configurar secretos separados al menos para:

- Preview
- Production

No usar credenciales de producción para una rama de prueba si existe alternativa.

El repositorio declara Node.js 22.x. Mantener Vercel en Node 22.x durante este rollout y actualizar a 24.x únicamente en una migración posterior con pruebas dedicadas.

## 5. Pruebas mínimas antes de merge

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

### Flujos manuales

1. Crear cuenta adulta.
2. Crear cuenta restringida de prueba y comprobar que Image/Video/Research cloud devuelven 403.
3. Generar la misma imagen dos veces y comprobar `generationAvoided=true` en la segunda.
4. Generar el mismo material Creator dos veces y comprobar reutilización.
5. Subir el mismo PDF a dos Notebooks del mismo usuario y comprobar reutilización de chunks/embeddings.
6. Probar Notebook chat con citas.
7. Probar Chat Paper.
8. Generar video Veo; cerrar/reabrir la vista durante procesamiento; confirmar persistencia final en `eduai-assets`.
9. Abrir `/admin/model-lab` y verificar métricas.
10. Verificar que otro usuario no puede leer assets privados ni cache de otro usuario.

## 6. Estrategia de migración de embeddings

EduAI no mezcla vectores de modelos distintos.

- Modelo nuevo: `gemini-embedding-2`
- Dimensión de almacenamiento: 768
- Las fuentes antiguas siguen funcionando mediante full-text/BM25.
- La búsqueda vectorial se reactiva para un Notebook cuando todas sus fuentes activas hayan sido reingestadas con el modelo actual.
- Chat Paper vuelve a generar embeddings viejos de forma controlada y registra `embedding_model`.

## 7. Reutilización

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

### Alcance predeterminado

`exact_private` — una coincidencia solo se reutiliza dentro de la cuenta propietaria.

No usar cache persistente para resultados que necesiten actualidad web. Investigación con Google Search grounding debe consultar nuevamente fuentes actuales.

## 8. Asset Library

Los módulos deben reutilizar un recurso existente mediante `asset_id` en vez de subir/generar una copia.

El bucket `eduai-assets` es privado. Las vistas entregan URLs firmadas de corta duración.

Los recursos históricos de otros módulos se pueden incorporar progresivamente mediante `/api/assets/import`.

## 9. Rollback

Antes del merge, los routers antiguos permanecen en el repositorio para compatibilidad.

Si un proveedor nuevo falla:

- cambiar orden `EDUAI_AI_PROVIDER_ORDER_*` en Vercel;
- deshabilitar proveedor/modelo en el registro de AI Core;
- usar fallback existente;
- no eliminar inmediatamente las rutas legacy durante esta fase.

Si falla una migración, detener el rollout y corregir la migración en staging antes de tocar producción. No ejecutar scripts destructivos manualmente.

## 10. Fase de privacidad posterior

La arquitectura ya reserva campos para:

- clasificación del dato;
- finalidad;
- presencia de datos personales;
- retención;
- borrado lógico;
- auditoría de generación;
- visibilidad y ownership.

La auditoría legal/técnica completa de Ley 21.719 se realiza después de estabilizar el núcleo funcional, antes de su entrada en vigencia el 1 de diciembre de 2026.
