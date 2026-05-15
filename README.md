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
![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react)
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
| 🛠️ **Agentes Especializados** | 18 agentes de dominio: Planificador MINEDUC, Investigador, Matemático, Examen Docente, Music, Video, Admin Model Lab y más |
| 📓 **EduAI Notebooks** | Workspace tipo NotebookLM: fuentes → RAG híbrido → chat especialista → Studio |
| ✨ **Creator Hub** | Formatos educativos con plantillas Canva-style generados por IA |
| 🎙️ **Audio Lab v2** | Pipeline de transcripción con operaciones IA y exportación educativa |
| 🎨 **Image Studio v8** | Generación de imágenes con múltiples proveedores, prompt optimizer y galería |
| 📋 **Exámenes Docente** | Exámenes con IA, link público, temas visuales, PIE/NEE, LaTeX y supervisión antifraude |
| 🏫 **Planificador MINEDUC** | 113 archivos JSON de OA oficiales · Parvularia → Media |
| 🦾 **EduAI Claw** | Superagente supervisor · Tool Registry · Skill System · Chat Global · Action Router |
| 🎵 **EduAI Music Studio** | Música persistente tipo dashboard musical: Jamendo, Audius, iTunes previews, Spotify embeds y playlists |
| 🎬 **Video Studio** | Cola de generación de video educativo desde texto/imagen con proveedores externos configurables |
| 🛡️ **Admin Model Lab** | Laboratorio aislado para modelos experimentales solo para administradores |
| 📁 **Workspace** | Proyectos para organizar todo el material generado |

</div>

---

## 🤖 Agentes de Estudio (12)

<div align="center">

| Agente | Código | Función |
|--------|--------|---------|
| Tutor General | `AGT` | Responde cualquier tema con orquestador de agentes en paralelo |
| Socrático | `ASc` | Guía mediante preguntas en vez de dar respuestas directas |
| Evaluador | `AEv` | Evalúa comprensión con feedback detallado |
| Adaptativo | `AAD` | Ajusta dificultad automáticamente según desempeño |
| Diagnóstico | `ADL` | Detecta lagunas cognitivas antes de comenzar |
| Repaso SM-2 | `ARE` | Repetición espaciada con algoritmo SuperMemo 2 |
| Gamificación | `AGm` | Transforma el estudio en retos y misiones con XP |
| Memoria Larga | `AML` | Persistencia de contexto entre sesiones de estudio |
| Resumen PDF | `ARe` | Extrae y resume contenido de documentos académicos |
| Voz TTS | `AVN` | Narración en voz alta con Edge TTS y endpoint TTS chunk |
| Colaborativo | `ACo` | Sala multiusuario hasta 10 personas con IA moderadora |
| Visual IA v2 | `AIm` | Detecta cuándo una respuesta necesita imagen, diagrama, chart o tabla |

</div>

---

## 🛠️ Agentes Especializados (18)

<div align="center">

| Agente | Ruta | Función |
|--------|------|---------|
| 🏫 **Planificador MINEDUC** | `/educador` | Planificaciones rigurosas alineadas al currículum oficial chileno (113 JSONs) |
| 🔬 **Investigador** | `/investigador` | Búsqueda y síntesis de fuentes académicas y papers |
| ✍️ **Redactor** | `/redactor` | Ensayos, informes, cartas y documentos formales |
| 🧮 **Matemático** | `/matematico` | Resolución paso a paso con notación LaTeX profesional |
| 🌐 **Traductor** | `/traductor` | Traducción multiidioma con explicación lingüística y cultural |
| 📄 **Chat Paper** | `/paper` | Conversación con PDFs académicos con extracción y análisis |
| 📝 **Examen Estudiante** | `/examen` | Modo examen completo con timer, corrección IA y retroalimentación |
| 📋 **Examen Docente** | `/examen/docente` | Crea pruebas con IA, comparte link y recibe notas automáticas |
| 🦅 **Chat Global Claw** | `/chat-global` | Chat central tipo ChatGPT conectado a agentes, código, imagen, video, música y evaluación |
| 🎵 **EduAI Music** | `/music` | Reproductor persistente con biblioteca, playlists, buscador online y Spotify embeds |
| 🎨 **Creator Hub** | `/creator-hub` | Generación de materiales educativos: infografías, PPT, podcast, mapas, flashcards y más |
| 🎙️ **Audio Lab** | `/audio-lab` | Transcribe audio/video, edita y exporta en formatos educativos |
| 🖼️ **Image Studio** | `/image-studio` | Genera imágenes con FLUX, SD, Gemini/OpenRouter/Together y galería |
| 🛡️ **Admin Model Lab** | `/admin/model-lab` | Laboratorio para modelos experimentales solo con rol administrador |
| 🎬 **Video Studio** | `/video-studio` | Generación de videos educativos con cola de trabajos y seguimiento de estado |
| 🖼️ **Galería** | `/galeria` | Historial de imágenes generadas, manuales y automáticas |
| 🏆 **Ranking** | `/ranking` | Tabla de posiciones global con podio, XP y racha |
| 📁 **Workspace** | `/workspace` | Gestor de proyectos para organizar imágenes, audios, transcripciones y documentos |

</div>

---

## 🦾 EduAI Claw — Superagente

<div align="center">

