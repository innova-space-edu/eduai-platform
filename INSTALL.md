# Notebook Hub — Guía de instalación
> Sprint 1 + Sprint 2 base | EduAI Platform

---

## 1. SQL — Supabase

Ejecutar `migration.sql` completo en el **SQL Editor** de Supabase.
Requiere `pgvector` habilitado (ya disponible en Supabase hosted).

---

## 2. Variables de entorno

No se requieren nuevas variables obligatorias.
Las siguientes son **opcionales** para features adicionales:

```env
# Web search (Sprint 2 — búsqueda desde panel de fuentes)
TAVILY_API_KEY=tvly-...          # https://tavily.com — plan gratuito disponible

# Web scraping enriquecido (alternativa a fetch directo)
FIRECRAWL_API_KEY=fc-...        # https://firecrawl.dev — plan gratuito disponible
```

Los embeddings usan la misma `GEMINI_API_KEY_POOL` / `GEMINI_API_KEY` que ya tienes.
Si no hay clave Gemini disponible, el sistema cae back a búsqueda por keyword (sin vector).

---

## 3. Instalar dependencias

No se necesitan paquetes nuevos. Todo usa lo que ya está en `package.json`:
- `pdf-parse` ✓
- `mammoth` ✓
- `@supabase/supabase-js` ✓
- `react-markdown` ✓

---

## 4. Copiar archivos

### Librerías
```
lib/notebook/types.ts          → lib/notebook/types.ts
lib/notebook/prompts.ts        → lib/notebook/prompts.ts
lib/notebook/chunking.ts       → lib/notebook/chunking.ts
lib/notebook/ingestion.ts      → lib/notebook/ingestion.ts
lib/notebook/retrieval.ts      → lib/notebook/retrieval.ts
lib/notebook/summarizer.ts     → lib/notebook/summarizer.ts
```

### Hooks
```
hooks/useNotebook.ts           → hooks/useNotebook.ts
```

### API routes
```
app/api/notebooks/route.ts
app/api/notebooks/[id]/route.ts
app/api/notebooks/[id]/sources/route.ts
app/api/notebooks/[id]/ingest/route.ts
app/api/notebooks/[id]/summary/route.ts
app/api/notebooks/[id]/chat/route.ts
app/api/notebooks/[id]/generate/route.ts
app/api/web/search/route.ts
app/api/web/ingest/route.ts
```

### Componentes
```
components/notebook/SourcePanel.tsx
components/notebook/NotebookChat.tsx
components/notebook/StudioPanel.tsx
components/notebook/SpecialistRoleSelector.tsx
```

### Páginas
```
app/notebooks/page.tsx
app/notebooks/[id]/page.tsx     (usar page_v2.tsx — renombrar)
```

### Reemplazar
```
app/creator-hub/page.tsx        → reemplaza el existente (agrega Notebook Hub entry)
```

---

## 5. Patch en agentes/page.tsx

Agregar al array `AGENTS` en `app/agentes/page.tsx` (antes del entry `creator-hub`):

```typescript
{
  id: "notebooks",
  icon: "📓",
  name: "Notebook Hub",
  description: "Fuentes → Chat especialista → Studio. Crea desde contenido real.",
  color: "from-blue-500 to-indigo-600",
  glow: "rgba(37,99,235,0.15)",
  border: "rgba(37,99,235,0.2)",
  href: "/notebooks",
  tag: "Nuevo",
  status: "active",
  ctaLabel: "Abrir",
},
```

---

## 6. Flujo de uso completo

```
/notebooks            → lista de cuadernos
/notebooks/[id]       → workspace 3 paneles

Panel izquierdo       → Fuentes (URL / texto / PDF / DOCX / búsqueda web)
Panel central         → Chat RAG + Resumen persistente
Panel derecho         → Studio (Infografía / Mapa Mental / Quiz / etc.)
```

**Pipeline por fuente:**
1. Usuario agrega fuente → `POST /api/notebooks/[id]/sources`
2. Ingestión automática → `POST /api/notebooks/[id]/ingest`
   - Extrae texto (fetch/pdf-parse/mammoth)
   - Divide en chunks (~600 tokens con overlap)
   - Genera embeddings (Gemini text-embedding-004)
   - Guarda en `notebook_chunks`
3. Auto-genera resumen → `POST /api/notebooks/[id]/summary`
4. Chat usa RAG → vector search → `match_notebook_chunks()` → contexto al LLM
5. Studio genera desde contexto real → `POST /api/notebooks/[id]/generate`

---

## 7. Arquitectura de la DB

```
notebooks
  └── notebook_sources     (fuentes: url/pdf/docx/txt/text)
        └── notebook_chunks  (texto dividido + embeddings vector(768))
  └── notebook_summaries   (resumen + key_points + glosario)
  └── notebook_messages    (historial de chat con citas)
  └── notebook_outputs     (outputs del Studio guardados)
```

---

## 8. Sprint roadmap

| Sprint | Estado   | Qué incluye |
|--------|----------|-------------|
| 1      | ✅ Listo  | DB, tipos, ingestión, chat RAG, Studio básico, páginas |
| 2      | ✅ Listo  | Búsqueda web (Tavily/DuckDuckGo), web ingest (Firecrawl) |
| 3      | Pendiente | Infografía JSON estructurada mejorada, React Flow mindmap |
| 4      | Pendiente | Conexión con superagente, context bundle, podcast con audio |

---

## 9. Notas de implementación

**Embeddings opcionales:** Si no hay Gemini key, el sistema cae back a keyword search.
El retrieval sigue funcionando, solo sin similitud semántica.

**Streaming de chat:** Usa `callGeminiStream` con fallback a `callAI` no-streaming.
Las citas se envían via header `X-Citations` para no interrumpir el stream.

**Polling de fuentes:** `useNotebook` hace polling cada 3s mientras haya fuentes en
`pending`/`processing`, se detiene automáticamente cuando todas están listas.

**Migración progresiva:** Creator Hub clásico no se rompe. El Notebook Hub aparece
como entrada nueva en `/creator-hub` y en `/agentes`.
