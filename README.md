<div align="center">

# EDUAI Platform

### Ecosistema educativo inteligente para docentes, creación de materiales, evaluación, investigación y multimedia

[![Next.js](https://img.shields.io/badge/Next.js-16.3.5-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Dominio EDUAI:** https://eduai.innova-space-edu.cl  
**Deployment:** https://eduaiplatformclon.vercel.app  
**Organización:** Innova Space Education SpA

</div>

---

## Estado del proyecto — 28 de septiembre de 2026

El repositorio contiene actualmente:

| Indicador | Estado |
|---|---:|
| Páginas de aplicación `page.tsx` | **116** |
| Rutas API `route.ts` | **177** |
| Endpoints bajo `/api/agents` | **57** |
| Agentes y espacios visibles en `/agentes` | **21** |
| Herramientas ejecutables del Superagente | **16** |
| Rutas del área Creator Hub | **34** |
| Archivos SQL incluidos en el repositorio | **61** |
| Runtime | **Next.js 16.3.5 · React 19.2.3 · Node 22 · TypeScript 5** |
| Base de datos y autenticación | **Supabase / PostgreSQL** |

> Los conteos anteriores corresponden al árbol actual del repositorio y deben actualizarse cuando cambie la arquitectura.

---

## ¿Qué es EDUAI?

**EDUAI Platform** es un ecosistema educativo desarrollado para centralizar en una sola plataforma tareas que normalmente requieren múltiples aplicaciones:

- planificación docente;
- creación de actividades y evaluaciones;
- alineación curricular MINEDUC;
- adaptación PIE/NEE;
- investigación y trabajo con documentos;
- generación de materiales educativos;
- imágenes, audio, voz, video y música;
- cuadernos y pizarras digitales;
- repositorio, biblioteca y espacios de trabajo;
- colaboración;
- agentes especializados;
- automatización y orquestación mediante **Claw**.

El objetivo es que el usuario pueda pasar de una idea a un producto educativo utilizable sin abandonar EDUAI.

---

# Claw — Copiloto Docente EDUAI

La primera experiencia principal de **ChatClaw** está orientada a **docentes**.

El componente principal se encuentra en:

```text
components/dashboard/ClawStudyConsole.tsx
app/api/agents/claw-chat/route.ts
lib/superagent/superagent-core.ts
lib/superagent/tool-registry.ts
lib/superagent/eduai-map.ts
```

### Comportamiento docente

Claw puede:

- conversar de manera natural;
- planificar clases;
- crear actividades;
- generar evaluaciones;
- construir rúbricas;
- adaptar contenidos para PIE/NEE;
- crear o derivar recursos visuales;
- resumir y revisar textos;
- navegar hacia módulos de EDUAI;
- utilizar herramientas registradas en el Superagente;
- conservar el contexto de **curso** y **asignatura** durante la conversación;
- pedir solo el dato esencial cuando falta información;
- diferenciar entre una sugerencia, un borrador y una acción realmente ejecutada.

### Sincronización automática de herramientas

ChatClaw no depende únicamente de botones definidos manualmente.

La consola consulta `/api/agents/claw-chat` y recibe las herramientas habilitadas directamente desde:

```text
lib/superagent/tool-registry.ts
```

También sincroniza los módulos disponibles desde:

```text
lib/superagent/eduai-map.ts
```

Esto permite que una herramienta nueva registrada y habilitada pueda aparecer en ChatClaw sin duplicar su definición en la interfaz.

La selección explícita de una herramienta se valida nuevamente en el backend antes de ejecutarla.

> La futura experiencia para estudiantes debe mantenerse separada del modo docente para poder definir permisos, tono, herramientas y flujos distintos.

---

# Herramientas actuales de Claw

El registro central contiene 16 herramientas ejecutables:

```text
generate_exam_questions
adapt_for_pie
plan_curriculum
explain_concept
generate_rubric
summarize_text
translate_text
proofread_text
generate_image_prompt
generate_image
narrate_text
generate_podcast
generate_edu_video
recommend_focus_music
generate_code
fix_code_error
```

Las herramientas pueden utilizar APIs internas de EDUAI y el Gateway de IA manteniendo autenticación, contexto y trazabilidad.

---

# Agentes y espacios visibles

La página `/agentes` contiene actualmente 21 entradas principales:

| # | Agente / espacio | Ruta | Función |
|---:|---|---|---|
| 1 | Planificador | `/educador` | Planificación docente y currículo MINEDUC |
| 2 | Investigador | `/investigador` | Investigación, búsqueda y síntesis |
| 3 | Redactor | `/redactor` | Documentos, informes y escritura |
| 4 | Matemático | `/matematico` | Resolución matemática y LaTeX |
| 5 | Pizarra interactiva | `/pizarra-interactiva` | Cuaderno digital, dibujo y gráficos |
| 6 | Cuaderno creativo | `/cuaderno-creativo` | Dibujo, pintura y plantillas |
| 7 | Traductor | `/traductor` | Traducción y voz |
| 8 | Chat Paper | `/paper` | Conversación con documentos PDF |
| 9 | Examen | `/examen` | Ejecución de evaluaciones |
| 10 | Exámenes Docente | `/examen/docente` | Creación y administración de evaluaciones |
| 11 | Open EDUAI Work | `/chat-global` | Espacio integral de trabajo |
| 12 | EDUAI Music | `/music` | Reproducción, listas y música de apoyo |
| 13 | Creator Hub | `/creator-hub` | Creación de productos educativos |
| 14 | Audio Lab | `/audio-lab` | Transcripción, audio y voz |
| 15 | Image Studio | `/image-studio` | Generación y reutilización de imágenes |
| 16 | Video Studio | `/video-studio` | Generación y seguimiento de videos |
| 17 | Galería | `/galeria` | Recursos visuales generados |
| 18 | Ranking | `/ranking` | XP, rachas y gamificación |
| 19 | Workspace | `/workspace` | Organización de proyectos |
| 20 | Biblioteca | `/biblioteca` | Catálogo y lectura digital |
| 21 | Repositorio | `/repositorio` | Organización y distribución de recursos |

---

# Planificación docente y currículo MINEDUC

El módulo `/educador` concentra el trabajo de planificación.

Incluye, entre otras funciones:

- selección de nivel, curso y asignatura;
- uso de objetivos y datos curriculares;
- planificación por clase y por periodos;
- planificación curricular;
- generación de actividades;
- indicadores y evaluación;
- recursos;
- soporte PIE/NEE;
- vista previa editable;
- exportación documental;
- validación curricular durante el build.

### Educación Parvularia

El flujo de Parvularia contempla una estructura específica:

- planificación de mañana, periodo intermedio y tarde;
- OA independiente por planificación;
- OAT diferenciados;
- ámbitos y núcleos;
- actividades para múltiples niveles;
- registro de planificaciones generadas;
- separación visual de actividades y días;
- corpus de referencia para mejorar la generación.

### Vista previa

La ruta `/educador/vista-previa` permite trabajar el resultado como documento visual antes de exportarlo.

---

# Evaluaciones

EDUAI incluye un sistema completo de evaluación docente y ejecución de exámenes.

Principales capacidades:

- creación de evaluaciones;
- preguntas de alternativas;
- verdadero/falso;
- desarrollo;
- rúbricas;
- importación de documentos;
- corrección y retroalimentación;
- tiempo de examen;
- revisión docente;
- resultados;
- re-evaluación de respuestas matemáticas;
- configuración de acceso;
- APIs diferenciadas para examen y examen docente.

Rutas principales:

```text
/examen
/examen/crear
/examen/docente
/examen/resultados
```

Entre las APIs relacionadas se encuentran:

```text
/api/agents/exam-generate
/api/agents/exam-import
/api/agents/exam-feedback
/api/agents/exam-math-rescore
/api/agents/exam-time
/api/agents/examen
/api/agents/examen-docente
```

---

# Creator Hub

`/creator-hub` centraliza la generación de materiales educativos.

El área posee actualmente **34 rutas de página** y cubre formatos y flujos como:

- presentaciones;
- infografías;
- guías y worksheets;
- rúbricas;
- quizzes;
- mapas mentales;
- líneas de tiempo;
- posters;
- historias;
- comics;
- flashcards;
- informes;
- planificaciones;
- recursos de laboratorio;
- podcast;
- canciones;
- notebooks;
- proyectos;
- plantillas;
- materiales reutilizables;
- compartir resultados.

Creator Hub mantiene proyectos, versiones y flujos de creación diferenciados por formato.

---

# Open EDUAI Work

`/chat-global` es un espacio de trabajo amplio conectado con el ecosistema EDUAI.

Permite combinar:

- conversación;
- investigación;
- creación;
- documentos;
- archivos;
- agentes;
- herramientas;
- fuentes;
- resultados reutilizables.

Está pensado para tareas que requieren más contexto o combinan varias capacidades.

---

# Notebooks, RAG y documentos

EDUAI incluye espacios orientados al trabajo con información y fuentes:

### EDUAI Notebooks

`/notebooks`

- organización de fuentes;
- conversación contextual;
- recuperación de información;
- chat asociado a cada notebook;
- integración con documentos.

### Chat Paper

`/paper`

- carga y extracción de PDF;
- lectura asistida;
- preguntas sobre el documento;
- síntesis;
- procesamiento estructurado.

### Investigación

`/investigador`

- búsqueda;
- análisis;
- síntesis;
- preparación de material académico.

---

# Biblioteca, Repositorio y Workspace

### Biblioteca — `/biblioteca`

Espacio para catálogo, colecciones y lectura de recursos digitales.

### Repositorio — `/repositorio`

Incluye flujos de:

- carpetas;
- organización por curso y asignatura;
- navegación;
- recursos;
- compartir;
- acceso público controlado;
- carga directa cuando la infraestructura está disponible.

### Workspace — `/workspace`

Agrupa proyectos, archivos y resultados generados por otros módulos.

---

# Pizarra Interactiva y Cuaderno Creativo

## Pizarra Interactiva

`/pizarra-interactiva`

Funciona como un cuaderno digital multipágina con:

- escritura y dibujo libre;
- figuras;
- gráficos;
- elementos 2D y 3D;
- texto;
- imágenes;
- cámara;
- recursos generados por IA;
- organización de páginas;
- exportación.

## Cuaderno Creativo

`/cuaderno-creativo`

Orientado a dibujo, pintura, actividades visuales y plantillas.

---

# Audio, voz y MIRA

## Audio Lab

`/audio-lab`

El backend posee rutas para:

- generación;
- pipeline de procesamiento;
- exportación;
- transcripción;
- procesamiento de URL;
- subida mediante URL;
- perfiles de voz;
- estado;
- seguridad;
- términos de uso.

El chat principal también puede dictar mensajes por micrófono y enviar el audio al pipeline de transcripción.

## MIRA

EDUAI incorpora MIRA para interacción asistida y voz, con endpoints específicos para voz y traducción.

---

# Image Studio

`/image-studio`

Funciones principales:

- generación de imágenes;
- proveedores intercambiables;
- previsualización;
- reutilización;
- galería;
- uso desde otras herramientas de EDUAI;
- integración con Claw.

La generación se expone también a través de:

```text
/api/agents/imagenes
/api/agents/imagenes/preview
```

---

# Video Studio y Multimedia

## Video Studio

`/video-studio`

Dispone de:

- generación desde texto;
- generación desde imagen cuando el proveedor lo permite;
- trabajos asíncronos;
- consulta de estado;
- historial personal;
- procesamiento;
- integración con Claw.

## Multimedia Studio

`/multimedia-studio`

Área destinada a edición y procesamiento multimedia, con soporte para proyectos, audio y monitorización de medios.

---

# EDUAI Music

`/music`

Incluye reproductor de música orientado a EDUAI con:

- búsqueda;
- listas;
- favoritos;
- reproducción persistente;
- navegación;
- integración con fuentes externas;
- uso como apoyo de concentración.

Claw puede recomendar sesiones de música según el tipo de actividad.

---

# QR Studio

`/qr-studio`

Permite generar recursos QR para compartir contenido, enlaces y materiales dentro del ecosistema.

---

# Colaboración y comunicación

EDUAI incluye:

- `/collab` para trabajo colaborativo;
- `/chat` para mensajería;
- presencia;
- amigos/contactos;
- notificaciones;
- subida de archivos;
- `/ai-social` para interacción entre agentes y extracción de ideas.

---

# Arquitectura de IA

La capa de IA está centralizada en:

```text
lib/ai/
lib/superagent/
```

## AI Gateway

`lib/ai/gateway.ts` se encarga de:

- seleccionar capacidad;
- resolver proveedores y modelos;
- aplicar política de acceso;
- manejar timeouts;
- reutilizar generaciones cuando corresponde;
- registrar proveedor, modelo y latencia;
- aplicar fallback entre proveedores compatibles;
- gestionar contexto privado por usuario.

El gateway soporta Google y proveedores compatibles con API estilo OpenAI según la configuración disponible.

## Superagente

`lib/superagent/` contiene:

- núcleo conversacional;
- registro de tools;
- router;
- guardrails;
- ejecución de acciones;
- borradores;
- mapa de páginas;
- flujos sociales;
- skills.

---

# Supabase

Supabase proporciona:

- autenticación;
- perfiles;
- persistencia;
- almacenamiento de datos;
- permisos;
- sesiones;
- información de evaluaciones;
- proyectos;
- contenidos generados;
- analítica y registros operativos.

El repositorio contiene actualmente **61 archivos SQL** entre migraciones, esquemas y scripts de soporte.

---

# Seguridad y privacidad

El proyecto aplica controles en distintas capas:

- autenticación con Supabase;
- validación de usuario en endpoints sensibles;
- políticas de acceso para capacidades IA;
- separación de funciones administrativas;
- contexto privado por usuario en el gateway;
- guardrails del Superagente;
- validaciones de archivos;
- controles de seguridad para audio y perfiles de voz;
- páginas de privacidad, términos, seguridad y gobernanza IA.

Rutas informativas:

```text
/privacidad
/terminos
/seguridad
/gobernanza-ia
/soporte
```

---

# Administración

`/admin` contiene herramientas restringidas para administración de la plataforma, usuarios, seguridad, métricas y operación.

Las funciones internas de administración no forman parte de la documentación funcional pública del producto.

---

# Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.3.5 |
| UI | React 19.2.3 |
| Lenguaje | TypeScript 5 |
| Runtime | Node.js 22 |
| Estilos | Tailwind CSS 4 |
| Base de datos | Supabase / PostgreSQL |
| Auth | Supabase Auth |
| Estado cliente | Zustand / React state |
| Data fetching | TanStack Query |
| Matemática | KaTeX / react-katex |
| Diagramas | Mermaid |
| PDF | pdf-parse / jsPDF |
| Documentos | Mammoth |
| Hojas de cálculo | SheetJS |
| Animación | Framer Motion |
| Audio | Edge TTS / Web Audio / MediaBunny |
| IA | Google GenAI + proveedores compatibles mediante Gateway |

---

# Estructura principal

```text
app/
  admin/
  agentes/
  api/
  audio-lab/
  biblioteca/
  chat/
  chat-global/
  collab/
  creator-hub/
  cuaderno-creativo/
  dashboard/
  educador/
  examen/
  galeria/
  image-studio/
  investigador/
  matematico/
  multimedia-studio/
  music/
  notebooks/
  paper/
  pizarra-interactiva/
  qr-studio/
  redactor/
  repositorio/
  superagent/
  traductor/
  video-studio/
  workspace/

components/
lib/
  ai/
  agents/
  superagent/
scripts/
supabase/
training/
```

---

# Desarrollo

Instalar dependencias:

```bash
npm install
```

Entorno de desarrollo:

```bash
npm run dev
```

Build de producción:

```bash
npm run build
```

Validación curricular:

```bash
npm run test:curriculum
```

Pruebas principales disponibles:

```bash
npm run test:planner
npm run test:exam
npm run test:exam-omni
npm run test:exam-import
npm run test:agents
npm run test:creator
npm run test:whiteboard
npm run test:repository
npm run test:paper
npm run test:mira
```

---

# Principios de mantenimiento

Para evitar que la plataforma se fragmente:

1. Las tools de Claw deben registrarse en `lib/superagent/tool-registry.ts`.
2. Los módulos navegables por Claw deben registrarse en `lib/superagent/eduai-map.ts`.
3. Las nuevas capacidades IA deben pasar por el Gateway cuando corresponda.
4. Las APIs deben validar autenticación y permisos.
5. Los módulos docentes deben reutilizar contexto de curso y asignatura cuando ya esté disponible.
6. Los cambios importantes deben acompañarse de pruebas o validaciones.
7. El README debe actualizarse cuando cambien módulos, rutas centrales o capacidades visibles.

---

# Licencia

El archivo `LICENSE` del repositorio declara **MIT License**:

> Copyright (c) 2026 Innova Space Education SPA

Los componentes y servicios de terceros mantienen sus propias licencias y términos de uso.

---

<div align="center">

**EDUAI Platform · Innova Space Education SpA · 2026**

</div>