| Componente | Función |
|------------|---------|
| `engine.ts` | Motor principal del superagente: decide, valida y coordina |
| `router.ts` | Selecciona skill y target óptimos |
| `guardrails.ts` | Bloquea acciones peligrosas y protege producción |
| `action-router.ts` | Detecta intención del usuario en chat social y acciones sugeridas |
| `action-executor.ts` | Ejecuta acciones sugeridas de forma segura |
| `draft-engine.ts` | Genera borradores sin tocar producción |
| `social-engine.ts` | Orquesta conversación social entre agentes |
| `superagent-core.ts` | Núcleo retrocompatible para chat global y tool calling |
| `tool-registry.ts` | Registro de herramientas automáticas del SuperAgent |
| `skills/skill-registry.ts` | Skill System con visibilidad por rol: estudiante, docente y admin |

**14 tools:** `generate_exam_questions` · `adapt_for_pie` · `plan_curriculum` · `explain_concept` · `generate_rubric` · `summarize_text` · `translate_text` · `generate_image_prompt` · `generate_image` · `narrate_text` · `generate_edu_video` · `recommend_focus_music` · `generate_code` · `fix_code_error`

**5 skills base:** `exam-pie-builder` · `study-music-session` · `teacher-workflow` · `research-diagram` · `admin-model-lab`

</div>

---

## 💬 Chat Global Claw

<div align="center">

| Elemento | Función |
|----------|---------|
| **Ruta principal** | `/chat-global` |
| **API** | `/api/superagent/chat` |
| **Herramientas** | Exámenes, planificación, imagen, video, música, narración, resumen, traducción, código |
| **Skills rápidas** | Examen PIE/NEE · Música de estudio · Workflow docente · Diagrama académico · Admin Lab |
| **Panel de agentes** | Accesos a Music, Exámenes, Creator Hub, Image Studio, Video Studio y más |
| **Integración flotante** | `components/ui/SuperAgentButton.tsx` con pestaña de chat y música |

</div>

---

## 📓 EduAI Notebooks — Workspace RAG

<div align="center">

| Componente | Función |
|------------|---------|
| **Panel de fuentes** | URL, PDF, DOCX, texto pegado, búsqueda web y fuentes externas |
| **Procesamiento** | Extracción de texto → chunking → contextualización → embeddings |
| **Retrieval híbrido** | Vector (pgvector) + BM25 full-text (pg_trgm) → fusión con RRF |
| **Chat especialista** | RAG con citas · fallback al Investigador cuando faltan fuentes |
| **Studio** | Formatos desde contenido real: infografía, mapa mental, quiz, podcast, flashcards, timeline, notas Cornell, presentación |
| **Podcast real** | Conectado al agente `podcast-wav` → audio MP3 con Álvaro y Elvira |
| **Imagen en infografía** | Conectado a `visual-detect` + `imagenes` para imagen automática |
| **TTS en chat** | Botón 🔊 en cada respuesta del asistente |
| **Source validator** | Puntúa calidad de URLs antes de agregarlas al cuaderno |

</div>

---

## 🎵 EduAI Music Studio

<div align="center">

| Elemento | Estado actual |
|----------|---------------|
| **Ruta** | `/music` |
| **Layout** | Panel izquierdo con biblioteca/listas · centro enfocado solo en canción seleccionada · panel derecho con búsqueda online, resultados y embeds |
| **Reproductor** | Barra inferior persistente con play/pausa, anterior/siguiente, shuffle, repeat, progreso, duración y volumen |
| **Biblioteca interna** | 40 pistas educativas reproducibles con `SoundHelix` como fuente de audio de prueba |
| **Playlists del sistema** | Todas · Focus profundo · Antes de una prueba · STEM/Matemática · Lectura y redacción · Crear proyectos · Trabajo docente |
| **Fuentes online** | Jamendo · Audius · iTunes previews |
| **Playlists externas** | Spotify embeds oficiales configurados por iframe |
| **Jamendo** | `/api/music/search`, `/api/music/jamendo/playlists`, OAuth preparado en `/api/music/jamendo/connect` y `/api/music/jamendo/callback` |
| **Audius** | Búsqueda vía discovery provider configurable con `AUDIUS_API_HOST` |
| **iTunes** | Fallback de previews promocionales con portada y metadata |
| **YouTube** | Solo como enlace externo/futura integración por iframe oficial; no conversión a MP3 |
| **Persistencia** | Estado global con `MusicProvider`; favoritos, cola, volumen, búsqueda y playlist activa en cliente |
| **Dashboard** | Acceso `Música` agregado al panel lateral del dashboard |

</div>

### Flujo musical actual

```
Usuario busca música
    ↓
/api/music/search
    ├── Jamendo   → canciones completas si JAMENDO_CLIENT_ID está configurado
    ├── Audius    → streaming alternativo desde discovery provider
    └── iTunes    → previews como respaldo
    ↓
EduAI Music agrega resultados a “Resultados online”
    ↓
El usuario reproduce, guarda en cola, marca favorito o abre fuente externa
```

### Spotify embeds configurados

La página incluye embeds oficiales de Spotify para playlists entregadas por el usuario. Los iframes funcionan como reproductores embebidos externos dentro del panel derecho, separados del reproductor interno de EduAI Music.

---

## 🎬 Video Studio

<div align="center">

