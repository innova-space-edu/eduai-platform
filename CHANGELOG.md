# Notebook Hub v2 — Changelog de fixes

## Bugs corregidos

### 1. `lib/notebook/retrieval.ts`
**Problema:** `keywordRetrieval()` no filtraba fuentes activas — podía usar chunks de fuentes desactivadas.
**Fix:** Agrega `notebook_sources!inner(is_active)` + `.eq("notebook_sources.is_active", true)` igual que `getActiveChunks()`.
**Extra:** Retrieval híbrido mejorado — si vectorial devuelve < 3 resultados, complementa con keyword.

### 2. `lib/notebook/summarizer.ts`
**Problema:** `key_points`, `glossary_json` y `topics` se guardaban como `JSON.stringify(array)` en columnas JSONB — obligando a parsear al leer, rompiendo consultas SQL y el tipado.
**Fix:** Guardar directamente como arrays/objetos. Supabase lo serializa correctamente en JSONB.

### 3. `lib/notebook/ingestion.ts`
**Problema A:** `Promise.all()` sobre todos los chunks lanzaba N llamadas a Gemini en paralelo → rate limits + timeouts.
**Fix A:** Embeddings en lotes de 4 con `generateEmbeddingsBatched()`.

**Problema B:** URLs ya scrapeadas con snapshot en `raw_text` volvían a hacer fetch al momento de ingerir.
**Fix B:** `extractTextFromSource()` prefiere `raw_text` si existe y tiene > 100 chars.

**Problema C:** Error TypeScript `Property 'default' does not exist` en pdf-parse (conflicto CJS/ESM).
**Fix C:** Cast con `(await import("pdf-parse")) as any` antes de acceder a `.default ?? mod`.

### 4. `app/api/web/search/route.ts`
**Problema:** Último fallback usaba la IA para "inventar resultados web simulados" — contradice el principio de fuentes verificables.
**Fix:** Eliminado completamente ese bloque. Ahora devuelve `results: []` con hint de configuración. Orden real: Tavily → Brave → DuckDuckGo → vacío.

### 5. `app/api/notebooks/[id]/sources/route.ts`
**Problema:** `PATCH` y `DELETE` no verificaban ownership del notebook — confiaban solo en RLS.
**Fix:** Agrega `verifyOwnership()` helper en ambos métodos. Doble filtro: `.eq("notebook_id", id)` en la query además del auth check.
**Extra:** Dedupe de URLs al agregar (POST y web/ingest).

## Nuevo archivo

### `lib/notebook/extractor.ts`
Extractor web en cascada de 3 capas:
1. **Firecrawl** — cloud, maneja JS/SPA/captchas (recomendado Vercel)
2. **Playwright** — self-hosted via `PLAYWRIGHT_WS_ENDPOINT` (browserless, servidor propio)
3. **fetch + cleanHtml** — fallback básico sin JS rendering

Para Playwright en Vercel: instalar `playwright-core` + `@sparticuz/chromium-min` y descomentar la config en `next.config.ts`.

### `next.config.ts`
Actualizado con `serverExternalPackages` para `pdf-parse`, `playwright-core` y `mammoth`.

## Variables de entorno nuevas (opcionales)

```env
TAVILY_API_KEY=tvly-...          # https://tavily.com — 1000 req/mes gratis
BRAVE_SEARCH_API_KEY=BSA...     # https://api.search.brave.com — 2000 req/mes gratis
FIRECRAWL_API_KEY=fc-...         # https://firecrawl.dev — plan gratuito disponible
PLAYWRIGHT_WS_ENDPOINT=ws://... # Para Playwright remoto (browserless.io, etc.)
```

## Archivos a reemplazar

```
lib/notebook/retrieval.ts     ← reemplaza
lib/notebook/summarizer.ts    ← reemplaza
lib/notebook/ingestion.ts     ← reemplaza
lib/notebook/extractor.ts     ← NUEVO
app/api/web/search/route.ts   ← reemplaza
app/api/web/ingest/route.ts   ← reemplaza
app/api/notebooks/[id]/sources/route.ts ← reemplaza
next.config.ts                ← reemplaza
```
