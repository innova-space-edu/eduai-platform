<div align="center">

```
███████╗██████╗ ██╗   ██╗ █████╗ ██╗
██╔════╝██╔══██╗██║   ██║██╔══██╗██║
█████╗  ██║  ██║██║   ██║███████║██║
██╔══╝  ██║  ██║██║   ██║██╔══██║██║
███████╗██████╔╝╚██████╔╝██║  ██║██║
╚══════╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝
```

### 🎓 Ecosistema Educativo Inteligente Multiagente y Multimodal

[![CI](https://github.com/innova-space-edu/eduai-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/innova-space-edu/eduai-platform/actions/workflows/ci.yml)
[![Currículum MINEDUC](https://github.com/innova-space-edu/eduai-platform/actions/workflows/curriculum-validation.yml/badge.svg)](https://github.com/innova-space-edu/eduai-platform/actions/workflows/curriculum-validation.yml)
[![Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel)](https://eduaiplatformclon.vercel.app)
![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-blue)

**[🌐 Ver plataforma](https://eduaiplatformclon.vercel.app)** · **[📋 Reportar un problema](https://github.com/innova-space-edu/eduai-platform/issues)** · **[✨ Solicitar una función](https://github.com/innova-space-edu/eduai-platform/issues)**

</div>

---

## 📌 Estado verificado del proyecto

Este README fue reconstruido a partir del código de la rama `main` y del ZIP actualizado del proyecto.

<div align="center">

| Indicador | Estado actual |
|-----------|---------------|
| **Páginas de aplicación** | 69 rutas `page.tsx` |
| **APIs internas** | 120 rutas `route.ts` |
| **Agentes y módulos visibles** | 20 entradas activas en `/agentes` |
| **Herramientas de EduAI Claw** | 16 tools ejecutables |
| **Skills del Superagente** | 12 skills registradas |
| **Formatos de Creator Hub** | 13 formatos educativos |
| **Currículo MINEDUC operativo** | 105 archivos JSON validados en modo estricto |
| **Dependencias** | 35 de producción + 10 de desarrollo |
| **Migraciones SQL incluidas** | 8 archivos SQL |
| **Runtime principal** | Next.js 16 · React 19 · Node.js 22 · TypeScript 5 |

</div>

> El índice curricular operativo contiene 105 archivos: 6 de Parvularia, 80 de Educación Básica y 19 de Educación Media. Se valida con `npm run test:curriculum`.

---

## 🧭 Contenidos

1. [Descripción general](#-descripción-general)
2. [Mapa de módulos](#-mapa-de-módulos)
3. [Agentes activos](#-agentes-activos)
4. [EduAI Claw](#-eduai-claw--superagente)
5. [Open EDUAI Work](#-open-eduai-work)
6. [Planificación MINEDUC](#-planificador-mineduc)
7. [Notebooks, RAG y Chat Paper](#-notebooks-rag-y-chat-paper)
8. [Creación educativa](#-creator-hub-cuaderno-creativo-y-qr-studio)
9. [Pizarra y Matemática](#-pizarra-interactiva-y-matemática)
10. [Exámenes](#-sistema-de-exámenes)
11. [Audio, voz y MIRA](#-audio-lab-voces-y-mira)
12. [Imagen, video y música](#-imagen-video-y-música)
13. [Colaboración y administración](#-colaboración-gamificación-y-administración)
14. [Arquitectura](#-arquitectura-general)
15. [Base de datos](#-base-de-datos-y-migraciones)
16. [Variables de entorno](#-variables-de-entorno)
17. [Instalación](#-instalación-y-desarrollo)
18. [CI/CD](#-cicd-y-mantenimiento)
19. [Seguridad y accesibilidad](#-seguridad-privacidad-y-accesibilidad)
20. [Créditos](#-créditos-y-licencia)

---

## 🚀 Descripción general

**EduAI Platform** es una plataforma educativa chilena que reúne aprendizaje adaptativo, agentes especializados, investigación con fuentes, planificación curricular, creación de recursos, evaluación digital, colaboración y herramientas multimedia.

La plataforma está diseñada para que estudiantes y docentes puedan pasar de una pregunta o una fuente a un producto educativo completo: explicación, planificación, prueba, informe, presentación, hoja de cálculo, audio, podcast, imagen, video, código QR o proyecto organizado.

### Objetivos

- Apoyar el aprendizaje personalizado y la autonomía estudiantil.
- Entregar herramientas docentes alineadas al currículo oficial chileno.
- Integrar IA generativa, búsqueda, fuentes y creación en un mismo espacio.
- Incorporar adaptaciones PIE/NEE, narración, alto contraste y apoyos visuales.
- Mantener los trabajos, archivos y resultados organizados por usuario y proyecto.

### Perfiles

| Perfil | Capacidades principales |
|--------|--------------------------|
| **Estudiante** | Tutoría, diagnóstico, modo socrático, práctica, pizarra, Notebooks, exámenes, música, XP y colaboración |
| **Docente** | Planificación MINEDUC, pruebas, rúbricas, Creator Hub, Audio Lab, QR Studio, investigación y Workspace |
| **Administrador** | Usuarios, seguridad, códigos, reportes, auditoría, proveedores y Admin Model Lab |

---

## 🗺️ Mapa de módulos

<div align="center">

| Módulo | Ruta principal | Función |
|--------|----------------|---------|
| 🏠 **Dashboard** | `/dashboard` | Inicio, métricas, sesiones y accesos rápidos |
| 📚 **Sesión de estudio** | `/study/[topic]` | Teoría, ejemplos, diagnóstico, quiz, resumen y modo socrático |
| 🤖 **Agentes** | `/agentes` | Catálogo de agentes y espacios especializados |
| ✦ **Open EDUAI Work** | `/chat-global` | Preguntar, investigar, crear, colaborar y ejecutar |
| 🦾 **EduAI Claw** | `/superagent` | Orquestación, herramientas, skills, acciones y guardrails |
| 🏫 **Planificador** | `/educador` | Planificaciones alineadas a OA MINEDUC |
| 🗓️ **Planificador curricular** | `/educador/planificador-curricular` | Planificación diaria, semanal, mensual, semestral y anual |
| 📓 **EduAI Notebooks** | `/notebooks` | Fuentes, RAG híbrido, chat con citas y Studio |
| 📄 **Chat Paper** | `/paper` | Lectura y conversación con PDF |
| 🎨 **Creator Hub** | `/creator-hub` | 13 formatos educativos y Labs creativos |
| 🖍️ **Cuaderno Creativo** | `/cuaderno-creativo` | Dibujo, pintura y biblioteca privada de plantillas |
| ✍️ **Pizarra Interactiva** | `/pizarra-interactiva` | Escritura manual, reconocimiento matemático y LaTeX |
| 🌐 **MIRA** | `/traductor` | Traducción escrita, interpretación de voz y conversación bilingüe |
| 📝 **Exámenes** | `/examen` | Simulacro, creación docente, publicación, revisión y resultados |
| 🎙️ **Audio Lab** | `/audio-lab` | Transcripción, edición, operaciones IA, exportación y voces |
| 🖼️ **Image Studio** | `/image-studio` | Generación de imágenes multi-proveedor y galería |
| 🎬 **Video Studio** | `/video-studio` | Texto-a-video, imagen-a-video, jobs y estado |
| 🎵 **EduAI Music** | `/music` | Reproductor persistente, playlists y búsqueda externa |
| ▦ **QR Studio** | `/qr-studio` | Recursos compartibles, vencimiento, escaneos y PNG |
| 📁 **Workspace** | `/workspace` | Proyectos, archivos, enlaces y materiales |
| 💬 **Colaboración** | `/collab` | Salas multiusuario con apoyo de IA |
| 🧠 **Chat social** | `/ai-social` | Conversación entre agentes y extracción de ideas |
| 🏆 **Ranking** | `/ranking` | XP, rachas, logros y posiciones |
| 🛡️ **Administración** | `/admin` | Usuarios, exámenes, seguridad, códigos y Model Lab |

</div>

---

## 🤖 Agentes activos

La página `/agentes` registra 20 entradas activas.

| # | Agente o espacio | Ruta | Función |
|--:|------------------|------|---------|
| 1 | Planificador | `/educador` | Planificación docente MINEDUC |
| 2 | Investigador | `/investigador` | Búsqueda y síntesis de fuentes |
| 3 | Redactor | `/redactor` | Ensayos, informes y documentos |
| 4 | Matemático | `/matematico` | Resolución paso a paso con LaTeX |
| 5 | Pizarra Interactiva | `/pizarra-interactiva` | Reconocimiento de procedimientos manuscritos |
| 6 | Cuaderno Creativo | `/cuaderno-creativo` | Dibujo, coloreado y plantillas |
| 7 | MIRA Traductor | `/traductor` | Texto, voz y conversación bilingüe |
| 8 | Chat Paper | `/paper` | Conversación con PDF |
| 9 | Examen | `/examen` | Simulacros con corrección |
| 10 | Exámenes Docente | `/examen/docente` | Creación, publicación y revisión |
| 11 | Open EDUAI Work | `/chat-global` | Espacio integral conectado a Claw |
| 12 | EduAI Music | `/music` | Música y reproducción persistente |
| 13 | Creator Hub | `/creator-hub` | Materiales educativos y multimedia |
| 14 | Audio Lab | `/audio-lab` | Transcripción, edición y voces |
| 15 | Image Studio | `/image-studio` | Imágenes IA multi-proveedor |
| 16 | Admin Model Lab | `/admin/model-lab` | Modelos experimentales aislados |
| 17 | Video Studio | `/video-studio` | Generación y seguimiento de video |
| 18 | Galería | `/galeria` | Historial de imágenes |
| 19 | Ranking | `/ranking` | XP y rachas |
| 20 | Workspace | `/workspace` | Organización de proyectos |

El flujo `/study/[topic]` agrega tutoría, diagnóstico, modo socrático, evaluación, adaptación de dificultad, visualización, resumen, narración, memoria, colaboración y repetición espaciada SM-2.

---

## 🦾 EduAI Claw — Superagente

EduAI Claw coordina herramientas, agentes, contexto, seguridad y ejecución de acciones.

| Componente | Función |
|------------|---------|
| `engine.ts` | Motor principal de coordinación |
| `router.ts` | Selección de skill, tool y destino |
| `guardrails.ts` | Prevención de acciones inseguras |
| `action-router.ts` | Detección de intención y acciones sugeridas |
| `action-executor.ts` | Ejecución controlada |
| `draft-engine.ts` | Generación de borradores sin tocar producción |
| `social-engine.ts` | Conversación entre agentes |
| `superagent-core.ts` | Núcleo de chat y tool calling |
| `tool-registry.ts` | Registro central de herramientas |
| `skills/skill-registry.ts` | Skills visibles por rol |

### 16 herramientas verificadas

`generate_exam_questions` · `adapt_for_pie` · `plan_curriculum` · `explain_concept` · `generate_rubric` · `summarize_text` · `translate_text` · `generate_image_prompt` · `generate_image` · `narrate_text` · `generate_edu_video` · `recommend_focus_music` · `generate_code` · `fix_code_error` · `create_podcast` · `correct_text`

### 12 skills registradas

Las skills cubren creación de exámenes PIE, sesiones musicales, flujos docentes, investigación con diagramas, administración de modelos, generación creativa, análisis de fuentes, producción multimedia y tareas de Open EDUAI Work. La visibilidad se controla por rol.

---

## ✦ Open EDUAI Work

Open EDUAI Work reemplaza la experiencia de chat aislado por un espacio de trabajo conectado a todo el ecosistema.

| Capacidad | Implementación |
|-----------|----------------|
| **Modos** | Preguntar · Investigar · Crear · Colaborar · Ejecutar |
| **Fuentes** | Web, archivos adjuntos, cuaderno activo y biblioteca lateral |
| **Archivos** | Lectura y procesamiento de PDF, DOCX, texto, audio e imágenes compatibles |
| **Creación** | Imágenes, audio, podcast, exámenes, planificaciones, código y recursos |
| **Exportación** | PDF, presentación y Excel según el resultado |
| **Contexto** | Conversaciones, tareas, resultados y fuentes persistentes |
| **Colaboración** | Acceso a salas y recursos compartidos |
| **Motor** | Conserva Claw, sus tools, skills y guardrails |

APIs principales:

```text
/api/superagent/chat
/api/work/context
/api/work/research
```

---

## 🏫 Planificador MINEDUC

El Planificador permite construir experiencias pedagógicas vinculadas a Objetivos de Aprendizaje oficiales.

### Cobertura curricular verificada

| Nivel | Archivos operativos |
|-------|--------------------:|
| Parvularia | 6 |
| Educación Básica | 80 |
| Educación Media | 19 |
| **Total** | **105** |

### Funciones

- Selección de nivel, asignatura, OA, unidad y duración.
- Planificaciones diarias, semanales, mensuales, semestrales y anuales.
- Objetivos, indicadores, inicio, desarrollo, cierre y evaluación.
- Actividades, recursos, preguntas, adecuaciones y evidencia.
- Coincidencia contextual mediante sinónimos de contenidos y OA.
- Auditoría de calidad estructurada.
- Validación estricta durante CI y build.

Comandos:

```bash
npm run curriculum:index
npm run curriculum:validate
npm run test:curriculum
npm run planner:maintain
npm run test:planner
```

---

## 📓 Notebooks, RAG y Chat Paper

EduAI Notebooks transforma fuentes reales en un espacio de investigación y creación.

| Etapa | Función |
|-------|---------|
| **Ingesta** | URL, PDF, DOCX, texto pegado, búsqueda web y fuentes externas |
| **Procesamiento** | Extracción, chunking, contextualización y embeddings |
| **Retrieval** | Vector con pgvector + búsqueda BM25/full-text |
| **Fusión** | Reciprocal Rank Fusion para ordenar resultados |
| **Chat** | Respuestas con citas y contexto del cuaderno |
| **Studio** | Infografía, mapa mental, quiz, podcast, flashcards, timeline, Cornell y presentación |
| **Audio** | Podcast y narración TTS |
| **Control** | Validación de URL, ownership y calidad de fuentes |

**Chat Paper** complementa el sistema con una experiencia directa para subir PDF, extraer contenido, preguntar, resumir y analizar documentos académicos.

---

## 🎨 Creator Hub, Cuaderno Creativo y QR Studio

### Creator Hub

Creator Hub incluye 13 formatos educativos y una navegación simplificada con búsqueda y catálogo.

- Infografía.
- Presentación.
- Podcast.
- Mapa mental.
- Flashcards.
- Línea de tiempo.
- Quiz.
- Notas Cornell.
- Guía o documento.
- Material visual.
- Storyboard o manga.
- Recurso interactivo.
- Formato creativo asistido por IA.

También integra generación, edición, guardado, Labs, materiales compartibles y conexión con otros módulos.

### Cuaderno Creativo

- Lienzo de dibujo y pintura.
- Herramientas de trazo, borrado y color.
- Carga de plantillas.
- Generación de plantillas con IA.
- Biblioteca privada en Supabase Storage.
- Búsqueda, reutilización y eliminación con RLS por usuario.

### QR Studio

- Creación de recursos compartibles.
- Estado activo o vencido.
- Fecha de expiración.
- Conteo de escaneos.
- Descarga como PNG.
- Eliminación y administración del recurso.
- Acceso público mediante `/q/[slug]`.

---

## ✍️ Pizarra Interactiva y Matemática

La Pizarra Interactiva permite escribir procedimientos matemáticos a mano y convertirlos a una representación digital.

### Flujo

```text
Trazos del usuario
      ↓
Normalización y filtrado de puntos
      ↓
/api/whiteboard/recognize
      ↓
Proveedor de reconocimiento matemático
      ↓
LaTeX + retroalimentación
```

Incluye escritura, borrado, limpieza, caché, límites de trazos, soporte de edición mixta y script de finalización.

```bash
npm run whiteboard:finalize
```

El agente Matemático utiliza Markdown, KaTeX y LaTeX para desarrollar ejercicios paso a paso.

---

## 📝 Sistema de exámenes

### Experiencia del estudiante

- Examen público mediante enlace.
- Temporizador y progreso.
- Preguntas de selección, desarrollo y formatos mixtos.
- Guardado de respuestas y borradores.
- Desarrollo matemático con evidencia.
- Temas visuales y apoyos PIE/NEE.
- Corrección, nota y retroalimentación.

### Herramientas docentes

- Creación manual o con IA.
- Generación mixta de preguntas.
- Configuración de puntaje, tiempo y visualización.
- Publicación por enlace y código.
- Resultados, revisión y calificación.
- Seguridad, incidentes y sesiones activas.
- Códigos de acceso con hash y auditoría.

```bash
npm run test:exam
```

---

## 🎙️ Audio Lab, voces y MIRA

### Audio Lab

- Carga de audio o video.
- Transcripción.
- Operaciones de resumen, corrección y transformación.
- Edición de texto.
- Exportación educativa, TXT y SRT.
- Narración y perfiles de voz.
- Pipeline rápido o servicio externo.

Servicios incluidos:

```text
services/audio-parser
services/paper-parser
services/openvoice-space
```

### MIRA

MIRA amplía el Traductor con dos modos de voz:

| Modo | Flujo |
|------|-------|
| **Traducción** | Audio español ↔ inglés → Whisper → traducción IA → Edge TTS |
| **Conversación** | Audio → transcripción → respuesta contextual de MIRA → voz automática |

Características verificadas:

- Español de Chile e inglés.
- Whisper `large-v3-turbo` mediante Groq.
- Historial breve de conversación.
- Respuestas de 1 a 3 oraciones en modo conversación.
- Voces Edge TTS `es-CL-CatalinaNeural` y `en-US-AriaNeural`.
- Fallback de voz del navegador.
- Detección de silencio y continuación automática en la interfaz.

API principal:

```text
/api/agents/traductor/voice
```

---

## 🖼️ Imagen, video y música

### Image Studio

- Generación multi-proveedor.
- Modelos FLUX y Stable Diffusion según configuración.
- Integraciones preparadas para FAL, Gemini, OpenRouter, Together, Hugging Face y Pollinations.
- Optimización de prompts.
- Fallbacks limitados y errores concretos.
- Galería unificada, filtros y vista completa.

### Video Studio

```text
/video-studio
/api/agents/video
/api/agents/video/status/[jobId]
/api/agents/video/process
```

- Texto-a-video e imagen-a-video.
- Moderación básica.
- Deduplicación.
- Límites por plan.
- Jobs, progreso, proveedor, modelo, URL y errores.
- Worker o proveedor externo configurable.
- Workflow programado para procesar la cola.

### EduAI Music

- Reproductor inferior persistente.
- Play, pausa, anterior, siguiente, shuffle, repeat, progreso y volumen.
- Biblioteca interna y playlists educativas.
- Favoritos y cola.
- Búsqueda online mediante Jamendo, Audius e iTunes.
- Spotify mediante embeds oficiales.
- YouTube como enlace o integración oficial, sin conversión a MP3.

---

## 💬 Colaboración, gamificación y administración

### Colaboración

- Salas multiusuario.
- Moderación con IA.
- Materiales y contexto compartidos.
- Acceso desde Open EDUAI Work.
- Chat social entre agentes.

### Gamificación

- XP.
- Rachas.
- Logros.
- Ranking global.
- Repetición espaciada SM-2.
- Seguimiento de sesiones y actividad.

### Administración

| Ruta | Función |
|------|---------|
| `/admin` | Panel general |
| `/admin/users` | Gestión de usuarios |
| `/admin/exams` | Supervisión de exámenes |
| `/admin/exam-security` | Seguridad e incidentes |
| `/admin/access-codes` | Códigos de acceso |
| `/admin/model-lab` | Laboratorio de modelos |

Admin Model Lab mantiene los modelos experimentales aislados de la experiencia regular y aplica control de rol, auditoría y filtros.

---

## 🏗️ Arquitectura general

```text
Usuario
  ↓
Next.js App Router · React 19
  ├── Páginas y componentes
  ├── Server Actions / Route Handlers
  ├── EduAI Claw
  ├── AI Router y proveedores
  ├── Supabase Auth / PostgreSQL / Storage / RLS
  ├── Servicios externos de audio, PDF, voz y video
  └── Vercel + GitHub Actions
```

### Estructura principal

```text
app/                     Páginas y APIs de Next.js
components/              UI, estudio, exámenes, música, Claw y multimedia
lib/                     IA, Supabase, agentes, seguridad, currículo y dominio
public/data/mineduc/      Currículo oficial procesado
scripts/                 Validación, mantenimiento, parches y pruebas
services/                Microservicios opcionales
supabase/migrations/      Migraciones SQL incluidas
wan-worker/               Worker de video
.github/workflows/        CI, currículo, audio y video
proxy.ts                  Sesión y protección de rutas
vercel.json               Configuración de funciones
```

### Tecnologías

| Área | Tecnologías |
|------|-------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion |
| Estado y datos | Zustand, TanStack Query |
| Backend | Route Handlers, Node.js 22, Supabase SSR |
| Base de datos | PostgreSQL, RLS, pgvector, búsqueda full-text/BM25 |
| IA | Groq, Gemini, FAL y router multi-proveedor |
| Documentos | PDF Parse, Mammoth, jsPDF, PPTXGenJS, XLSX |
| Matemática | KaTeX, React KaTeX, Mermaid, Chart.js |
| Audio | Edge TTS, Whisper/Groq y servicios opcionales |
| Despliegue | Vercel, GitHub Actions, Docker y Hugging Face Spaces opcional |

---

## 🗄️ Base de datos y migraciones

### SQL incluido

```text
migration.sql
migration_bm25.sql
migration_qr_studio.sql
supabase/migrations/*.sql
```

Las migraciones incluidas cubren principalmente:

- Notebooks, fuentes, chunks, embeddings y búsqueda híbrida.
- BM25/full-text y extensiones relacionadas.
- QR Studio.
- Repetición espaciada.
- Seguridad y consentimiento de voz.
- Códigos de acceso de exámenes.
- Plantillas del Cuaderno Creativo.

### Importante para instalaciones nuevas

El código utiliza tablas base adicionales —por ejemplo perfiles, exámenes docentes, entregas, borradores, colaboración, video y administración— que pueden existir en la base de producción, pero no están completamente reconstruidas en los SQL incluidos.

Antes de desplegar desde cero se debe:

1. Exportar o versionar el esquema base completo de Supabase.
2. Añadir la migración de `video_jobs` y `video_usage_daily`.
3. Confirmar la migración de autoguardado y desarrollos de exámenes.
4. Ejecutar RLS, Storage y funciones SQL necesarias.
5. Verificar que ninguna clave de service role quede expuesta al cliente.

---

## 🔐 Variables de entorno

No se deben subir secretos al repositorio. Variables principales:

```env
# Aplicación
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SITE_URL=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# IA de texto
GROQ_API_KEY=
GEMINI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
OPENROUTER_API_KEY=

# Búsqueda
TAVILY_API_KEY=
SERPER_API_KEY=

# Imágenes
FAL_KEY=
TOGETHER_API_KEY=
HF_TOKEN=
POLLINATIONS_API_KEY=

# Audio y voz
AUDIO_PIPELINE_URL=
AUDIO_PIPELINE_TOKEN=
AUDIO_DEFAULT_MODE=quick
EDGE_TTS_VOICE_A=
EDGE_TTS_VOICE_B=

# Música
JAMENDO_CLIENT_ID=
JAMENDO_CLIENT_SECRET=
JAMENDO_REDIRECT_URI=
AUDIUS_API_HOST=https://discoveryprovider.audius.co
YOUTUBE_API_KEY=

# Video
VIDEO_PROVIDER_ORDER=ltx,cogvideox,hunyuan_i2v
VIDEO_CRON_SECRET=
CRON_SECRET=
HF_SPACE_VIDEO_API_URL=
HF_SPACE_VIDEO_API_TOKEN=

# Pizarra
WHITEBOARD_RECOGNITION_URL=
WHITEBOARD_RECOGNITION_HEADERS_JSON={}
WHITEBOARD_RECOGNITION_TIMEOUT_MS=6500

# Exámenes
EXAM_ACCESS_CODE_SECRET=
EXAM_LATEX_EVALUATOR_URL=
EXAM_LATEX_EVALUATOR_TOKEN=

# Cache opcional
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Los modelos y proveedores secundarios se pueden ajustar mediante variables específicas del AI Router, imágenes, audio y video.

---

## 💻 Instalación y desarrollo

### Requisitos

- Node.js 22.x.
- npm.
- Proyecto Supabase.
- Claves de los proveedores que se utilizarán.
- Vercel para el despliegue recomendado.
- Docker/Python solo para servicios opcionales.

### 1. Clonar e instalar

```bash
git clone https://github.com/innova-space-edu/eduai-platform.git
cd eduai-platform
npm install
```

### 2. Configurar entorno

```bash
cp .env.example .env.local
```

Si `.env.example` todavía no existe, crear `.env.local` con las variables necesarias de la sección anterior.

### 3. Preparar Supabase

Ejecutar las migraciones incluidas y comprobar que el esquema base de producción esté disponible.

### 4. Validar currículo

```bash
npm run test:curriculum
```

Resultado esperado:

```text
Currículum MINEDUC: 105 archivos, 0 archivos pendientes, 0 advertencias, 0 errores.
```

### 5. Desarrollo

```bash
npm run dev
```

### 6. Tests y build

```bash
npm run lint
npm run test:planner
npm run test:exam
npm run test:curriculum
npm run build
npm run start
```

---

## ⚙️ Scripts disponibles

| Comando | Función |
|---------|---------|
| `npm run dev` | Aplica parches idempotentes y levanta Next.js |
| `npm run build` | Valida currículo, mantiene módulos y compila |
| `npm run start` | Inicia producción |
| `npm run lint` | Ejecuta ESLint |
| `npm run planner:maintain` | Mantención del planificador |
| `npm run whiteboard:finalize` | Finaliza la integración de pizarra |
| `npm run mira:voice` | Aplica el modo de voz MIRA |
| `npm run test:planner` | Pruebas del planificador |
| `npm run test:exam` | Pruebas de exámenes |
| `npm run curriculum:index` | Regenera el índice curricular |
| `npm run curriculum:validate` | Valida datos curriculares |
| `npm run test:curriculum` | Validación curricular estricta |

---

## 🔄 CI/CD y mantenimiento

| Workflow | Disparador | Función |
|----------|------------|---------|
| `ci.yml` | Push a `main` y Pull Request | Instala, valida, prueba y compila |
| `curriculum-validation.yml` | Cambios curriculares | Regenera índice y valida OA |
| `deploy-audio-parser-hf.yml` | Cambios o ejecución manual | Publica el parser en Hugging Face Spaces |
| `process-video.yml` | Cada 5 minutos o manual | Procesa la cola de video |

### Vercel

- `vercel.json` centraliza límites de funciones.
- Las rutas de audio, parsing, imágenes, exámenes y video usan runtime Node.js.
- `proxy.ts` actualiza la sesión Supabase, protege rutas y conserva accesos públicos autorizados.

---

## 🛡️ Seguridad, privacidad y accesibilidad

### Seguridad

- Row Level Security en las migraciones incluidas.
- Service role solo en servidor.
- Rutas administrativas protegidas.
- Guardrails del Superagente.
- Validación de ownership en Notebooks, plantillas y QR.
- Códigos de examen con hash y auditoría.
- Validación de URL y límites de archivos.
- Tokens opcionales para microservicios.

### Voz y consentimiento

Los perfiles de voz requieren titularidad o autorización, consentimiento y mayoría de edad. Los servicios de voz personalizada deben desplegarse de forma privada y con almacenamiento protegido.

### Accesibilidad educativa

- Perfiles PIE/NEE.
- Apoyos para dislexia, TDAH y baja visión.
- Alto contraste y tipografías accesibles.
- Narración TTS.
- Instrucciones paso a paso.
- Adaptación mediante `adapt_for_pie`.
- Evidencia visual y desarrollo matemático.

---

## 🧪 Estado funcional y pendientes

### Implementado

- [x] Open EDUAI Work con fuentes, archivos y exportaciones.
- [x] MIRA con traducción y conversación por voz.
- [x] Creator Hub con 13 formatos.
- [x] Cuaderno Creativo con biblioteca privada.
- [x] QR Studio con vencimiento, scans y PNG.
- [x] Pizarra Interactiva con reconocimiento a LaTeX.
- [x] Planificador MINEDUC con 105 archivos validados.
- [x] Notebooks con RAG híbrido y RRF.
- [x] Exámenes con IA, temas, seguridad y accesibilidad.
- [x] Audio Lab y servicios externos.
- [x] Image Studio multi-proveedor.
- [x] EduAI Music persistente.
- [x] Video Studio con jobs.
- [x] Admin Model Lab.
- [x] CI y validación curricular.

### Requiere configuración o consolidación

- [ ] Versionar el esquema base completo de Supabase.
- [ ] Agregar migraciones faltantes de video y autoguardado.
- [ ] Crear `.env.example` sin secretos.
- [ ] Configurar proveedores externos de audio, voz, video y pizarra.
- [ ] Añadir pruebas end-to-end de los flujos críticos.
- [ ] Consolidar gradualmente los scripts `apply-*.mjs` en código fuente estable.
- [ ] Incorporar observabilidad de costos, latencia y errores por proveedor.

---

## 🤝 Contribuir

1. Crear una rama de trabajo.
2. Instalar dependencias.
3. Ejecutar validaciones.
4. Usar commits descriptivos.
5. Abrir un Pull Request con alcance y evidencias.

```bash
git checkout -b feature/nueva-funcionalidad
npm run test:curriculum
npm run test:planner
npm run test:exam
npm run build
git commit -m "feat: descripción del cambio"
git push origin feature/nueva-funcionalidad
```

---

## 👤 Créditos y licencia

<div align="center">

### Dirección y desarrollo

**Esthefano Morales Campaña**  
Fundador y Director Ejecutivo de **[Innova Space Edu SpA](https://innova-space-edu.cl/)**

### Desarrollo asistido por IA

**ChatGPT de OpenAI** — apoyo de co-creación, documentación y desarrollo asistido.

### Organización

**[Innova Space Education](https://innova-space-edu.cl/)**  
Antofagasta, Chile · `contacto@innova-space-edu.cl`

</div>

El proyecto se distribuye bajo la **MIT License**. Consulta [LICENSE](LICENSE) para conocer los términos.

---

<div align="center">

**EduAI Platform — Educación, tecnología e inteligencia artificial en un solo ecosistema.**

**[🌐 Plataforma](https://eduaiplatformclon.vercel.app)** · **[🏢 Innova Space Edu](https://innova-space-edu.cl/)** · **[💻 GitHub](https://github.com/innova-space-edu/eduai-platform)**

</div>