| Componente | Función |
|------------|---------|
| `/video-studio` | Interfaz para texto-a-video e imagen-a-video |
| `/api/agents/video` | Crea jobs de video con moderación básica, deduplicación y límites por plan |
| `/api/agents/video/status/[jobId]` | Devuelve estado, progreso, proveedor, modelo, videoUrl y errores |
| `/api/agents/video/process` | Procesa jobs pendientes con service role y worker/proveedor externo |
| `lib/video-agent.ts` | Procesamiento, fallback, normalización y respuesta de proveedores |
| `lib/video-config.ts` | Duración, modo, fps, ratio y configuración común |
| `components/video/VideoStudioClient.tsx` | UI con subida de imagen, prompt, duración, audio opcional, polling y últimos jobs |
| `wan-worker/` | Base de worker Python para proveedor externo |

</div>

### Estado real

Video Studio ya está integrado como módulo activo y puede crear/consultar jobs. Para generar video real en producción se requiere configurar al menos un proveedor externo y las tablas `video_jobs` / `video_usage_daily` en Supabase.

```
VIDEO_PROVIDER_ORDER=ltx,cogvideox,hunyuan_i2v
VIDEO_CRON_SECRET=pon_un_secreto_largo

LTX_VIDEO_ENDPOINT=https://tu-endpoint-ltx/api/generate
LTX_VIDEO_API_KEY=
LTX_VIDEO_MODEL=Lightricks/LTX-Video

COGVIDEOX_ENDPOINT=https://tu-endpoint-cogvideox/api/generate
COGVIDEOX_API_KEY=
COGVIDEOX_MODEL=zai-org/CogVideoX-5b

HUNYUAN_I2V_ENDPOINT=https://tu-endpoint-hunyuan/api/generate
HUNYUAN_I2V_API_KEY=
HUNYUAN_I2V_MODEL=Tencent-Hunyuan/HunyuanVideo-I2V
```

---

## 🧪 Admin Model Lab

<div align="center">

| Componente | Función |
|------------|---------|
| `/admin/model-lab` | Laboratorio de modelos experimentales solo para administradores |
| `lib/ai/admin-model-policy.ts` | Política de acceso, riesgos y restricciones |
| **Modo seguro** | No disponible para estudiantes ni usuarios normales |
| **Uso futuro** | Evaluación de modelos experimentales/sin censura solo con rol admin, auditoría y filtros |

</div>

---

## 🎨 Sistema de Diseño y Exámenes Visuales

<div align="center">

| Archivo / módulo | Función |
|------------------|---------|
| `DESIGN.md` | Guía visual global: identidad EduAI, componentes, paleta, accesibilidad y estilo Canva educativo |
| `lib/design/design-intelligence.ts` | Recomendaciones de diseño por contexto |
| `lib/exam/theme-utils.ts` | 8 temas claros: clásico, moderno, Canva, PIE calma, TDAH, alto contraste, STEM y kids |
| `components/exam/ExamThemeProvider.tsx` | Inyecta CSS vars y fuentes dinámicas del tema |
| `components/exam/QuestionCard.tsx` | Renderiza alternativas, V/F y desarrollo con imagen, rúbrica y estilos accesibles |
| `components/exam/ExamRenderer.tsx` | Renderer completo con progreso, navegación, timer y preview |
| `components/exam/ExamAudioButton.tsx` | Narración TTS para preguntas, útil en PIE/NEE |

</div>

### Mejoras del creador de exámenes

- Selector de asignatura.
- Temas visuales tipo Canva y modo claro.
- Tipografías accesibles: Inter, Lexend, Atkinson Hyperlegible, Poppins.
- Modo PIE/NEE con perfiles de dislexia, TDAH y baja visión.
- Imagen por pregunta con preview.
- Diseño de opciones más limpio con controles desplegables.
- Render de LaTeX con KaTeX.
- Vista del estudiante más profesional, con progreso, timer, audio y navegación.

---

## ⚡ Modelos e IAs integradas

<div align="center">

| Proveedor | Modelos / uso | Uso principal |
|-----------|---------------|---------------|
| **Google Gemini** | Gemini 2.5 Flash · Flash-Lite · Imagen | Generación, investigación, multimodal, imagen, exámenes |
| **Groq** | Llama 3.3 70B Versatile | Examen Docente primario, tutor stream, resumen rápido |
| **OpenRouter** | Modelos texto + imagen | Fallback para texto, exámenes, coding e imagen |
| **Together AI** | FLUX.2 · FLUX.1 | Imágenes alta calidad |
| **Hugging Face** | FLUX/SDXL y workers opcionales | Imágenes open source, video/voz futuros |
| **Pollinations** | FLUX / turbo | Imágenes sin API key |
| **Edge TTS** | es-ES-AlvaroNeural · es-ES-ElviraNeural | Podcast MP3, narración TTS y audio educativo |
| **Jamendo** | Tracks y playlists | Música completa reproducible con client_id |
| **Audius** | Tracks y streaming | Música online alternativa |
| **iTunes Search** | Previews + metadata | Fallback musical con portada y preview |
| **Spotify Embeds** | Playlists por iframe | Reproducción externa embebida de playlists |
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
| **Estado** | Zustand 5.0 · TanStack Query 5 · framer-motion 12.34 · MusicProvider global |
| **Backend** | Next.js API Routes · `proxy.ts` · Vercel |
| **Base de datos** | Supabase (PostgreSQL + Auth + Realtime + Storage + pgvector) |
| **Parsing** | Cheerio 1.2 · Mammoth 1.11 · pdf-parse 2.4 |
| **Audio** | @andresaya/edge-tts 1.8 · HTML Audio · previews online |
| **IA SDKs** | @google/generative-ai 0.24 · groq-sdk 0.37 |
| **Video / workers** | @fal-ai/client · Puppeteer Core · worker Python base para Wan |
| **UI** | lucide-react · next-themes · Tailwind utilities |

