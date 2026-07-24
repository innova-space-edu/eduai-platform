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

## 📌 Estado verificado del repositorio

Este README fue reconstruido a partir del código real del proyecto y de la rama `main` del repositorio.

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
| **Migraciones SQL incluidas** | 8 archivos SQL entre raíz y `supabase/migrations` |
| **Runtime principal** | Next.js 16 · React 19 · Node.js 22 · TypeScript 5 |

</div>

> La validación curricular se ejecuta con `npm run test:curriculum`. El índice actual contiene 105 archivos operativos: 6 de Parvularia, 80 de Educación Básica y 19 de Educación Media.

---

## 🧭 Contenidos

1. [¿Qué es EduAI Platform?](#-qué-es-eduai-platform)
2. [Mapa de módulos](#-mapa-de-módulos)
3. [Agentes y espacios activos](#-agentes-y-espacios-activos)
4. [EduAI Claw](#-eduai-claw--superagente)
5. [Open EDUAI Work](#-open-eduai-work)
6. [Planificación MINEDUC](#-planificador-mineduc-y-planificación-escolar)
7. [Notebooks, RAG y Chat Paper](#-eduai-notebooks-rag-y-chat-paper)
8. [Creator Hub, Cuaderno Creativo y QR Studio](#-creator-hub-cuaderno-creativo-y-qr-studio)
9. [Pizarra Interactiva y Matemática](#-pizarra-interactiva-y-matemática)
10. [Sistema de exámenes](#-sistema-de-exámenes)
11. [Audio Lab, voces y MIRA](#-audio-lab-voces-y-mira)
12. [Imagen, video y música](#-imagen-video-y-música)
13. [Colaboración, gamificación y administración](#-colaboración-gamificación-y-administración)
14. [Arquitectura](#-arquitectura-general)
15. [Base de datos y migraciones](#-base-de-datos-y-migraciones)
16. [Variables de entorno](#-variables-de-entorno)
17. [Instalación y desarrollo](#-instalación-y-desarrollo)
18. [CI/CD y mantenimiento](#-cicd-y-mantenimiento)
19. [Seguridad, privacidad y accesibilidad](#-seguridad-privacidad-y-accesibilidad)
20. [Créditos y licencia](#-créditos-y-licencia)

---

## 🚀 ¿Qué es EduAI Platform?

**EduAI Platform** es una plataforma educativa chilena que integra aprendizaje adaptativo, agentes especializados, creación de materiales, planificación curricular, investigación con fuentes, evaluación digital, herramientas multimedia y colaboración en un solo ecosistema.

La aplicación combina experiencias inspiradas en asistentes conversacionales, espacios de investigación tipo NotebookLM, creación visual tipo Canva educativo, reproducción musical persistente, herramientas de evaluación docente y un superagente central llamado **EduAI Claw**.

### Propósito

- Ayudar a estudiantes a comprender, practicar, investigar y crear.
- Dar a docentes herramientas para planificar, evaluar y producir materiales.
- Integrar IA generativa sin separar el trabajo en múltiples plataformas.
- Mantener un enfoque alineado al currículo chileno y a las necesidades PIE/NEE.
- Permitir que los resultados se conviertan en productos utilizables: PDF, PPTX, XLSX, DOC, audio, imágenes, videos, QR, exámenes y proyectos.

### Perfiles principales

| Perfil | Capacidades principales |
|--------|--------------------------|
| **Estudiante** | Estudio adaptativo, modo socrático, evaluaciones, pizarra matemática, TTS, Notebooks, música, XP y colaboración |
| **Docente** | Planificación MINEDUC, exámenes, rúbricas, análisis pedagógico, Creator Hub, Audio Lab, QR y Workspace |
| **Administrador** | Usuarios, reportes, seguridad de exámenes, códigos de acceso, auditoría y Admin Model Lab |

---

## 🗺️ Mapa de módulos

<div align="center">

| Módulo | Ruta principal | Función |
|--------|----------------|---------|
| 🏠 **Dashboard** | `/dashboard` | Inicio, estadísticas, sesiones, accesos rápidos y consola Claw |
| 📚 **Sesión de estudio** | `/study/[topic]` | Teoría, ejemplos, diagnóstico, quiz, resumen, modo socrático y visualizaciones |
| 🤖 **Agentes EduAI** | `/agentes` | Catálogo central de agentes y herramientas activas |
| ✦ **Open EDUAI Work** | `/chat-global` | Preguntar, investigar, crear, colaborar y ejecutar con fuentes y archivos |
| 🦾 **EduAI Claw** | `/superagent` | Orquestador, herramientas, borradores, guardrails y chat social |
| 🏫 **Planificador** | `/educador` | Planificaciones alineadas a OA oficiales MINEDUC |
| 🗓️ **Planificador curricular** | `/educador/planificador-curricular` | Planificación diaria, semanal, mensual, semestral y anual |
| 📓 **EduAI Notebooks** | `/notebooks` | Fuentes, RAG híbrido, chat con citas y Studio |
| 📄 **Chat Paper** | `/paper` | Lectura y conversación profunda con PDF |
| 🎨 **Creator Hub** | `/creator-hub` | 13 formatos educativos, manga, materiales, Labs y compartir |
| 🖍️ **Cuaderno Creativo** | `/cuaderno-creativo` | Dibujo, pintura y biblioteca privada de plantillas |
| ✍️ **Pizarra Interactiva** | `/pizarra-interactiva` | Escritura manual, reconocimiento matemático y conversión a LaTeX |
| 🌐 **MIRA Traductor** | `/traductor` | Traducción escrita, interpretación por voz y conversación bilingüe |
| 📝 **Exámenes** | `/examen` | Simulacro, creación docente, publicación, resultados y revisión |
| 🎙️ **Audio Lab** | `/audio-lab` | Transcripción, edición, procesamiento, exportación y perfiles de voz |
| 🖼️ **Image Studio** | `/image-studio` | Generación visual multi-proveedor y galería |
| 🎬 **Video Studio** | `/video-studio` | Texto-a-video, imagen-a-video, cola y seguimiento de jobs |
| 🎵 **EduAI Music** | `/music` | Reproductor persistente, playlists, búsqueda y fuentes externas |
| ▦ **QR Studio** | `/qr-studio` | Recursos compartibles, vencimiento, conteo de escaneos y PNG |
| 📁 **Workspace** | `/workspace` | Proyectos, archivos, enlaces y materiales generados |
| 💬 **Colaboración** | `/collab` | Salas multiusuario y moderación con IA |
| 🧠 **Chat social** | `/ai-social` | Conversaciones internas entre agentes y extracción de ideas |
| 🏆 **Ranking** | `/ranking` | XP, rachas, logros y tabla de posiciones |
| 🛡️ **Administración** | `/admin` | Usuarios, exámenes, seguridad, códigos y Model Lab |

</div>

---

## 🤖 Agentes y espacios activos

La página `/agentes` contiene 20 entradas activas verificadas en el código.

<div align="center">

| # | Agente o espacio | Ruta | Función principal |
|--:|------------------|------|------------------|
| 1 | **Planificador** | `/educador` | Planificación docente alineada al currículo chileno |
| 2 | **Investigador** | `/investigador` | Búsqueda, síntesis y análisis de fuentes |
| 3 | **Redactor** | `/redactor` | Ensayos, informes, cartas y documentos |
| 4 | **Matemático** | `/matematico` | Resolución paso a paso y LaTeX |
| 5 | **Pizarra Interactiva** | `/pizarra-interactiva` | Trazos, reconocimiento matemático y retroalimentación |
| 6 | **Cuaderno Creativo** | `/cuaderno-creativo` | Dibujo, coloreado y plantillas |
| 7 | **MIRA Traductor** | `/traductor` | Traducción, conversación e interpretación por voz |
| 8 | **Chat Paper** | `/paper` | Conversación con documentos PDF |
| 9 | **Examen** | `/examen` | Simulacro con timer y corrección |
| 10 | **Exámenes Docente** | `/examen/docente` | Creación, publicación, resultados y revisión |
| 11 | **Open EDUAI Work** | `/chat-global` | Espacio integral conectado a Claw |
| 12 | **EduAI Music** | `/music` | Música persistente y playlists |
| 13 | **Creator Hub** | `/creator-hub` | Materiales y productos educativos |
| 14 | **Audio Lab** | `/audio-lab` | Audio, transcripción y voces |
| 15 | **Image Studio** | `/image-studio` | Imágenes IA multi-proveedor |
| 16 | **Admin Model Lab** | `/admin/model-lab` | Evaluación aislada de modelos experimentales |
| 17 | **Video Studio** | `/video-studio` | Generación y seguimiento de videos |
| 18 | **Galería** | `/galeria` | Historial y reutilización de imágenes |
| 19 | **Ranking** | `/ranking` | Gamificación, XP y rachas |
| 20 | **Workspace** | `/workspace` | Organización de proyectos y recursos |

</div>

### Capacidades pedagógicas del modo estudio

El flujo `/study/[topic]` integra, según la actividad, tutoría general, diagnóstico, modo socrático, evaluación, dificultad adaptativa, visualización, resumen, narración, memoria, colaboración y repetición espaciada SM-2.

---

## 🦾 EduAI Claw — Superagente

EduAI Claw es el orquestador central. Observa el contexto, selecciona herramientas, prepara borradores, sugiere siguientes pasos y evita acciones no autorizadas mediante guardrails.

### Componentes principales

| Archivo | Responsabilidad |
|---------|-----------------|
| `lib/superagent/engine.ts` | Motor principal de coordinación |
| `lib/superagent/router.ts` | Selección de target y skill |
| `lib/superagent/guardrails.ts` | Restricciones de seguridad |
| `lib/superagent/action-router.ts` | Detección de intención y acciones sugeridas |
| `lib/superagent/action-executor.ts` | Ejecución controlada de acciones |
| `lib/superagent/draft-engine.ts` | Creación de borradores sin escribir en producción |
| `lib/superagent/social-engine.ts` | Conversación social entre agentes |
| `lib/superagent/social-session-store.ts` | Sesiones sociales |
| `lib/superagent/superagent-core.ts` | Núcleo compatible con chat y tool calling |
| `lib/superagent/tool-registry.ts` | Registro de herramientas ejecutables |
| `lib/superagent/registry.ts` | Registro y filtrado de skills |
| `lib/superagent/eduai-map.ts` | Mapa de navegación de páginas EduAI |

### 16 herramientas registradas

```text
generate_exam_questions  adapt_for_pie       plan_curriculum
explain_concept          generate_rubric     summarize_text
translate_text           proofread_text      generate_image_prompt
generate_image           narrate_text        generate_podcast
generate_edu_video       recommend_focus_music
generate_code            fix_code_error
```

### 12 skills registradas

```text
observe_user_context            route_to_best_agent
summarize_goal                  optimize_prompt
repair_failed_call              save_memory_snapshot
suggest_next_step               agent_health_check
spawn_agent_discussion          extract_ideas_from_social_chat
anticipate_user_next_need       create_draft_file
```

### Guardrails actuales

- No permite inspeccionar secretos.
- No inyecta mensajes en chats privados.
- No sobrescribe producción de forma autónoma.
- No habilita auto-modificación del sistema.
- Limita sugerencias, borradores y skills por ciclo.
- Diferencia permisos por contexto y rol.

---

## ✦ Open EDUAI Work

`/chat-global` es el espacio de trabajo integral de EduAI. Conserva el motor Claw, pero organiza la experiencia como un entorno de investigación y producción.

### Cinco modos de trabajo

| Modo | Objetivo |
|------|----------|
| **Preguntar** | Explicar, comparar, analizar y resolver |
| **Investigar** | Usar fuentes del cuaderno, web o ambas con citas |
| **Crear** | Generar materiales, evaluaciones, imágenes, audio, video y código |
| **Colaborar** | Organizar roles, acuerdos, tareas y sesiones compartidas |
| **Ejecutar** | Convertir una solicitud en una acción o producto utilizable |

### Funciones verificadas

- Conversaciones persistentes por espacio de trabajo.
- Contexto desde un Notebook activo.
- Panel lateral con fuentes y citas.
- Investigación con alcance `fuentes`, `web` o `fuentes + web`.
- Adjuntos PDF, DOCX y TXT incorporados como fuentes.
- Lectura, resumen, traducción y corrección de archivos.
- Creación de podcast o narración desde documentos adjuntos.
- Descarga de resultados en DOC, PDF, PPTX y XLSX.
- Renderizado de imágenes y audio dentro del chat.
- Acceso a acciones del Superagente.
- Resultados y tareas organizados por Work.

### APIs

```text
/api/superagent/chat
/api/work/research
/api/work/context
/api/notebooks/[id]/sources
/api/notebooks/[id]/ingest
```

---

## 🏫 Planificador MINEDUC y planificación escolar

El módulo docente usa una base curricular local validada y rutas especializadas para conectar OA, indicadores, actividades, evaluación y recursos.

### Cobertura curricular verificada

| Nivel | Archivos operativos |
|-------|---------------------:|
| Educación Parvularia | 6 |
| Educación Básica | 80 |
| Educación Media | 19 |
| **Total** | **105** |

Todos los archivos del índice se encuentran en estado `verificado_oficial` o `verificado_propuesta_oficial` y pasan la validación estricta del repositorio.

### Funciones del planificador

- Selección de nivel, curso y asignatura.
- Conexión manual o automática de OA.
- Sinónimos temáticos para encontrar OA por contexto.
- Perfiles de planificación: clase, feria científica, salida pedagógica, campaña, evento escolar, proyecto ABP/STEAM y experiencia de Parvularia.
- Planificación diaria, semanal, mensual, semestral y anual.
- Cronogramas institucionales para horizontes largos.
- Adecuaciones y complementos pedagógicos.
- Auditoría estructurada de calidad.
- Exportación PDF mediante `lib/planning-pdf.ts`.
- Guardado y consulta de planificaciones.

### Archivos clave

```text
app/educador/
app/api/agents/educador/route.ts
app/api/agents/educador/curriculum/route.ts
app/api/agents/planificador-curricular/route.ts
lib/mineduc-oa.ts
lib/planificador-curriculum.ts
lib/planner-oa-bridge.ts
lib/planner-oa-synonyms.ts
lib/school-planning-profiles.ts
lib/planning-quality-audit.ts
data/mineduc/
```

### Comandos de mantenimiento

```bash
npm run curriculum:index
npm run curriculum:validate
npm run test:curriculum
npm run planner:maintain
npm run test:planner
```

---

## 📓 EduAI Notebooks, RAG y Chat Paper

### EduAI Notebooks

EduAI Notebooks es un workspace de tres paneles para construir conocimiento desde fuentes reales.

```text
Fuentes → extracción → chunking → contextualización → embeddings
        → búsqueda vectorial + full-text → RRF → chat con citas → Studio
```

#### Fuentes admitidas

- URL.
- PDF.
- DOCX.
- TXT.
- Texto pegado.
- Búsqueda web.

#### Pipeline

1. Se crea la fuente en `notebook_sources`.
2. Se extrae el texto con parser local o externo.
3. Se divide en chunks con solapamiento.
4. Se generan embeddings cuando existe una clave compatible.
5. Se guarda el contenido en `notebook_chunks`.
6. El retrieval combina búsqueda vectorial y full-text.
7. Los resultados se fusionan con Reciprocal Rank Fusion.
8. El chat responde con citas y puede usar al Investigador como fallback.
9. Studio genera materiales desde el contenido recuperado.

#### Studio

- Infografía.
- Mapa mental.
- Quiz.
- Podcast con audio.
- Flashcards.
- Timeline.
- Notas Cornell.
- Presentación.

#### Tablas

```text
notebooks
notebook_sources
notebook_chunks
notebook_summaries
notebook_messages
notebook_outputs
```

### Chat Paper

`/paper` y `/paper-large` permiten cargar PDF, extraer contenido y conversar con el documento. El sistema puede usar:

- `pdf-parse` para texto nativo.
- OCR Space como apoyo opcional.
- Parser externo Docling/Faster pipeline mediante `DOCLING_PARSER_URL`.
- Supabase Storage para documentos.
- `paper_documents`, `paper_chunks` y `paper_extractions` cuando existen en la base conectada.

### Microservicio Paper Parser

`services/paper-parser/` contiene un Space Docker para Hugging Face con:

```text
GET /health
POST de procesamiento según app.py
```

El parser está diseñado para PDFs normales y escaneados, con OCR adaptativo y límites configurables.

---

## 🎨 Creator Hub, Cuaderno Creativo y QR Studio

### Creator Hub

Creator Hub funciona como un catálogo central de creación educativa.

#### 13 formatos

| Categoría | Formatos |
|-----------|----------|
| **Visuales** | Infografía, presentación, afiche, mapa mental, timeline |
| **Estudio** | Flashcards, quiz, notas Cornell, glosario |
| **Narrativa y audio** | Podcast, cuento educativo, canción/rap |
| **Planificación** | Plan de clase |

#### Herramientas centrales

- Cuaderno EduAI.
- Crear materiales.
- Mangas e historietas.
- Labs multimedia.
- Compartir con QR.

#### Labs conectados

- Audio Lab.
- Audio Lab Pro.
- Perfiles de voz.
- Image Studio.
- Video Studio.
- Galería.
- EduAI Music.
- Creator clásico.

#### Subrutas

```text
/creator-hub
/creator-hub/[format]
/creator-hub/materials
/creator-hub/notebook
/creator-hub/comics
/creator-hub/labs
/creator-hub/projects
/creator-hub/share
```

### Cuaderno Creativo

`/cuaderno-creativo` permite:

- Dibujar y pintar en un lienzo.
- Trabajar con plantillas para colorear.
- Subir plantillas propias.
- Generar plantillas con IA.
- Guardar, buscar, reutilizar y eliminar plantillas.
- Mantener una biblioteca privada mediante Supabase Storage y RLS.

La migración `202607210001_creative_templates.sql` crea la tabla `creative_templates` y sus políticas.

### QR Studio

`/qr-studio` permite crear recursos QR para:

- Enlaces.
- Texto.
- Notebooks.
- Proyectos o assets relacionados.

Funciones:

- Código corto único.
- Ruta pública `/q/[shortCode]`.
- Visibilidad configurable.
- Fecha de vencimiento.
- Conteo de escaneos.
- Descarga PNG.
- Eliminación desde la biblioteca.
- Protección de recursos privados o vencidos.

La migración `migration_qr_studio.sql` crea `qr_resources`, `workspace_assets` y la función `record_qr_scan()`.

---

## ✍️ Pizarra Interactiva y Matemática

### Pizarra Interactiva

La ruta `/pizarra-interactiva` captura escritura con mouse, lápiz o dedo.

- Guarda trazos del lienzo.
- Permite borrado por trazo.
- Convierte el procedimiento a LaTeX mediante un proveedor externo.
- Muestra el LaTeX reconocido y permite editarlo.
- Envía el procedimiento al agente Matemático como contexto.
- Puede conservar imagen, texto legible y LaTeX como evidencia en exámenes.
- Incluye caché y reducción de puntos para disminuir latencia.
- Evita depender del OCR en cada trazo; el reconocimiento final puede ejecutarse al cambiar de pregunta o entregar.

### API

```text
POST /api/whiteboard/recognize
```

### Agente Matemático

`/matematico` ofrece resolución paso a paso, expresiones KaTeX/LaTeX y apoyo para revisar procedimientos.

### Integración con exámenes

`ExamQuestionNotebook` y `ExamLatexAnswerFix` permiten conservar desarrollos manuscritos o matemáticos y revisar el resultado reconocido.

---

## 📋 Sistema de exámenes

EduAI incluye un sistema completo para docentes, estudiantes y administración.

### Flujo docente

```text
Crear → generar preguntas con IA → editar → aplicar tema y ajustes PIE
→ publicar enlace → gestionar acceso → recibir respuestas → revisar resultados
```

### Tipos de preguntas

- Alternativas.
- Verdadero/Falso.
- Desarrollo.
- Preguntas mixtas generadas por IA.
- Justificación y rúbricas.
- Contenido matemático con LaTeX.
- Imagen por pregunta.

### Experiencia del estudiante

- Link público por código.
- Identificación mediante RUT cuando está habilitado.
- Timer y reloj digital.
- Barra de progreso.
- Navegación entre preguntas.
- Calculadora científica autorizable por docente.
- Narración TTS de preguntas.
- Temas accesibles.
- Cuaderno de desarrollo y evidencia visual.
- Autoguardado y reanudación cuando el esquema correspondiente existe.

### Temas visuales

```text
clásico · moderno · Canva · PIE calma · TDAH
alto contraste · STEM · kids
```

### Corrección y resultados

- Corrección automática.
- Puntaje parcial.
- Escala chilena 1.0–7.0.
- Revisión manual.
- Re-cálculo matemático.
- Feedback visible u ocultable.
- Análisis pedagógico por curso y contenido.
- Descarga PDF del examen o resultados.

### Seguridad

- `ExamGuard` y overlay de seguridad.
- Sesión de supervisión.
- Heartbeat.
- Registro de eventos e incidentes.
- Mensajería administrador-estudiante.
- Acciones administrativas sobre sesiones.
- Códigos temporales vinculados a nómina.
- Auditoría de códigos con hash.

### Rutas principales

```text
/examen
/examen/crear
/examen/docente
/examen/editar/[id]
/examen/p/[code]
/examen/resultados/[id]
/admin/exam-access
/admin/exam-codes
/admin/exam-security
```

---

## 🎙️ Audio Lab, voces y MIRA

### Audio Lab

El pipeline de audio usa una cadena configurable:

```text
Microservicio externo → Groq Whisper → Gemini fallback
```

Funciones:

- Carga de audio o video.
- Procesamiento rápido o Pro.
- Transcripción con timestamps.
- Edición de transcripción.
- Resumen y operaciones IA.
- Exportación TXT, SRT y otros formatos.
- URLs de carga reanudable.
- Proyectos extensos en `/audio-lab-large`.

### Perfiles de voz

`/audio-lab/voices` incorpora controles de consentimiento:

- Voz propia o tercero autorizado.
- Confirmación de mayoría de edad.
- Confirmación de consentimiento.
- Eventos de auditoría.
- Sesiones de seguridad.
- Ciclo de procesamiento y eliminación.
- Storage privado cuando se configura correctamente.

### Microservicios

| Carpeta | Objetivo |
|---------|----------|
| `services/audio-parser/` | Faster Whisper, VAD, segmentos y timestamps |
| `services/openvoice-space/` | Procesamiento y síntesis de voz en Space privado |
| `services/paper-parser/` | Parsing y OCR de PDF fuera de Vercel |

### MIRA

MIRA es el agente de idiomas de `/traductor`.

#### Modos

| Modo | Funcionamiento |
|------|----------------|
| **Traducción escrita** | Traducción con explicación lingüística y cultural |
| **Intérprete por voz** | Español ↔ inglés desde grabación de audio |
| **Conversación en vivo** | Respuesta autónoma en el idioma seleccionado con contexto reciente |

#### Pipeline de voz

```text
Micrófono → Groq Whisper large-v3-turbo → AI Router
→ respuesta o traducción → Edge TTS → reproducción MP3
```

El endpoint limita tamaño de audio, historial y duración, requiere usuario autenticado y usa voces en español de Chile e inglés.

---

## 🖼️ Imagen, video y música

### Image Studio

Image Studio usa una cadena de proveedores con fallback y modos de calidad.

Proveedores y opciones presentes en el proyecto:

- Google Gemini Image.
- OpenRouter.
- Together AI.
- Hugging Face.
- Pollinations.
- FAL client para integraciones compatibles.

Funciones:

- Prompt optimizer.
- Orden de proveedores por modo rápido, calidad o educativo.
- Preview.
- Galería unificada.
- Imágenes automáticas desde agentes o Notebooks.
- Configuración central en `lib/image-config.ts`.

### Video Studio

```text
POST /api/agents/video
GET  /api/agents/video/status/[jobId]
POST /api/agents/video/process
```

Funciones:

- Texto-a-video.
- Imagen-a-video.
- Duración, FPS y relación de aspecto configurables.
- Audio opcional en payload.
- Moderación básica.
- Deduplicación.
- Límites por minuto y día.
- Jobs y polling.
- Fallback entre proveedores.
- Worker Python base en `wan-worker/`.
- Procesamiento programado mediante GitHub Actions.

Proveedores contemplados:

```text
LTX Video · CogVideoX · HunyuanVideo-I2V · HF Space compatible
```

> Para generación real se requiere un endpoint de proveedor y el esquema de `video_jobs`/`video_usage_daily`. El documento `docs/VIDEO_AGENT_SETUP.md` referencia una migración de video que no está incluida en este ZIP.

### EduAI Music

- Reproductor global persistente mediante `MusicProvider`.
- Play, pausa, anterior, siguiente, shuffle, repeat, progreso y volumen.
- Biblioteca educativa interna.
- Playlists del sistema.
- Favoritos y cola.
- Jamendo con búsqueda y OAuth preparado.
- Audius mediante discovery provider.
- Previews de iTunes como fallback.
- Spotify mediante embeds oficiales.
- Radio/proxy configurable.
- YouTube como búsqueda o enlace cuando se configura la API correspondiente.

---

## 🤝 Colaboración, gamificación y administración

### Colaboración

- Salas de estudio mediante `/collab` y `/collab/[code]`.
- Mensajes y miembros en tiempo real.
- Agente colaborativo para moderar.
- Chat social tipo Messenger.
- Amigos, presencia, notificaciones y carga de archivos.
- Chat social de agentes en `/ai-social`.

### Gamificación

- XP por actividad.
- Misiones.
- Logros.
- Ranking global.
- Rachas.
- Repetición espaciada SM-2.

```text
Principiante → Aprendiz → Practicante → Avanzado → Experto → Maestro
    0 XP        100 XP      500 XP       1200 XP    2500 XP   5000 XP
```

### Administración

- Dashboard administrativo.
- Gestión de usuarios.
- Reportes.
- Gestión global de exámenes.
- Seguridad de sesiones.
- Códigos de acceso.
- Mensajería y notas de administración.
- Admin Model Lab protegido por rol.

---

## 🏗️ Arquitectura general

```text
Navegador
   │
   ├── Next.js App Router + React 19
   │      ├── páginas y componentes cliente/servidor
   │      ├── proxy.ts para auth y protección
   │      └── API Routes
   │
   ├── AI Router v4/v5
   │      ├── Gemini
   │      ├── Groq
   │      ├── OpenRouter
   │      ├── Together / Hugging Face / Pollinations
   │      └── proveedores especializados
   │
   ├── EduAI Claw
   │      ├── router
   │      ├── tool registry
   │      ├── skills
   │      ├── guardrails
   │      └── action executor
   │
   ├── Supabase
   │      ├── Auth
   │      ├── PostgreSQL
   │      ├── Realtime
   │      ├── Storage
   │      └── pgvector / full-text
   │
   └── Servicios externos opcionales
          ├── Audio Parser
          ├── Paper Parser
          ├── OpenVoice privado
          ├── workers de video
          └── búsqueda web / scraping
```

### AI Router

| Archivo | Uso |
|---------|-----|
| `lib/ai-router.ts` | Compatibilidad general |
| `lib/ai-router-v4.ts` | Routing estructurado, stream y multimodal |
| `lib/ai-router-v5.ts` | Caché y routing por tarea/modelo |
| `lib/redis.ts` | Caché y rate limit con Upstash opcional |

### Estadísticas de rutas

#### Páginas por grupo

| Grupo | Cantidad |
|-------|---------:|
| Administración | 9 |
| Creator Hub | 8 |
| Exámenes | 6 |
| Educador | 4 |
| Audio Lab | 4 |
| Autenticación | 2 |
| Colaboración | 2 |
| Notebooks | 2 |
| Perfil | 2 |
| Superagente | 2 |
| Workspace | 2 |
| Otros módulos y páginas | 26 |
| **Total** | **69** |

#### APIs por grupo

| Grupo | Cantidad |
|-------|---------:|
| Agentes | 54 |
| Notebooks | 11 |
| Seguridad de exámenes | 8 |
| Música | 6 |
| Superagente | 6 |
| Chat | 5 |
| Examen | 4 |
| QR | 3 |
| Sesiones | 3 |
| Otros grupos | 20 |
| **Total** | **120** |

---

## 📂 Estructura del proyecto

```text
eduai-platform/
├── app/
│   ├── (auth)/                    # Login y registro
│   ├── admin/                     # Administración y seguridad
│   ├── agentes/                   # Catálogo de agentes
│   ├── ai-social/                 # Chat social de agentes
│   ├── audio-lab/                 # Audio Lab y perfiles de voz
│   ├── chat-global/               # Open EDUAI Work
│   ├── collab/                    # Salas colaborativas
│   ├── creator-hub/               # Creator Hub y submódulos
│   ├── cuaderno-creativo/         # Lienzo y biblioteca de plantillas
│   ├── educador/                  # Planificador docente
│   ├── examen/                    # Exámenes y resultados
│   ├── image-studio/              # Generación visual
│   ├── music/                     # Reproductor persistente
│   ├── notebooks/                 # Workspace RAG
│   ├── paper/                     # Chat Paper
│   ├── pizarra-interactiva/       # Escritura matemática
│   ├── qr-studio/                 # Gestión de QR
│   ├── study/                     # Sesión adaptativa
│   ├── superagent/                # Panel Claw
│   ├── traductor/                 # MIRA
│   ├── video-studio/              # Video Studio
│   ├── workspace/                 # Proyectos
│   └── api/                       # 120 endpoints internos
│
├── components/
│   ├── creator-hub/
│   ├── dashboard/
│   ├── design/
│   ├── exam/
│   ├── exam-security/
│   ├── music/
│   ├── notebook/
│   ├── superagent/
│   ├── video/
│   ├── work/
│   └── ui/
│
├── lib/
│   ├── agents/
│   ├── ai/
│   ├── audio/
│   ├── design/
│   ├── design-templates/
│   ├── exam/
│   ├── exam-security/
│   ├── music/
│   ├── notebook/
│   ├── papers/
│   ├── qr/
│   ├── superagent/
│   ├── work/
│   ├── ai-router-v4.ts
│   ├── ai-router-v5.ts
│   ├── image-config.ts
│   ├── mineduc-oa.ts
│   ├── planning-pdf.ts
│   ├── video-agent.ts
│   └── video-config.ts
│
├── services/
│   ├── audio-parser/
│   ├── openvoice-space/
│   └── paper-parser/
│
├── wan-worker/                    # Worker Python base para video
├── data/mineduc/                  # Currículo oficial validado
├── supabase/migrations/           # Migraciones versionadas
├── scripts/                       # Validación, mantenimiento y sincronización
├── docs/                          # Guías técnicas por módulo
├── docker/                        # Servicios Docker auxiliares
├── .github/workflows/             # CI, currículo, audio parser y video queue
├── proxy.ts                       # Auth, rutas protegidas y refresh
├── next.config.ts
├── vercel.json
├── DESIGN.md
├── INSTALL.md
└── README.md
```

---

## 🧰 Stack tecnológico

<div align="center">

| Categoría | Tecnologías |
|-----------|-------------|
| **Frontend** | Next.js 16.1.6 · React 19.2.3 · TypeScript 5 · Tailwind CSS 4 |
| **UI y estado** | Lucide React · Framer Motion · Zustand · TanStack Query · next-themes |
| **Contenido** | react-markdown · remark-gfm · remark-math · KaTeX · Mermaid · Chart.js |
| **Exportación** | jsPDF · PptxGenJS · xlsx · html-to-image |
| **Backend** | Next.js Route Handlers · Node.js 22 · Vercel |
| **Datos** | Supabase Auth · PostgreSQL · Realtime · Storage · pgvector |
| **Parsing** | pdf-parse · Mammoth · Cheerio · Puppeteer Core · Chromium |
| **IA de texto** | Gemini · Groq · OpenRouter · Together compatible · Cerebras opcional |
| **Imagen** | Gemini Image · OpenRouter · Together · Hugging Face · Pollinations · FAL |
| **Audio** | Edge TTS · Groq Whisper · parser Faster Whisper externo |
| **Video** | LTX · CogVideoX · Hunyuan · workers externos compatibles |
| **Música** | Jamendo · Audius · iTunes · Spotify embeds · radio proxy |
| **Cache** | Upstash Redis opcional con degradación elegante |

</div>

---

## 🗄️ Base de datos y migraciones

### Migraciones incluidas en el repositorio

| Archivo | Contenido |
|---------|-----------|
| `migration.sql` | 6 tablas de Notebooks, RLS y `match_notebook_chunks()` |
| `migration_bm25.sql` | Búsqueda full-text y `search_notebook_chunks_fts()` |
| `migration_qr_studio.sql` | `qr_resources`, `workspace_assets` y `record_qr_scan()` |
| `20260226000000_create_spaced_repetition.sql` | Repetición espaciada |
| `20260531_complete_audio_voice_security_and_lifecycle.sql` | Perfiles de voz, transcripciones, eventos y sesiones |
| `20260616000000_secure_student_roster_access_codes.sql` | Nómina, códigos temporales y auditoría |
| `20260616053000_access_code_reuse_visibility.sql` | Visibilidad y reutilización de códigos |
| `202607210001_creative_templates.sql` | Biblioteca de plantillas creativas |

### Tablas creadas por estas migraciones

```text
notebooks                    notebook_sources
notebook_chunks              notebook_summaries
notebook_messages            notebook_outputs
qr_resources                 workspace_assets
spaced_repetition            audio_transcriptions
audio_voice_profiles         audio_voice_events
voice_security_sessions      student_roster
exam_access_codes            exam_access_code_audit
creative_templates
```

### Esquema base esperado

La aplicación también referencia tablas que deben existir en el proyecto Supabase conectado, entre ellas:

```text
profiles                     study_sessions
teacher_exams                exam_submissions
exam_attempt_drafts          exam_question_developments
exam_security_sessions       exam_security_events
exam_security_actions        exam_security_heartbeats
exam_security_admin_notes    exam_security_policies
exam_incidents               admin_emails
admin_reports                generated_images
projects                     workspace_items
paper_documents              paper_chunks
paper_extractions            video_jobs
video_usage_daily            achievements
missions                     conversations
chat_messages                friendships
notifications                study_rooms
room_members                 room_messages
long_memory                  saved_plannings
```

> El ZIP actual no contiene una migración única que cree todo el esquema base. Antes de desplegar desde cero, se debe incorporar o recuperar el esquema inicial de producción. También se referencian migraciones de video y autoguardado de examen que no están presentes entre los archivos incluidos.

### Buckets utilizados o esperados

```text
papers
creations
generated-images
chat-files
workspace-files
video-images
exam-development-artifacts
```

Los buckets privados deben configurarse con RLS y acceso por usuario o service role según el módulo.

---

## 🔐 Variables de entorno

No todas las variables son obligatorias. El mínimo depende de los módulos que se activen.

### Núcleo

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### Modelos de texto

```env
GEMINI_API_KEY=
GEMINI_API_KEY_POOL=
GEMINI_TEXT_MODEL_PRIMARY=
GEMINI_TEXT_MODEL_LITE=
GEMINI_FAST_MODEL=

GROQ_API_KEY=
GROQ_TEXT_MODEL=

OPENROUTER_API_KEY=
OPENROUTER_API_KEY_1=
OPENROUTER_REFERER=
OPENROUTER_APP_TITLE=EduAI Platform

TOGETHER_TEXT_MODEL=
CEREBRAS_API_KEY=
```

### Búsqueda y parsing

```env
SERPER_API_KEY=
TAVILY_API_KEY=
FIRECRAWL_API_KEY=
PLAYWRIGHT_WS_ENDPOINT=

DOCLING_PARSER_URL=
DOCLING_PARSER_TIMEOUT_MS=12000
PAPER_PARSER_TOKEN=
OCR_SPACE_API_KEY=
```

### Imagen

```env
IMAGE_PROVIDER_ORDER_FAST=pollinations,openrouter,together,huggingface
IMAGE_PROVIDER_ORDER_QUALITY=gemini,openrouter,together,huggingface,pollinations
IMAGE_PROVIDER_ORDER_EDUCATIONAL=
IMAGE_PROMPT_OPTIMIZER_ENABLED=true
IMAGE_PROMPT_OPTIMIZER_MODE=quality_only

GEMINI_IMAGE_MODEL_PRIMARY=
GEMINI_IMAGE_MODEL_SECONDARY=
GEMINI_IMAGE_MODEL_TERTIARY=
OPENROUTER_IMAGE_MODEL_PRIMARY=
OPENROUTER_IMAGE_MODEL_SECONDARY=
OPENROUTER_IMAGE_MODEL_TERTIARY=
TOGETHER_IMAGE_MODEL_PRIMARY=
TOGETHER_IMAGE_MODEL_SECONDARY=
TOGETHER_IMAGE_MODEL_TERTIARY=
HF_IMAGE_MODEL_PRIMARY=
HF_IMAGE_MODEL_SECONDARY=
POLLINATIONS_API_KEY=
POLLINATIONS_IMAGE_MODEL_PRIMARY=
POLLINATIONS_IMAGE_MODEL_SECONDARY=
POLLINATIONS_IMAGE_MODEL_TERTIARY=
```

### Audio, voz y MIRA

```env
AUDIO_PIPELINE_URL=
AUDIO_PIPELINE_PROVIDER=
AUDIO_PIPELINE_TOKEN=
AUDIO_DEFAULT_MODE=quick
AUDIO_SCRIPT_MODEL=
EDGE_TTS_VOICE_A=
EDGE_TTS_VOICE_B=
```

MIRA necesita `GROQ_API_KEY` para transcripción de voz y utiliza las claves configuradas en el AI Router para generar la respuesta.

### Música

```env
JAMENDO_CLIENT_ID=
JAMENDO_CLIENT_SECRET=
JAMENDO_REDIRECT_URI=
AUDIUS_API_HOST=https://discoveryprovider.audius.co
YOUTUBE_API_KEY=
RADIO_PROXY_BASE=
```

### Video

```env
VIDEO_PROVIDER_ORDER=ltx,cogvideox,hunyuan_i2v
VIDEO_CRON_SECRET=
CRON_SECRET=
HF_SPACE_VIDEO_API_URL=
HF_SPACE_VIDEO_API_TOKEN=
```

Los endpoints y modelos específicos de LTX, CogVideoX o Hunyuan se configuran según el worker utilizado.

### Pizarra

```env
WHITEBOARD_RECOGNITION_URL=
WHITEBOARD_RECOGNITION_HEADERS_JSON={}
WHITEBOARD_RECOGNITION_TIMEOUT_MS=6500
WHITEBOARD_RECOGNITION_CACHE_TTL_MS=12000
WHITEBOARD_RECOGNITION_CACHE_ITEMS=
WHITEBOARD_RECOGNITION_PAYLOAD_MODE=mathpix
WHITEBOARD_RECOGNITION_FORMATS=
WHITEBOARD_RECOGNITION_MAX_STROKES=
WHITEBOARD_RECOGNITION_MAX_POINTS_PER_STROKE=
WHITEBOARD_RECOGNITION_MIN_POINT_DISTANCE=
```

### Exámenes

```env
EXAM_ACCESS_CODE_SECRET=
EXAM_GENERATE_BATCH_SIZE=
EXAM_GENERATE_MAX_QUESTIONS=
EXAM_GENERATE_GROQ_MAX_TOKENS=
EXAM_LATEX_EVALUATOR_URL=
EXAM_LATEX_EVALUATOR_TOKEN=
```

### Cache y panel alternativo

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_PANEL_SUPABASE_URL=
NEXT_PUBLIC_PANEL_SUPABASE_ANON_KEY=
```

---

## 💻 Instalación y desarrollo

### Requisitos

- Node.js 22.x.
- npm.
- Proyecto Supabase.
- Claves de IA según los módulos que se usarán.
- Vercel para el despliegue recomendado.
- Python/Docker solo para microservicios opcionales.

### 1. Clonar

```bash
git clone https://github.com/innova-space-edu/eduai-platform.git
cd eduai-platform
```

### 2. Instalar

```bash
npm install
```

### 3. Configurar variables

```bash
cp .env.example .env.local
```

Si no existe `.env.example`, crear `.env.local` utilizando la sección anterior y añadir solo las claves necesarias.

### 4. Preparar Supabase

Ejecutar las migraciones incluidas y comprobar que el esquema base de la plataforma ya exista.

```text
migration.sql
migration_bm25.sql
migration_qr_studio.sql
supabase/migrations/*.sql
```

### 5. Validar currículo

```bash
npm run test:curriculum
```

Resultado esperado:

```text
Currículum MINEDUC: 105 archivos, 0 archivos pendientes, 0 advertencias, 0 errores.
```

### 6. Desarrollo

```bash
npm run dev
```

El script aplica automáticamente los parches idempotentes de Notebooks, Planificador, envío dual y MIRA antes de iniciar Next.js.

### 7. Tests focalizados

```bash
npm run test:planner
npm run test:exam
npm run test:curriculum
```

### 8. Build

```bash
npm run build
npm run start
```

El build valida currículo y ejecuta scripts de mantenimiento antes de compilar.

### 9. Microservicios opcionales

```bash
# Audio parser
cd services/audio-parser
docker build -t eduai-audio-parser .

# Paper parser
cd services/paper-parser
docker build -t eduai-paper-parser .

# OpenVoice privado
cd services/openvoice-space
docker build -t eduai-openvoice .
```

---

## ⚙️ Scripts disponibles

| Comando | Función |
|---------|---------|
| `npm run dev` | Aplica parches idempotentes y levanta Next.js |
| `npm run build` | Valida currículo, mantiene módulos y compila |
| `npm run start` | Inicia la compilación de producción |
| `npm run lint` | Ejecuta ESLint |
| `npm run planner:maintain` | Mantención del planificador |
| `npm run whiteboard:finalize` | Finaliza integración de pizarra |
| `npm run mira:voice` | Aplica modo de voz MIRA |
| `npm run test:planner` | Pruebas del planificador integral |
| `npm run test:exam` | Pruebas de cálculo y corrección |
| `npm run curriculum:index` | Regenera índice curricular |
| `npm run curriculum:validate` | Valida datos curriculares |
| `npm run test:curriculum` | Valida currículo en modo estricto |

La carpeta `scripts/` también incluye sincronizadores de Currículum Nacional, mantenimiento de formato, soporte de edición mixta y normalización del lockfile.

---

## 🔄 CI/CD y mantenimiento

### Workflows de GitHub Actions

| Workflow | Disparador | Función |
|----------|------------|---------|
| `ci.yml` | Push a `main` y Pull Request | Instala, valida TypeScript, lint, tests del planificador y build |
| `curriculum-validation.yml` | Cambios curriculares | Regenera índice, valida OA y compila |
| `deploy-audio-parser-hf.yml` | Cambios en audio parser o ejecución manual | Publica el parser en Hugging Face Spaces |
| `process-video.yml` | Cada 5 minutos o manual | Llama al procesador de cola de video |

### Vercel

`vercel.json` centraliza la duración máxima de funciones. Las rutas de audio, parsing, imágenes, exámenes y video usan runtime Node.js y límites compatibles con el plan configurado.

### Proxy y autenticación

`proxy.ts` reemplaza el middleware tradicional y se encarga de:

- Actualizar la sesión Supabase.
- Proteger rutas autenticadas.
- Redirigir según estado de sesión.
- Mantener compatibilidad con las rutas públicas de exámenes y QR.

---

## 🛡️ Seguridad, privacidad y accesibilidad

### Seguridad

- RLS en migraciones incluidas.
- Service role solo en endpoints de servidor.
- Rutas administrativas protegidas.
- Códigos de examen con hash y auditoría.
- Políticas de sesiones e incidentes.
- Guardrails del Superagente.
- Validación de ownership en Notebooks y QR.
- Validación de URL y fetch seguro.
- Límites de tamaño en audio y archivos.
- Tokens opcionales para microservicios.

### Voz y consentimiento

El módulo de perfiles de voz exige confirmaciones de titularidad o autorización, consentimiento y mayoría de edad. El servicio OpenVoice debe desplegarse de forma privada y con almacenamiento persistente protegido.

### Accesibilidad educativa

- Perfiles PIE/NEE.
- Dislexia, TDAH y baja visión.
- Temas de alto contraste.
- Tipografías accesibles.
- Narración TTS.
- Instrucciones por pasos.
- Pizarra y evidencia visual.
- Adaptación automática mediante la tool `adapt_for_pie`.

### Diseño

`DESIGN.md` define la identidad visual: estilo educativo moderno, tarjetas tipo Canva, modo institucional para administración y continuidad entre chat, multimedia y evaluación.

---

## 🧪 Estado funcional y requisitos pendientes

### Implementado en el código

- [x] Open EDUAI Work con archivos, citas y exportaciones.
- [x] MIRA con traducción y conversación por voz.
- [x] Creator Hub con 13 formatos.
- [x] Cuaderno Creativo con biblioteca de plantillas.
- [x] QR Studio con vencimiento, scans y descarga.
- [x] Pizarra Interactiva con reconocimiento a LaTeX.
- [x] Planificador MINEDUC con 105 archivos operativos validados.
- [x] Notebooks con RAG híbrido y RRF.
- [x] Exámenes con IA, temas, seguridad y accesibilidad.
- [x] Audio Lab y microservicios externos.
- [x] Image Studio multi-proveedor.
- [x] EduAI Music persistente.
- [x] Video Studio con jobs y procesamiento.
- [x] Admin Model Lab.
- [x] CI y validación curricular.

### Requiere configuración externa

- [ ] Esquema base completo de Supabase para una instalación desde cero.
- [ ] Migración de `video_jobs` y `video_usage_daily` referenciada en documentación.
- [ ] Migración de autoguardado de exámenes si no existe en la base de producción.
- [ ] Proveedor real de video o worker GPU.
- [ ] Parser/worker externo para Audio Lab Pro.
- [ ] Space privado para clonación o síntesis de voz personalizada.
- [ ] Proveedor de reconocimiento de trazos para la pizarra.
- [ ] API keys de búsqueda, imagen, audio y modelos según cada módulo.

---

## 🛣️ Roadmap sugerido

- Unificar y versionar el esquema base completo de Supabase.
- Añadir migraciones faltantes de video y autoguardado.
- Crear `.env.example` sin secretos.
- Agregar tests end-to-end para login, planificación, examen y Notebooks.
- Consolidar parches `apply-*.mjs` en código fuente estable.
- Añadir observabilidad de costos, latencia y errores por proveedor.
- Completar auditoría del Admin Model Lab.
- Integrar procesamiento asíncrono de audio y video.
- Añadir exportaciones visuales avanzadas tipo Canva en Creator Hub.
- Ampliar colaboración en tiempo real y permisos por institución.

---

## 🤝 Contribuir

1. Crear un fork o una rama de trabajo.
2. Instalar dependencias.
3. Ejecutar validaciones y tests.
4. Usar commits descriptivos.
5. Abrir un Pull Request con el alcance y evidencias.

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

El proyecto se distribuye bajo la **MIT License**. Consulta [LICENSE](LICENSE) para conocer los términos completos.

---

<div align="center">

**EduAI Platform — Educación, tecnología e inteligencia artificial en un solo ecosistema.**

**[🌐 Plataforma](https://eduaiplatformclon.vercel.app)** · **[🏢 Innova Space Edu](https://innova-space-edu.cl/)** · **[💻 GitHub](https://github.com/innova-space-edu/eduai-platform)**

</div>
