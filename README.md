<div align="center">

```
███████╗██████╗ ██╗   ██╗ █████╗ ██╗
██╔════╝██╔══██╗██║   ██║██╔══██╗██║
█████╗  ██║  ██║██║   ██║███████║██║
██╔══╝  ██║  ██║██║   ██║██╔══██║██║
███████╗██████╔╝╚██████╔╝██║  ██║██║
╚══════╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝
```

### 🎓 Plataforma de Aprendizaje Adaptativo con Inteligencia Artificial

[![Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel)](https://eduaiplatformclon.vercel.app)
![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-blue)

**[🌐 Ver demo en vivo](https://eduaiplatformclon.vercel.app)** · **[📋 Reportar bug](https://github.com/innova-space-edu/eduai-platform/issues)** · **[✨ Solicitar feature](https://github.com/innova-space-edu/eduai-platform/issues)**

</div>

---

## 🗺️ Módulos de la plataforma

<div align="center">

| Módulo | Descripción |
|--------|-------------|
| 🧠 **Agentes de Estudio** | 12 agentes adaptativos: Tutor, Socrático, Evaluador, Gamificación, SM-2 y más |
| 🛠️ **Agentes Especializados** | 14 agentes de dominio: Planificador MINEDUC, Investigador, Matemático, Examen Docente y más |
| 📓 **EduAI Notebooks** | Workspace tipo NotebookLM: fuentes → RAG híbrido → chat especialista → Studio |
| ✨ **Creator Hub** | 13 formatos educativos con plantillas Canva-style generados por IA |
| 🎙️ **Audio Lab v2** | Pipeline de transcripción con 9 operaciones IA y 5 formatos de exportación |
| 🎨 **Image Studio v8** | Generación de imágenes con 5 proveedores y rotación automática de keys |
| 📋 **Exámenes Docente** | Exámenes con IA, link público, supervisión antifraude y análisis pedagógico |
| 🏫 **Planificador MINEDUC** | 113 archivos JSON de OA oficiales · Parvularia → Media |
| 🦾 **EduAI Claw** | Superagente supervisor · 12 skills · Chat Social de agentes · Action Router |
| 📁 **Workspace** | Proyectos para organizar todo el material generado |

</div>

---

## 🤖 Agentes de Estudio (12)

<div align="center">

| Agente | Código | Función |
|--------|--------|---------|
| Tutor General | `AGT` | Responde cualquier tema con orquestador de 6 agentes en paralelo |
| Socrático | `ASc` | Guía mediante preguntas en vez de dar respuestas directas |
| Evaluador | `AEv` | Evalúa comprensión con feedback detallado |
| Adaptativo | `AAD` | Ajusta dificultad automáticamente según desempeño |
| Diagnóstico | `ADL` | Detecta lagunas cognitivas antes de comenzar |
| Repaso SM-2 | `ARE` | Repetición espaciada con algoritmo SuperMemo 2 |
| Gamificación | `AGm` | Transforma el estudio en retos y misiones con XP |
| Memoria Larga | `AML` | Persistencia de contexto entre sesiones de estudio |
| Resumen PDF | `ARe` | Extrae y resume contenido de documentos académicos |
| Voz TTS | `AVN` | Narración en voz alta con Edge TTS (Álvaro / Elvira) |
| Colaborativo | `ACo` | Sala multiusuario hasta 10 personas con IA moderadora |
| Visual IA v2 | `AIm` | Detecta cuándo una respuesta necesita imagen y la genera |

</div>

---

## 🛠️ Agentes Especializados (14)

<div align="center">

| Agente | Función |
|--------|---------|
| 🏫 **Planificador MINEDUC** | Planificaciones rigurosas alineadas al currículum oficial chileno (113 JSONs) |
| 🔬 **Investigador** | Búsqueda web real con Gemini 2.5 Flash + Google Search grounding |
| ✍️ **Redactor** | Textos académicos, informes, cartas con estructura profesional |
| 🧮 **Matemático** | Resolución paso a paso con LaTeX y KaTeX |
| 🌐 **Traductor** | Traducción multiidioma con contexto educativo |
| 📄 **Chat Paper** | Conversación con PDFs académicos (hasta 50 MB) con embeddings y chunking |
| 📝 **Examen Estudiante** | Modo examen completo con timer, corrección IA y nota MINEDUC |
| 📋 **Examen Docente** | Crea pruebas con IA (Groq primario), link público, análisis pedagógico |
| 🎙️ **Audio Lab v2** | Transcripción + 9 operaciones IA + 5 formatos de exportación |
| 🎨 **Image Studio v8** | 5 proveedores de imagen, optimización de prompt con Gemini |
| 🖼️ **Galería** | Historial persistente de imágenes generadas en Supabase Storage |
| ✨ **Creator Hub** | 13 formatos educativos con plantillas Canva-style |
| 📁 **Workspace** | Gestor de proyectos para organizar todo el material |
| 🛡️ **Admin** | Panel de administración completo con métricas, usuarios y reportes |

</div>

---

## 🦾 EduAI Claw — Superagente

<div align="center">

| Componente | Función |
|------------|---------|
| `engine.ts` | Motor principal: decide, valida, ejecuta |
| `router.ts` | Selecciona skill y target óptimos |
| `guardrails.ts` | Bloquea acciones peligrosas |
| `action-router.ts` | Detecta intención del usuario en el chat social |
| `action-executor.ts` | Ejecuta acciones sugeridas de forma segura |
| `draft-engine.ts` | Genera borradores sin tocar producción |
| `social-engine.ts` | Orquesta el chat social entre agentes |

**12 skills:** `observe_user_context` · `route_to_best_agent` · `summarize_goal` · `optimize_prompt` · `repair_failed_call` · `save_memory_snapshot` · `suggest_next_step` · `agent_health_check` · `spawn_agent_discussion` · `extract_ideas_from_social_chat` · `anticipate_user_next_need` · `create_draft_file`

</div>

---

## 📓 EduAI Notebooks — Workspace RAG

<div align="center">

| Componente | Función |
|------------|---------|
| **Panel de fuentes** | URL, PDF, DOCX, texto pegado, búsqueda web (Serper/Tavily/Investigador) |
| **Procesamiento** | Chunking + Contextual RAG + Embeddings en background |
| **Retrieval híbrido** | Vector (pgvector) + BM25 full-text (pg_trgm) → fusión con RRF |
| **Chat especialista** | RAG con citas · fallback al Investigador cuando faltan fuentes |
| **Studio** | 8 formatos desde contenido real: infografía, mapa mental, quiz, podcast con audio, flashcards, timeline, notas Cornell, presentación |
| **Podcast real** | Conectado al agente `podcast-wav` → audio MP3 con Álvaro y Elvira |
| **Imagen en infografía** | Conectado a `visual-detect` + `imagenes` para imagen automática |
| **TTS en chat** | Botón 🔊 en cada respuesta del asistente (Web Speech API) |
| **Source validator** | Puntúa calidad de URLs antes de agregarlas al cuaderno |

</div>

---

## ⚡ Modelos e IAs integradas

<div align="center">

| Proveedor | Modelos | Uso principal |
|-----------|---------|---------------|
| **Google Gemini** | 2.5 Flash · 2.5 Flash-Lite · 2.5 Flash-Image (GA) | Generación, imagen, orquestador, exámenes |
| **Groq** | Llama 3.3 70B Versatile | Examen Docente (primario), Tutor stream |
| **OpenRouter** | 5 modelos imagen · 4 modelos texto | Fallback imagen y exámenes |
| **Together AI** | FLUX.2 Pro · FLUX.2 Flex · FLUX.1 | Imágenes alta calidad |
| **Hugging Face** | FLUX.1 schnell · SDXL | Imágenes open source |
| **Pollinations** | flux · flux-realism · turbo | Imágenes sin API key |
| **Edge TTS** | es-ES-AlvaroNeural · es-ES-ElviraNeural | Podcast MP3, narración TTS |
| **Upstash Redis** | KV Cache | Rate limiting y caché configurable |

</div>

---

## 🧰 Stack tecnológico

<div align="center">

| Categoría | Tecnologías |
|-----------|-------------|
| **Frontend** | Next.js 16.1.6 · React 19.2.3 · TypeScript 5 · Tailwind CSS 4 |
| **Renderizado** | KaTeX 0.16 · Mermaid.js 11.12 · Chart.js 4.5 · react-markdown 10 |
| **Exportación** | PptxGenJS 4.0 · jsPDF 4.2 · xlsx 0.18 · html-to-image 1.11 |
| **Estado** | Zustand 5.0 · TanStack Query 5 · framer-motion 12.34 |
| **Backend** | Next.js API Routes (serverless) · Vercel |
| **Base de datos** | Supabase (PostgreSQL + Auth + Realtime + Storage + pgvector) |
| **Parsing** | Cheerio 1.2 · Mammoth 1.11 · pdf-parse 2.4 |
| **Audio** | @andresaya/edge-tts 1.8 |
| **IA SDKs** | @google/generative-ai 0.24 · groq-sdk 0.37 |

</div>

---

## ¿Qué es EduAI Platform?

EduAI Platform es una plataforma educativa de siguiente generación que combina **25+ agentes de inteligencia artificial especializados**, un **EduAI Claw Superagente** supervisor con red social de agentes y sistema de detección de intención, un **EduAI Notebooks** workspace tipo NotebookLM con RAG híbrido, un **Creator Hub con 13 formatos potenciados por Gemini 2.5 Flash**, un **Audio Lab v2**, un **Image Studio v8 con 5 proveedores**, un **sistema de exámenes para docentes con análisis pedagógico**, y un **panel de administración completo**.

Diseñada para el contexto educativo chileno, incluye cobertura curricular completa del **MINEDUC** con **113 archivos JSON de OA oficiales** y escala de notas 1.0–7.0.

---

## Para estudiantes

- Sesiones de estudio sobre cualquier tema con orquestador de 6 agentes en paralelo
- 4 modos de aprendizaje: Normal, Socrático, Evaluación y Colaborativo
- Quiz adaptativo con dificultad dinámica
- Modo Examen con timer, corrección automática y retroalimentación
- Chat con Papers PDF (hasta 50 MB) con chunking y embeddings
- Visualizaciones automáticas: imágenes IA, diagramas Mermaid, gráficos Chart.js
- Matemáticas con LaTeX renderizado con KaTeX
- Narración por voz (TTS)
- Historial de sesiones con estadísticas
- Repaso espaciado inteligente con algoritmo SM-2

---

## 📓 EduAI Notebooks — detalle

EduAI Notebooks es un workspace de investigación tipo NotebookLM integrado en la plataforma. Permite construir una base de conocimiento desde fuentes verificadas y generar materiales educativos desde ese contenido real.

### Flujo completo

```
1. Agregar fuentes
   URL · PDF · DOCX · TXT · texto pegado · búsqueda web
        ↓
2. Procesamiento automático
   extracción de texto → chunking → Contextual RAG → embeddings background
        ↓
3. Chat con especialista
   Hybrid Retrieval (vector + BM25 → RRF) · citas automáticas
   fallback al Investigador si faltan fuentes
        ↓
4. Studio
   infografía + imagen · mapa mental · quiz · podcast con audio real
   flashcards · timeline · notas Cornell · presentación
```

### RAG híbrido con RRF

El retrieval combina búsqueda vectorial (pgvector) con búsqueda full-text BM25 (pg_trgm) y fusiona los resultados con Reciprocal Rank Fusion, mejorando la calidad de recuperación un 26–31% frente a búsqueda vectorial sola.

### Contextual chunks

Antes de generar el embedding de cada chunk, se prepende el título y la introducción del documento fuente al texto. Esta técnica (Contextual Retrieval de Anthropic) mejora la recuperación aproximadamente un 49%.

### Agentes del sistema integrados

- **Investigador**: enriquece el chat cuando los chunks no son suficientes (Google Search grounding en tiempo real)
- **podcast-wav**: genera audio MP3 real con Álvaro y Elvira desde el script del notebook
- **visual-detect + imagenes**: detecta si el tema necesita imagen y la genera para la infografía
- **Redactor**: pule el resumen generado con estilo académico
- **Summary (Groq Llama 70B)**: generación rápida de resúmenes
- **TTS (Web Speech API)**: lee en voz alta cada respuesta del especialista

### Tablas Supabase

```
notebooks          · notebook_sources  · notebook_chunks
notebook_summaries · notebook_messages · notebook_outputs
```

### Migraciones SQL

```
migration.sql       → 6 tablas + RLS + función match_notebook_chunks() (pgvector)
migration_bm25.sql  → índices GIN + función search_notebook_chunks_fts() (BM25)
```

---

## 🦾 EduAI Claw — detalle

EduAI Claw es el orquestador central de la plataforma. No es un chatbot — es un supervisor autónomo que observa el contexto, detecta intenciones y coordina agentes sin interferir en el chat privado ni en producción.

```
EduAI Claw opera en modo "observe_social_anticipate":
  - Observa lo que el usuario hace y en qué página está
  - Anticipa lo que necesitará a continuación
  - Coordina entre agentes sin invadir el chat privado
  - Propone acciones, nunca las ejecuta sin confirmación del usuario
  - Nunca toca archivos productivos, secretos ni código en producción
```

### Guardrails (no desactivables)

- ❌ No escribe en el chat privado del usuario
- ❌ No sobrescribe archivos productivos
- ❌ No inspecciona ni expone secretos
- ❌ No modifica código automáticamente
- ✅ Solo actúa en `target: "drafts"` para crear contenido
- ✅ Requiere confirmación explícita del usuario

### Chat Social de Agentes (`/ai-social`)

Sala de conversación donde múltiples agentes debaten entre sí sobre el tema del usuario. EduAI Claw detecta la intención del último mensaje y sugiere una acción concreta (crear planificación, examen, guía, infografía, etc.).

**6 salas temáticas:** `#ideas` · `#research` · `#teaching-lab` · `#creative-studio` · `#user-support` · `#anticipation`

### Action Router — Detección de intención

| Intención | Target | Palabras clave |
|-----------|--------|----------------|
| `create_lesson_plan` | `educador` | planificación, OA, MINEDUC, docente |
| `create_exam` | `examen` | examen, prueba, evaluación, preguntas |
| `create_study_guide` | `drafts` | guía, resumen, estudio, apuntes |
| `create_research_outline` | `paper` | investigación, paper, hipótesis |
| `create_math_support` | `matematico` | ecuación, fórmula, derivada |
| `create_visual_material` | `imagenes` | imagen, infografía, afiche, visual |

---

## 🏫 Planificador Curricular MINEDUC

Genera planificaciones rigurosas alineadas al currículum oficial para docentes chilenos.

### Cobertura curricular (113 archivos JSON de OA)

| Nivel | Cursos | Asignaturas |
|-------|--------|-------------|
| **Parvularia** | Sala Cuna · Medio Menor/Mayor · NT1/NT2 | Ámbitos, Núcleos, OA y OAT por subnivel |
| **Básica 1°–8°** | 8 cursos | Matemática · Lenguaje · Ciencias · Historia · Inglés · Tecnología · Artes Visuales · Ed. Física · Música · Orientación |
| **Media** | 1° a 4° Medio | Matemática · Lengua · Biología · Química · Física · Tecnología · Ed. Ciudadana |

### Planificación generada (8 bloques)

Datos generales · Objetivo de Aprendizaje oficial · Indicadores de evaluación · Objetivos de clase · Propósito pedagógico · Planificación sesión a sesión con timing · Evaluación con instrumentos · Adaptaciones y diversidad

---

## 🎙️ Audio Lab v2

```
Audio (MP3/WAV/M4A/MP4/WebM)
    ↓
/api/agents/audio/pipeline
    ├── Modo RÁPIDO → Gemini 2.5 Flash (fallback garantizado)
    └── Modo PRO    → Microservicio externo (Faster-Whisper + WhisperX + pyannote)
    ↓
9 operaciones de edición IA
    ↓
Exportación: TXT · MD · SRT · VTT · JSON
```

**9 operaciones:** Limpiar · Apuntes · Acta · Resumen · Tareas · Capítulos · Highlights · Guía de estudio · Personalizar

---

## 🎨 Image Studio v8

```
Prompt
    ↓ optimizePrompt() — Gemini 2.5 Flash-Lite (condicional)
    ↓
Cadena de proveedores por modo:
  fast:      Pollinations → OpenRouter → Together → HuggingFace
  quality:   Gemini → OpenRouter → Together → HuggingFace → Pollinations
    ↓
Supabase Storage → URL pública en Galería
```

**5 proveedores:** Gemini Imagen (GA) · Pollinations FLUX · Together AI FLUX.2 · Hugging Face · OpenRouter (5 modelos)

---

## 📋 Exámenes para Docentes

Sistema completo con IA para crear pruebas y compartirlas por link público. Los estudiantes rinden sin necesidad de cuenta.

### Cadena de generación

```
Groq Llama 3.3 70B (primario, lotes de 12)
    ↓ fallback
OpenRouter (4 modelos)
    ↓ fallback
Gemini 2.5 Flash
```

**Características:** 3 tipos de pregunta (Alternativas · V/F · Desarrollo) · LaTeX con KaTeX · Escala MINEDUC 1.0–7.0 · Timer configurable · Evaluación IA con puntaje parcial · PDF del estudiante · Dashboard docente con análisis pedagógico

### Sistema antifraude (4 niveles)

Fullscreen obligatorio · bloqueo de teclas y clipboard · política de sanciones progresivas (advertencia → bloqueo 15s → 30s → 60s) · auditoría completa en `exam_incidents` · semáforo de riesgo en panel docente

---

## 🛡️ Panel de Administración

Panel exclusivo en `/admin` para correos registrados en `admin_emails`. Incluye métricas del sistema, gestión de usuarios (XP, nivel, racha, sesiones), reportes de soporte y funciones protegidas con `is_admin()` en PostgreSQL.

---

## AI Router v4

```
lib/ai-router-v4.ts
├── callGeminiStructured()   → JSON garantizado via responseSchema
├── callGeminiMultimodal()   → texto + imagen base64
├── callGeminiImage()        → generación de imágenes nativa
├── callGeminiStream()       → streaming en tiempo real
├── callAICached()           → wrapper con cache Redis
├── runOrchestrator()        → 5 agentes en paralelo + síntesis
├── optimizeImagePrompt()    → optimizador para imágenes
└── detectVisualType()       → AIm v2: tipo/mermaid/chart/image/table
```

---

## Base de Datos (Supabase)

### Tablas del sistema base

```
profiles · study_sessions · long_memory · generated_images
content_creations · flashcard_decks · quiz_sessions · user_xp
teacher_exams · exam_submissions · exam_incidents · saved_plannings
study_rooms · room_members · room_messages · friendships
conversations · chat_messages · notifications · platform_config
spaced_repetition · audio_transcriptions · projects · workspace_items
admin_emails · admin_reports
```

### Tablas EduAI Notebooks

```
notebooks · notebook_sources · notebook_chunks
notebook_summaries · notebook_messages · notebook_outputs
```

### Storage Buckets

```
papers           → Privado (PDFs académicos)
creations        → Público (Creator Hub)
chat-files       → Público (chat social)
workspace-files  → Privado (Workspace)
generated-images → Público (Image Studio)
```

### Migraciones SQL

```
supabase/migrations/
├── 20260226000000_create_spaced_repetition.sql
├── 20260316000000_create_audio_lab.sql
├── 20260316000001_create_workspace.sql
├── 20260401000000_create_admin_system.sql
├── 20260402000000_patch_workspace_item_types.sql
├── 20260403000000_exam_softdelete_admin_fix.sql
├── 20260404000000_exam_submissions_points.sql
└── 20260405000000_create_exam_incidents.sql

migration.sql       → EduAI Notebooks: 6 tablas + pgvector RLS
migration_bm25.sql  → EduAI Notebooks: índices GIN + BM25 RPC
```

---

## Arquitectura del proyecto

```
eduai-platform/
├── app/
│   ├── notebooks/              ← EduAI Notebooks (workspace RAG)
│   │   └── [id]/               ← Workspace 3 paneles: fuentes · chat · studio
│   ├── ai-social/              ← Chat social de agentes (estilo Twitter)
│   ├── superagent/             ← Panel EduAI Claw + DraftCreatorCard
│   ├── agentes/                ← Lista de todos los agentes
│   ├── creator-hub/            ← Creator Hub con 13 formatos + modo Notebook
│   ├── educador/               ← Planificador MINEDUC con 113 JSONs
│   ├── examen/crear/           ← Exámenes docente con LaTeX y Groq primario
│   ├── image-studio/           ← Image Studio v8
│   ├── audio-lab/              ← Audio Lab v2
│   └── dashboard/              ← Dashboard con sidebar de navegación
│
├── app/api/
│   ├── notebooks/              ← CRUD + ingest + chat + generate + embeddings
│   ├── web/                    ← search (Serper→Tavily→Investigador) + ingest
│   ├── agents/                 ← 30+ rutas de agentes especializados
│   └── superagent/             ← EduAI Claw engine + social + drafts
│
├── components/
│   ├── notebook/               ← SourcePanel · NotebookChat · StudioPanel
│   │                              SpecialistRoleSelector · ProcessingIndicator
│   ├── creator-hub/            ← renderers.tsx (13 formatos)
│   └── ui/                     ← ExamMathText · AgentChatLayout · etc.
│
├── lib/
│   ├── notebook/               ← types · prompts · chunking · ingestion (v5)
│   │                              retrieval (RRF) · summarizer · extractor
│   │                              source-validator · safe-fetch
│   ├── superagent/             ← engine · router · guardrails · action-router
│   │                              action-executor · draft-engine · social-engine
│   ├── ai-router-v4.ts         ← Router con 6 proveedores IA
│   ├── image-config.ts         ← 5 proveedores imagen + rotación de keys
│   ├── mineduc-oa.ts           ← 113 JSONs curriculares
│   └── parvularia-suggestions.ts
│
├── hooks/
│   └── useNotebook.ts          ← Estado del workspace con polling automático
│
├── migration.sql               ← EduAI Notebooks: tablas + pgvector
├── migration_bm25.sql          ← EduAI Notebooks: BM25 full-text
└── data/mineduc/               ← 113 JSONs de OA oficiales
    ├── parvularia/             ← 6 subniveles
    ├── basica/                 ← 80 archivos (8 cursos × 10 asignaturas)
    └── media/                  ← 19 archivos (4 cursos)
```

---

## Instalación y desarrollo

### Requisitos previos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)

### 1. Clonar e instalar

```bash
git clone https://github.com/innova-space-edu/eduai-platform.git
cd eduai-platform
npm install
```

### 2. Variables de entorno

```env
# ── Supabase ─────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# ── Gemini (requerido) ───────────────────────────────────────────────
GEMINI_API_KEY=AIzaXxx...
GEMINI_API_KEY_IMAGE=AIzaXxx...
GEMINI_API_KEY_IMAGE_2=AIzaXxx...
GEMINI_API_KEY_PROMPT_1=AIzaXxx...
GEMINI_API_KEY_PROMPT_2=AIzaXxx...

# ── Groq (requerido — primario para exámenes) ────────────────────────
GROQ_API_KEY=gsk_xxx...

# ── OpenRouter (imágenes + fallback exámenes) ────────────────────────
OPENROUTER_API_KEY_1=sk-or-xxx...
OPENROUTER_API_KEY_2=sk-or-xxx...
OPENROUTER_REFERER=https://tu-dominio.vercel.app
OPENROUTER_APP_TITLE=EduAI Platform

# ── Together AI (imágenes) ───────────────────────────────────────────
TOGETHER_API_KEY_1=xxx...
TOGETHER_API_KEY_2=xxx...

# ── Hugging Face (imágenes) ──────────────────────────────────────────
HF_TOKEN_1=hf_xxx...
HF_TOKEN_2=hf_xxx...

# ── EduAI Notebooks — búsqueda web (opcional) ───────────────────────
SERPER_API_KEY=xxx...          # serper.dev — 2500 queries gratis
TAVILY_API_KEY=tvly-xxx...     # tavily.com — 1000 queries/mes gratis
FIRECRAWL_API_KEY=fc-xxx...    # firecrawl.dev — scraping JS rendering

# ── Image Studio — configuración avanzada (opcional) ────────────────
IMAGE_PROVIDER_ORDER_FAST=pollinations,openrouter,together,huggingface
IMAGE_PROVIDER_ORDER_QUALITY=gemini,openrouter,together,huggingface,pollinations
IMAGE_PROMPT_OPTIMIZER_ENABLED=true
IMAGE_PROMPT_OPTIMIZER_MODE=quality_only

# ── Audio Lab v2 — pipeline externo (opcional) ───────────────────────
AUDIO_PIPELINE_URL=http://localhost:8000
AUDIO_PIPELINE_TOKEN=
AUDIO_DEFAULT_MODE=quick

# ── Cache Redis (opcional) ───────────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### 3. Supabase — Migraciones

Ejecutar en **Supabase → SQL Editor** en este orden:

```bash
# Sistema base (en supabase/migrations/ en orden)
20260226000000_create_spaced_repetition.sql
20260316000000_create_audio_lab.sql
20260316000001_create_workspace.sql
20260401000000_create_admin_system.sql
20260402000000_patch_workspace_item_types.sql
20260403000000_exam_softdelete_admin_fix.sql
20260404000000_exam_submissions_points.sql
20260405000000_create_exam_incidents.sql

# EduAI Notebooks
migration.sql         ← tablas + pgvector + RLS
migration_bm25.sql    ← índices GIN + función BM25
```

Crear buckets de Storage:

```
papers          → Privado + RLS
creations       → Público
chat-files      → Público
workspace-files → Privado + RLS
generated-images→ Público
```

Agregar admins:

```sql
INSERT INTO admin_emails (email) VALUES ('tu@correo.cl');
```

### 4. Desarrollo

```bash
npm run dev
```

### 5. Docker — Microservicio de Audio (opcional)

```bash
cd docker/docling
docker-compose up -d
```

---

## Sistema de Gamificación

```
Principiante → Aprendiz → Practicante → Avanzado → Experto → Maestro
    0 XP        100 XP      500 XP       1200 XP    2500 XP   5000 XP
```

---

## Comparación con alternativas

| Feature | EduAI | Khan Academy | ChatGPT Edu | NotebookLM |
|---------|:-----:|:------------:|:-----------:|:----------:|
| Superagente supervisor autónomo | ✅ | ❌ | ❌ | ❌ |
| Chat social entre agentes IA | ✅ | ❌ | ❌ | ❌ |
| EduAI Notebooks con RAG híbrido (RRF) | ✅ | ❌ | ❌ | Parcial |
| Contextual RAG (chunks enriquecidos) | ✅ | ❌ | ❌ | ❌ |
| BM25 full-text + búsqueda vectorial fusionada | ✅ | ❌ | ❌ | ❌ |
| Podcast con audio real desde notebook | ✅ | ❌ | ❌ | ✅ |
| TTS en respuestas del chat especialista | ✅ | ❌ | ❌ | ❌ |
| Source validator con puntaje de calidad | ✅ | ❌ | ❌ | ❌ |
| Imagen automática en infografías | ✅ | ❌ | ❌ | ❌ |
| Multi-agente (25+) | ✅ | ❌ | ❌ | ❌ |
| Orquestador 6 agentes en paralelo | ✅ | ❌ | ❌ | ❌ |
| Planificador MINEDUC con 113 JSONs | ✅ | ❌ | ❌ | ❌ |
| Creator Hub (13 formatos + templates) | ✅ | ❌ | ❌ | ❌ |
| Exámenes docente con link público | ✅ | ❌ | ❌ | ❌ |
| Análisis pedagógico IA post-examen | ✅ | ❌ | ❌ | ❌ |
| Modo supervisión antifraude (4 niveles) | ✅ | ❌ | ❌ | ❌ |
| Image Studio — 5 proveedores | ✅ | ❌ | ❌ | ❌ |
| Audio Lab — pipeline + 9 operaciones IA | ✅ | ❌ | ❌ | ❌ |
| Panel de administración completo | ✅ | ❌ | ❌ | ❌ |
| LaTeX matemático | ✅ | ✅ | ✅ | ❌ |
| Gamificación completa + SM-2 | ✅ | ✅ | ❌ | ❌ |
| Colaborativo multiusuario | ✅ | ❌ | ❌ | ❌ |
| 100% gratuito + open source | ✅ | ✅/❌ | ❌ | ✅/❌ |

---

## Roadmap

### Próximas funcionalidades

- [ ] 🦾 EduAI Claw — persistencia real de sesiones sociales en Supabase
- [ ] 🦾 EduAI Claw — memoria persistente entre sesiones
- [ ] 🦾 EduAI Claw — logs de actividad visibles en panel `/superagent`
- [ ] 📓 EduAI Notebooks — React Flow para mapa mental dinámico
- [ ] 📓 EduAI Notebooks — reranker semántico (ColBERT/BGE) en retrieval
- [ ] 📓 EduAI Notebooks — multiplayer con Supabase Realtime
- [ ] 📑 Creator Hub — layouts avanzados de PPT (two-column, stats-grid)
- [ ] ⏳ Timeline SVG con `causalLinks` como flechas visuales
- [ ] 📇 Modo repaso SM-2 real con scheduling automático
- [ ] 🏆 XP por Creator Hub y Notebooks
- [ ] 📱 App móvil (Capacitor)
- [ ] 📊 Analytics avanzado para docentes
- [ ] 🎛️ Microservicio Faster-Whisper + WhisperX + pyannote para Audio Lab Pro

### Completado ✅

- [x] 📓 **EduAI Notebooks** — workspace RAG completo con 3 paneles
- [x] 📓 **Hybrid Search + RRF** — vector + BM25 full-text fusionados
- [x] 📓 **Contextual RAG** — chunks enriquecidos con contexto del documento
- [x] 📓 **Podcast desde notebook** — conectado al agente `podcast-wav` con audio real
- [x] 📓 **Imagen en infografía** — `visual-detect` + `imagenes` automáticos
- [x] 📓 **TTS en chat** — botón 🔊 en respuestas del especialista
- [x] 📓 **Source validator** — puntaje de calidad de URLs antes de agregar
- [x] 📓 **Investigador como fallback** — Google Search grounding cuando faltan fuentes
- [x] 📓 **Búsqueda web real** — Serper → Tavily → Investigador → DuckDuckGo
- [x] 🦾 **EduAI Claw Superagente** — engine · 12 skills · guardrails · action-router
- [x] 💬 **Chat Social de agentes** — pantalla de inicio temática · 6 salas
- [x] ⚡ **execute-suggested-action** — EduAI Claw ejecuta la acción detectada
- [x] 📋 **Examen Groq Primario** — Llama 3.3 70B primario · 4 modelos fallback
- [x] 🎨 **gemini-2.5-flash-image GA** — modelo oficial en cadena de imagen
- [x] ⚡ **FLUX.2 Pro/Flex en Together AI** — `useAspectRatio` automático
- [x] 🔑 **OpenRouter imagen — 5 modelos** — `modalities` correctas por modelo
- [x] 📚 **113 JSONs curriculares MINEDUC** — Básica completa con 10 asignaturas
- [x] 🎙️ **Audio Lab v2** — pipeline.ts · types.ts · exporters.ts
- [x] 📄 **Examen — PDF del estudiante** — `StudentPdfExporter.tsx`
- [x] 📊 **Análisis pedagógico de examen** — 3 párrafos + contenidos críticos
- [x] 🛡️ **Panel de Administración** — dashboard · usuarios · reportes
- [x] 🔒 **Sistema antifraude de 4 niveles** — ExamGuard · SecurityOverlay · exam_incidents
- [x] 🗑️ **Papelera de exámenes** — soft delete + restaurar
- [x] 📁 **Workspace** — proyectos con IA, archivos, links
- [x] 🤖 **AI Router v4** — callGeminiStructured · callGeminiImage · runOrchestrator
- [x] 🗄️ **Redis/Upstash** — cache configurable con degradación elegante
- [x] 🧠 **Orquestador 6 agentes** en paralelo
- [x] 🤝 **Colaboración multiusuario** (hasta 10)
- [x] 💬 **Chat social tipo Messenger** con presencia en tiempo real

---

## Contribuir

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'feat: descripción'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

---

## Licencia

MIT License — ver [LICENSE](LICENSE) para más detalles.

---

<div align="center">

Desarrollado por **[Innova Space Education 2026](https://innova-space-edu.cl/)**

**[🌐 eduaiplatformclon.vercel.app](https://eduaiplatformclon.vercel.app)**

</div>