</div>

---

## ¿Qué es EduAI Platform?

EduAI Platform es una plataforma educativa de siguiente generación que combina **30+ módulos, agentes y herramientas de inteligencia artificial**, un **EduAI Claw Superagente** con tool registry y skill system, un **Chat Global tipo ChatGPT**, un **EduAI Notebooks** workspace tipo NotebookLM con RAG híbrido, un **Creator Hub con formatos educativos**, un **Audio Lab v2**, un **Image Studio v8**, un **Music Studio con búsqueda online y playlists**, un **Video Studio con cola de generación**, un **sistema de exámenes docentes con temas Canva/PIE/NEE/LaTeX**, y un **panel de administración con Admin Model Lab**.

Diseñada para el contexto educativo chileno, incluye cobertura curricular completa del **MINEDUC** con **113 archivos JSON de OA oficiales** y escala de notas **1.0–7.0**.

---

## Para estudiantes

- Sesiones de estudio sobre cualquier tema con agentes adaptativos.
- 4 modos de aprendizaje: Normal, Socrático, Evaluación y Colaborativo.
- Quiz adaptativo con dificultad dinámica.
- Modo examen con timer, corrección automática y retroalimentación.
- Chat con Papers PDF y fuentes académicas.
- EduAI Notebooks con fuentes, RAG híbrido, citas y Studio.
- Visualizaciones automáticas: imágenes IA, diagramas Mermaid, gráficos Chart.js y tablas.
- Matemáticas con LaTeX renderizado con KaTeX.
- Narración por voz y audio TTS.
- EduAI Music para concentración: playlists, música online y Spotify embeds.
- Historial de sesiones, XP y ranking.
- Repaso espaciado inteligente con algoritmo SM-2.

---

## Para docentes

- Planificador MINEDUC con OA oficiales.
- Creador de exámenes con IA, LaTeX, V/F, alternativas y desarrollo.
- Temas visuales claros tipo Canva.
- Adecuaciones PIE/NEE: dislexia, TDAH y baja visión.
- Narración de preguntas para accesibilidad.
- Link público para estudiantes.
- Evaluación automática con puntaje parcial.
- Dashboard docente con análisis pedagógico.
- Audio Lab para transcribir clases o reuniones.
- Creator Hub para crear guías, infografías, presentaciones, flashcards y materiales.
- Music Studio para rutinas focus, trabajo docente y ambiente de aula.

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

El retrieval combina búsqueda vectorial (pgvector) con búsqueda full-text BM25 (pg_trgm) y fusiona los resultados con Reciprocal Rank Fusion.

### Contextual chunks

Antes de generar el embedding de cada chunk, se puede enriquecer el texto con contexto del documento fuente para mejorar la recuperación.

### Agentes del sistema integrados

- **Investigador**: enriquece el chat cuando los chunks no son suficientes.
- **podcast-wav**: genera audio MP3 real con Álvaro y Elvira desde scripts educativos.
- **visual-detect + imagenes**: detecta si el tema necesita imagen y la genera para la infografía.
- **Redactor**: pule resúmenes con estilo académico.
- **Summary**: generación rápida de resúmenes.
- **TTS**: lee respuestas en voz alta.

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

EduAI Claw es el orquestador central de la plataforma. No es solo un chatbot: es un supervisor que observa contexto, detecta intenciones, coordina agentes y propone acciones seguras.

```
EduAI Claw opera como superagente:
  - Observa página, contexto y tarea del usuario
  - Detecta intención y selecciona herramientas
  - Puede responder directamente si una tool falla
  - Propone acciones y rutas adecuadas
  - Reutiliza skills según rol: estudiante, docente o admin
  - Mantiene guardrails para evitar acciones peligrosas
```

### Guardrails

- ❌ No expone secretos ni claves.
- ❌ No ejecuta acciones peligrosas sin confirmación.
- ❌ No da acceso a modelos experimentales a estudiantes.
- ✅ Usa tools internas con rutas controladas.
- ✅ Mantiene separación entre chat global, admin y rutas públicas.
- ✅ Rate limit por `proxy.ts` en APIs de agentes y SuperAgent.

### Chat Social de Agentes (`/ai-social`)

Sala donde múltiples agentes pueden debatir ideas y generar propuestas para el usuario. Claw detecta intención y sugiere acciones como crear planificación, examen, guía, infografía, resumen o material visual.

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
| **Básica 1°–8°** | 8 cursos | Matemática · Lenguaje/Lengua · Ciencias · Historia · Inglés · Tecnología · Artes Visuales · Ed. Física · Música · Orientación |
| **Media** | 1° a 4° Medio | Matemática · Lengua · Biología · Química · Física · Tecnología · Ed. Ciudadana |

### Planificación generada

Datos generales · Objetivo de Aprendizaje oficial · Indicadores de evaluación · Objetivos de clase · Propósito pedagógico · Planificación sesión a sesión con timing · Evaluación con instrumentos · Adaptaciones y diversidad.

---

## 🎙️ Audio Lab v2

```
Audio (MP3/WAV/M4A/MP4/WebM)
    ↓
/api/agents/audio/pipeline
    ├── Modo rápido → procesamiento IA desde API routes
    └── Modo PRO    → microservicio externo opcional
    ↓
Operaciones de edición IA
    ↓
Exportación: TXT · MD · SRT · VTT · JSON
```

**Operaciones principales:** limpiar · apuntes · acta · resumen · tareas · capítulos · highlights · guía de estudio · personalizar.

---

## 🎨 Image Studio v8

```
Prompt
    ↓ optimizePrompt() — Gemini / modelo configurado
    ↓
Cadena de proveedores por modo:
  fast:      Pollinations → OpenRouter → Together → HuggingFace
  quality:   Gemini → OpenRouter → Together → HuggingFace → Pollinations
    ↓
Supabase Storage → URL pública en Galería
```

**Proveedores:** Gemini Imagen · Pollinations FLUX · Together AI FLUX · Hugging Face · OpenRouter.

---

## 📋 Exámenes para Docentes

Sistema completo con IA para crear pruebas y compartirlas por link público. Los estudiantes rinden sin necesidad de cuenta.

### Cadena de generación

```
Groq Llama 3.3 70B (primario)
    ↓ fallback
OpenRouter
    ↓ fallback
Gemini 2.5 Flash
```

**Características:** alternativas · verdadero/falso · desarrollo · LaTeX con KaTeX · escala MINEDUC 1.0–7.0 · timer configurable · evaluación IA con puntaje parcial · PDF del estudiante · dashboard docente con análisis pedagógico · temas visuales tipo Canva · modo PIE/NEE · narración de preguntas.

### Sistema antifraude

Fullscreen obligatorio · bloqueo de teclas/clipboard · eventos de seguridad · sesiones con heartbeat · rutas admin de seguridad · semáforo de riesgo · incidencias.

### Rutas principales

```
/examen/crear
/examen/docente
/examen/p/[code]
/api/agents/exam-generate
/api/agents/examen-docente
/api/exam-security/event
/api/exam-security/session/start
/api/exam-security/session/heartbeat
/api/exam-security/admin/dashboard
/api/exam-security/admin/session/[id]
```

---

## 🛡️ Panel de Administración

Panel exclusivo en `/admin` para usuarios administradores. Incluye métricas, gestión de usuarios, reportes, seguridad de exámenes y acceso a laboratorio de modelos.

### Módulos admin actuales

| Ruta | Función |
|------|---------|
| `/admin` | Panel principal |
| `/admin/exam-security` | Centro de monitoreo de seguridad de evaluaciones |
| `/admin/model-lab` | Laboratorio de modelos experimentales aislado |

---

## AI Router v4 / v5

```
lib/ai-router-v4.ts
├── callGeminiStructured()   → JSON garantizado via responseSchema
├── callGeminiMultimodal()   → texto + imagen base64
├── callGeminiImage()        → generación de imágenes nativa
├── callGeminiStream()       → streaming en tiempo real
├── callAICached()           → wrapper con cache Redis
├── runOrchestrator()        → agentes en paralelo + síntesis
├── optimizeImagePrompt()    → optimizador para imágenes
└── detectVisualType()       → AIm v2: tipo/mermaid/chart/image/table

lib/ai-router-v5.ts
├── Routing inteligente por tarea
├── Retrocompatibilidad con v4
├── Soporte para proveedores gratuitos/fallback
└── Preparado para coding, reasoning, fast y long_context
```

---

## Base de Datos (Supabase)

### Tablas del sistema base esperadas por la plataforma

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

### Tablas nuevas/esperadas por módulos recientes

```
video_jobs · video_usage_daily
superagent_conversations · superagent_messages · superagent_memory
superagent_tasks · superagent_tool_calls · superagent_skills
music_playlists · music_playlist_tracks · music_liked_tracks
music_recently_played · music_user_settings
exam_admin_logs · exam_alerts · exam_device_status · exam_lockouts
```

> Nota: algunas tablas recientes están preparadas a nivel de código/roadmap y deben crearse con SQL adicional antes de usarlas en producción completa.

### Storage Buckets

```
papers           → Privado (PDFs académicos)
creations        → Público (Creator Hub)
chat-files       → Público (chat social)
workspace-files  → Privado (Workspace)
generated-images → Público (Image Studio)
video-images     → Privado/Público según política del Video Studio
```

### Migraciones SQL verificadas en el repositorio actual

```
supabase/migrations/20260226000000_create_spaced_repetition.sql
migration.sql       → EduAI Notebooks: 6 tablas + pgvector + RLS
migration_bm25.sql  → EduAI Notebooks: índices GIN + BM25 RPC
```

---

## Arquitectura del proyecto

```
eduai-platform/
├── app/
│   ├── (auth)/                 ← Login, registro y acciones de auth
│   ├── admin/                  ← Admin dashboard · Exam Security · Model Lab
│   ├── agentes/                ← Lista de 18 agentes especializados
│   ├── ai-social/              ← Chat social de agentes
│   ├── audio-lab/              ← Audio Lab v2
│   ├── chat-global/            ← Chat central tipo ChatGPT con SuperAgent
│   ├── creator-hub/            ← Creator Hub con formatos educativos
│   ├── dashboard/              ← Dashboard con sidebar y acceso a Música
│   ├── educador/               ← Planificador MINEDUC con 113 JSONs
│   ├── exam-focus/             ← Modo focus / Pomodoro educativo
│   ├── examen/                 ← Examen estudiante · docente · creador · link público
│   ├── galeria/                ← Galería de imágenes generadas
│   ├── image-studio/           ← Image Studio v8
│   ├── imagenes/               ← Redirección/compatibilidad hacia Image Studio
│   ├── music/                  ← EduAI Music Studio
│   ├── notebooks/              ← EduAI Notebooks (workspace RAG)
│   ├── superagent/             ← Panel y chat EduAI Claw
│   ├── video-studio/           ← Video Studio con cola de trabajos
│   └── workspace/              ← Gestión de proyectos
│
├── app/api/
│   ├── agents/                 ← 30+ rutas de agentes especializados
│   ├── music/                  ← search · providers · jamendo OAuth/playlists
│   ├── notebooks/              ← CRUD + ingest + chat + generate + embeddings
│   ├── exam-security/          ← sesión, eventos, heartbeat y admin security
│   ├── superagent/             ← chat · drafts · skills · social
│   ├── uploads/                ← subida para video-image
│   └── web/                    ← search + ingest
│
├── components/
│   ├── exam/                   ← ExamRenderer · QuestionCard · ThemeProvider · AudioButton
│   ├── exam-security/          ← ExamSecurityClient · Bridge · Overlay
│   ├── music/                  ← EduAIMusicPlayer · MusicProvider
│   ├── notebook/               ← SourcePanel · NotebookChat · StudioPanel
│   ├── superagent/             ← SuperAgentChat · DraftCreatorCard
│   ├── video/                  ← VideoStudioClient
│   └── ui/                     ← AgentChatLayout · ExamMathText · SuperAgentButton · etc.
│
├── lib/
│   ├── agents/                 ← exam · design · accessibility · video · voice · music · coding
│   ├── ai/                     ← admin-model-policy
│   ├── audio/                  ← pipeline · types · exporters · config
│   ├── design/                 ← design-intelligence
│   ├── exam/                   ← theme-utils
│   ├── exam-security/          ← policy · scoring · session · client-end
│   ├── music/                  ← eduai-music-catalog
│   ├── notebook/               ← types · prompts · chunking · ingestion · retrieval · summarizer
│   ├── superagent/             ← engine · router · guardrails · tools · skills · social
│   ├── video-agent.ts          ← proceso de generación de video
│   ├── video-config.ts         ← configuración de video
│   ├── ai-router-v4.ts
│   ├── ai-router-v5.ts
│   ├── image-config.ts
│   ├── mineduc-oa.ts
│   └── planificador-curriculum.ts
│
├── proxy.ts                    ← Auth refresh, protección de rutas y rate limiting
├── DESIGN.md                   ← Sistema de diseño global EduAI
├── migration.sql               ← EduAI Notebooks: tablas + pgvector
├── migration_bm25.sql          ← EduAI Notebooks: BM25 full-text
└── data/mineduc/               ← 113 JSONs de OA oficiales
    ├── parvularia/
    ├── basica/
    └── media/
```

---

## Instalación y desarrollo

### Requisitos previos

- Node.js 22+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en Vercel para deploy
- API keys según módulos que quieras activar

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
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
SUPABASE_URL=https://xxxx.supabase.co

# ── App / Vercel ─────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://eduaiplatformclon.vercel.app
VERCEL_URL=eduaiplatformclon.vercel.app

# ── Gemini ───────────────────────────────────────────────────────────
GEMINI_API_KEY=AIzaXxx...
GEMINI_API_KEY_IMAGE=AIzaXxx...
GEMINI_API_KEY_IMAGE_2=AIzaXxx...
GEMINI_API_KEY_PROMPT_1=AIzaXxx...
GEMINI_API_KEY_PROMPT_2=AIzaXxx...

# ── Groq ─────────────────────────────────────────────────────────────
GROQ_API_KEY=gsk_xxx...

# ── OpenRouter ───────────────────────────────────────────────────────
OPENROUTER_API_KEY_1=sk-or-xxx...
OPENROUTER_API_KEY_2=sk-or-xxx...
OPENROUTER_REFERER=https://tu-dominio.vercel.app
OPENROUTER_APP_TITLE=EduAI Platform

# ── Together AI ──────────────────────────────────────────────────────
TOGETHER_API_KEY_1=xxx...
TOGETHER_API_KEY_2=xxx...

# ── Hugging Face ─────────────────────────────────────────────────────
HF_TOKEN_1=hf_xxx...
HF_TOKEN_2=hf_xxx...

# ── EduAI Notebooks — búsqueda web ──────────────────────────────────
SERPER_API_KEY=xxx...
TAVILY_API_KEY=tvly-xxx...
FIRECRAWL_API_KEY=fc-xxx...

# ── Image Studio ─────────────────────────────────────────────────────
IMAGE_PROVIDER_ORDER_FAST=pollinations,openrouter,together,huggingface
IMAGE_PROVIDER_ORDER_QUALITY=gemini,openrouter,together,huggingface,pollinations
IMAGE_PROMPT_OPTIMIZER_ENABLED=true
IMAGE_PROMPT_OPTIMIZER_MODE=quality_only

# ── Audio Lab v2 ─────────────────────────────────────────────────────
AUDIO_PIPELINE_URL=http://localhost:8000
AUDIO_PIPELINE_TOKEN=
AUDIO_DEFAULT_MODE=quick

# ── EduAI Music ──────────────────────────────────────────────────────
JAMENDO_CLIENT_ID=tu_client_id
JAMENDO_CLIENT_SECRET=tu_client_secret_solo_si_usas_oauth
JAMENDO_REDIRECT_URI=https://eduaiplatformclon.vercel.app/api/music/jamendo/callback
AUDIUS_API_HOST=https://discoveryprovider.audius.co

# ── Video Studio ─────────────────────────────────────────────────────
VIDEO_PROVIDER_ORDER=ltx,cogvideox,hunyuan_i2v
VIDEO_CRON_SECRET=pon_un_secreto_largo
CRON_SECRET=pon_un_secreto_largo
LTX_VIDEO_ENDPOINT=https://tu-endpoint-ltx/api/generate
LTX_VIDEO_API_KEY=
LTX_VIDEO_MODEL=Lightricks/LTX-Video
COGVIDEOX_ENDPOINT=https://tu-endpoint-cogvideox/api/generate
COGVIDEOX_API_KEY=
COGVIDEOX_MODEL=zai-org/CogVideoX-5b
HUNYUAN_I2V_ENDPOINT=https://tu-endpoint-hunyuan/api/generate
HUNYUAN_I2V_API_KEY=
HUNYUAN_I2V_MODEL=Tencent-Hunyuan/HunyuanVideo-I2V

# ── Cache Redis / Rate limiting ─────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### 3. Supabase — Migraciones verificadas

Ejecutar en **Supabase → SQL Editor**:

```bash
# Sistema base disponible en el repo actual
supabase/migrations/20260226000000_create_spaced_repetition.sql

# EduAI Notebooks
migration.sql
migration_bm25.sql
```

Crear buckets de Storage:

```
papers           → Privado + RLS
creations        → Público
generated-images → Público
chat-files       → Público
workspace-files  → Privado + RLS
video-images     → Según política del Video Studio
```

Agregar admins:

```sql
INSERT INTO admin_emails (email) VALUES ('tu@correo.cl');
```

### 4. Desarrollo

```bash
npm run dev
```

### 5. Build y producción

```bash
npm run build
npm run start
```

### 6. Docker — Microservicio de Audio (opcional)

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

| Feature | EduAI | Khan Academy | ChatGPT Edu | NotebookLM | Spotify/Apps música |
|---------|:-----:|:------------:|:-----------:|:----------:|:-------------------:|
| Superagente supervisor con tools | ✅ | ❌ | Parcial | ❌ | ❌ |
| Chat Global tipo ChatGPT conectado a agentes | ✅ | ❌ | ✅ | ❌ | ❌ |
| Chat social entre agentes IA | ✅ | ❌ | ❌ | ❌ | ❌ |
| EduAI Notebooks con RAG híbrido (RRF) | ✅ | ❌ | ❌ | Parcial | ❌ |
| Contextual RAG / chunks enriquecidos | ✅ | ❌ | ❌ | Parcial | ❌ |
| BM25 full-text + búsqueda vectorial fusionada | ✅ | ❌ | ❌ | ❌ | ❌ |
| Podcast con audio real desde notebook | ✅ | ❌ | ❌ | ✅ | ❌ |
| TTS en respuestas educativas | ✅ | ❌ | ✅ | ❌ | ❌ |
| Source validator con puntaje de calidad | ✅ | ❌ | ❌ | ❌ | ❌ |
| Imagen automática en infografías | ✅ | ❌ | ✅ | ❌ | ❌ |
| Multi-agente educativo | ✅ | ❌ | Parcial | ❌ | ❌ |
| Planificador MINEDUC con 113 JSONs | ✅ | ❌ | ❌ | ❌ | ❌ |
| Creator Hub con formatos educativos | ✅ | ❌ | Parcial | ❌ | ❌ |
| Exámenes docente con link público | ✅ | ❌ | ❌ | ❌ | ❌ |
| Análisis pedagógico IA post-examen | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modo supervisión antifraude | ✅ | ❌ | ❌ | ❌ | ❌ |
| Image Studio con múltiples proveedores | ✅ | ❌ | ✅ | ❌ | ❌ |
| Audio Lab con operaciones IA | ✅ | ❌ | Parcial | ❌ | ❌ |
| Music Studio con playlists educativas | ✅ | ❌ | ❌ | ❌ | ✅ |
| Jamendo/Audius/iTunes en buscador musical | ✅ | ❌ | ❌ | ❌ | Parcial |
| Spotify embeds dentro de plataforma | ✅ | ❌ | ❌ | ❌ | ✅ |
| Video Studio con jobs y workers | ✅ | ❌ | Parcial | ❌ | ❌ |
| Panel de administración completo | ✅ | ❌ | ❌ | ❌ | ❌ |
| LaTeX matemático | ✅ | ✅ | ✅ | ❌ | ❌ |
| Gamificación completa + SM-2 | ✅ | ✅ | ❌ | ❌ | ❌ |
| Colaborativo multiusuario | ✅ | ❌ | ❌ | ❌ | ❌ |
| Open source / deploy propio | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Roadmap

### Próximas funcionalidades

- [ ] 🦾 EduAI Claw — persistencia real de conversaciones del Chat Global en Supabase
- [ ] 🦾 EduAI Claw — memoria persistente entre sesiones
- [ ] 🦾 EduAI Claw — panel de logs de tool calls en `/superagent`
- [ ] 🧰 SuperAgent — task queue y workflows largos
- [ ] 🧰 SuperAgent — sandbox/coding agent seguro estilo OpenHands
- [ ] 📓 EduAI Notebooks — React Flow para mapa mental dinámico
- [ ] 📓 EduAI Notebooks — reranker semántico en retrieval
- [ ] 📓 EduAI Notebooks — multiplayer con Supabase Realtime
- [ ] 📑 Creator Hub — layouts avanzados de PPT y PDF estilo Canva
- [ ] ⏳ Timeline SVG con flechas visuales y `causalLinks`
- [ ] 📇 Modo repaso SM-2 real con scheduling automático
- [ ] 🏆 XP por Creator Hub, Music Studio y Notebooks
- [ ] 🎵 EduAI Music — persistencia completa en Supabase: playlists, favoritos, historial y cola
- [ ] 🎵 EduAI Music — búsqueda multifuente con selección avanzada por proveedor y licencia
- [ ] 🎵 EduAI Music — integración YouTube solo por IFrame oficial, sin conversión MP3
- [ ] 🎬 Video Studio — migración `video_jobs` + `video_usage_daily`
- [ ] 🎬 Video Studio — conectar primer proveedor real LTX/Wan/CogVideoX/Hunyuan
- [ ] 🎬 Video Studio — worker con ffmpeg para unir TTS + video
- [ ] 🛡️ Admin Model Lab — auditoría completa por prompt/modelo/usuario
- [ ] 🛡️ Admin Model Lab — filtros input/output para modelos experimentales
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
- [x] 📓 **Investigador como fallback** — búsqueda web cuando faltan fuentes
- [x] 📓 **Búsqueda web real** — Serper/Tavily/Investigador y rutas `/api/web/*`
- [x] 🦾 **EduAI Claw Superagente** — engine · tool registry · guardrails · action-router
- [x] 🦾 **Skill System inicial** — skills por rol: all/teacher/admin
- [x] 💬 **Chat Global Claw** — ruta `/chat-global` + `/api/superagent/chat`
- [x] 💬 **Chat Social de agentes** — pantalla temática y salas
- [x] ⚡ **execute-suggested-action** — EduAI Claw ejecuta acciones detectadas
- [x] 📋 **Examen Groq Primario** — Llama 3.3 70B primario con fallback
- [x] 🎨 **Sistema visual de exámenes** — temas claros, Canva, PIE/NEE y LaTeX
- [x] 🔊 **Narración de preguntas** — `ExamAudioButton` + `tts-chunk`
- [x] 🎨 **Image Studio v8** — cadena multi-proveedor + galería
- [x] 📚 **113 JSONs curriculares MINEDUC** — Parvularia, Básica y Media
- [x] 🎙️ **Audio Lab v2** — pipeline.ts · types.ts · exporters.ts
- [x] 📄 **Examen — PDF del estudiante** — exportación y análisis
- [x] 📊 **Análisis pedagógico de examen** — contenidos críticos y feedback docente
- [x] 🛡️ **Panel de Administración** — dashboard · usuarios · reportes
- [x] 🛡️ **Exam Security Admin** — panel de monitoreo y acciones administrativas
- [x] 🔒 **Sistema antifraude** — ExamGuard · SecurityOverlay · exam_incidents
- [x] 🧪 **Admin Model Lab** — ruta aislada para modelos experimentales solo admin
- [x] 🎵 **EduAI Music Studio** — layout de 3 paneles + centro enfocado en canción seleccionada
- [x] 🎵 **MusicProvider global** — reproducción persistente al navegar
- [x] 🎵 **Jamendo Provider** — búsqueda real y playlists/tracks con `JAMENDO_CLIENT_ID`
- [x] 🎵 **Audius Provider** — búsqueda de tracks vía discovery provider
- [x] 🎵 **iTunes previews** — fallback de música con portada/metadata
- [x] 🎵 **Spotify embeds** — playlists oficiales insertadas por iframe
- [x] 🎬 **Video Studio base** — UI, jobs, status, process endpoint y worker base
- [x] 📁 **Workspace** — proyectos con IA, archivos, links
- [x] 🤖 **AI Router v4/v5** — structured, multimodal, stream, cached y routing por tarea
- [x] 🗄️ **Redis/Upstash** — cache/rate limit configurable con degradación elegante
- [x] 🧠 **Orquestador de agentes** en paralelo
- [x] 🤝 **Colaboración multiusuario**
- [x] 💬 **Chat social tipo Messenger** con presencia en tiempo real
- [x] 🧭 **proxy.ts** — migración desde middleware, auth refresh y protección de rutas
- [x] 🎨 **DESIGN.md** — sistema de diseño global EduAI

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
