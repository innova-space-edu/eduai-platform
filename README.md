<div align="center">

```text
███████╗██████╗ ██╗   ██╗ █████╗ ██╗
██╔════╝██╔══██╗██║   ██║██╔══██╗██║
█████╗  ██║  ██║██║   ██║███████║██║
██╔══╝  ██║  ██║██║   ██║██╔══██║██║
███████╗██████╔╝╚██████╔╝██║  ██║██║
╚══════╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝
```

### 🎓 Ecosistema Educativo Inteligente Multiagente y Multimodal

[![Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel)](https://eduaiplatformclon.vercel.app)
![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Teachers](https://img.shields.io/badge/Teachers-Free%20to%20use-16a34a)
![Code](https://img.shields.io/badge/Code-Private%20%26%20Proprietary-7c3aed)
![Owner](https://img.shields.io/badge/Owner-Innova%20Space%20Edu%20SpA-0f172a)

**[🌐 Ver plataforma](https://eduaiplatformclon.vercel.app)** · **[🏢 Innova Space Education](https://innova-space-edu.cl/)** · **[✉️ Contacto](mailto:contacto@innova-space-edu.cl)**

</div>

---

> [!IMPORTANT]
> **EduAI es de uso gratuito para docentes — Free to use for teachers.** Esta gratuidad corresponde al acceso y uso educativo de la plataforma bajo sus términos vigentes.
>
> **El código fuente es privado y propietario.** El acceso gratuito a la plataforma no convierte el software en código libre, no concede acceso al repositorio y no autoriza copiar, modificar, redistribuir, sublicenciar, vender ni reutilizar su código.
>
> **EduAI Platform, su código, arquitectura, identidad visual, documentación técnica y desarrollos propios son propiedad de Innova Space Education SpA.** Los componentes de terceros conservan sus licencias originales.

---

## 📌 Estado verificado del proyecto

Este documento fue actualizado a partir del contenido real incluido en el proyecto.

<div align="center">

| Indicador | Estado actual |
|-----------|---------------|
| **Páginas de aplicación** | 104 rutas `page.tsx` |
| **APIs internas** | 135 rutas `route.ts` |
| **Agentes y espacios visibles** | 19 entradas en `/agentes` |
| **Herramientas de EduAI Claw** | 16 tools ejecutables |
| **Skills del Superagente** | 12 skills registradas |
| **Formatos educativos de Creator Hub** | 23 formatos |
| **Páginas del área Creator Hub** | 34 rutas |
| **Currículo MINEDUC operativo** | 105 archivos validados en modo estricto |
| **Migraciones SQL incluidas** | 13 archivos SQL |
| **Dependencias** | 35 de producción + 10 de desarrollo |
| **Runtime principal** | Next.js 16 · React 19 · Node.js 22 · TypeScript 5 |
| **Modelo de distribución** | Plataforma gratuita para docentes · código privado y propietario |

</div>

> La validación curricular se ejecuta con `npm run test:curriculum` y actualmente informa: **105 archivos, 0 pendientes, 0 advertencias y 0 errores**.

---

## 🧭 Contenidos

1. [¿Qué es EduAI Platform?](#-qué-es-eduai-platform)
2. [Principios de acceso y propiedad](#-principios-de-acceso-y-propiedad)
3. [Novedades incorporadas](#-novedades-incorporadas)
4. [Mapa de módulos](#-mapa-de-módulos)
5. [Agentes y espacios activos](#-agentes-y-espacios-activos)
6. [EduAI Claw](#-eduai-claw--superagente)
7. [Open EDUAI Work](#-open-eduai-work)
8. [Planificador MINEDUC y editor visual](#-planificador-mineduc-y-editor-visual)
9. [Notebooks, RAG y Chat Paper](#-eduai-notebooks-rag-y-chat-paper)
10. [Creator Hub](#-creator-hub)
11. [Pizarra Interactiva](#-pizarra-interactiva)
12. [Cuaderno Creativo y QR Studio](#-cuaderno-creativo-y-qr-studio)
13. [Sistema de exámenes](#-sistema-de-exámenes)
14. [Audio Lab, canciones, voces y MIRA](#-audio-lab-canciones-voces-y-mira)
15. [Imagen, video y música](#-imagen-video-y-música)
16. [Colaboración, gamificación y administración](#-colaboración-gamificación-y-administración)
17. [Arquitectura y estructura](#-arquitectura-y-estructura)
18. [Base de datos y migraciones](#-base-de-datos-y-migraciones)
19. [Desarrollo interno y CI/CD](#-desarrollo-interno-y-cicd)
20. [Seguridad, privacidad y accesibilidad](#-seguridad-privacidad-y-accesibilidad)
21. [Estado funcional y roadmap](#-estado-funcional-y-roadmap)
22. [Créditos, propiedad y licencia](#-créditos-propiedad-y-licencia)

---

## 🚀 ¿Qué es EduAI Platform?

**EduAI Platform** es una plataforma educativa chilena que integra planificación curricular, agentes especializados, investigación con fuentes, creación de materiales, evaluación digital, multimedia, accesibilidad y colaboración en un único ecosistema.

La aplicación combina asistentes conversacionales, espacios de investigación con documentos, herramientas visuales, cuadernos digitales, generación multimedia, evaluación docente y un superagente central llamado **EduAI Claw**.

### Propósito

- Ayudar a estudiantes a comprender, practicar, investigar y crear.
- Entregar a docentes herramientas para planificar, evaluar y producir materiales.
- Integrar IA generativa sin obligar a trabajar en múltiples plataformas separadas.
- Mantener alineación con el currículo chileno y las necesidades PIE/NEE.
- Convertir resultados en productos utilizables: PDF, Word compatible, PPTX, XLSX, audio, imágenes, videos, QR, exámenes y proyectos.
- Mantener el acceso docente como **uso gratuito para profesores**, sin liberar el código fuente.

### Perfiles principales

| Perfil | Capacidades principales |
|--------|--------------------------|
| **Estudiante** | Estudio adaptativo, modo socrático, evaluaciones, cuaderno digital, TTS, Notebooks, música, XP y colaboración |
| **Docente** | Planificación MINEDUC, editor visual, exámenes, rúbricas, Creator Hub, Audio Lab, QR y Workspace |
| **Administrador** | Usuarios, reportes, seguridad de exámenes, códigos de acceso, auditoría, analítica y Admin Model Lab |

---

## 🔐 Principios de acceso y propiedad

### Uso gratuito para docentes

EduAI se ofrece como una herramienta de **uso gratuito para docentes**. Esta condición busca facilitar la planificación, la creación de materiales, la evaluación y el uso pedagógico de inteligencia artificial.

La disponibilidad gratuita puede estar sujeta a:

- registro de usuario;
- límites técnicos razonables;
- disponibilidad de proveedores externos;
- políticas de uso responsable;
- términos de servicio de la plataforma;
- condiciones especiales para instituciones o despliegues personalizados.

### Código privado

El repositorio de producción y el código fuente de EduAI son privados. No se distribuyen como software libre ni como proyecto de código abierto.

No se autoriza, salvo permiso escrito de Innova Space Education SpA:

- copiar o publicar el código fuente;
- redistribuir archivos del proyecto;
- crear productos derivados basados en el código;
- sublicenciar, vender o comercializar el software;
- retirar avisos de propiedad;
- realizar ingeniería inversa cuando la legislación aplicable lo permita restringir;
- reutilizar la identidad visual, marcas o documentación técnica propietaria.

### Diferencia entre plataforma gratuita y código libre

| Concepto | Condición de EduAI |
|----------|--------------------|
| Uso de la plataforma por docentes | **Gratuito** |
| Acceso al código fuente | **Privado** |
| Licencia del código propio | **Propietaria** |
| Copia o redistribución del código | **No autorizada** |
| Uso institucional personalizado | Sujeto a autorización o acuerdo |
| Librerías de terceros | Conservan sus licencias originales |

---

## ✨ Novedades incorporadas

### 1. Editor visual completo para planificaciones

La ruta `/educador/vista-previa` transforma la planificación generada en un documento visual editable:

- documento multipágina;
- hojas A4, Carta y Oficio;
- orientación vertical u horizontal;
- selección individual, múltiple y mediante cuadro de selección;
- arrastre libre con mouse, lápiz o pantalla táctil;
- redimensionado desde ocho controles;
- rotación de elementos;
- agrupación, bloqueo, alineación, distribución y orden de capas;
- copiar, cortar, pegar, duplicar, deshacer y rehacer;
- movimiento con flechas y desplazamiento ampliado con `Shift`;
- eliminación mediante `Supr` o `Retroceso`;
- imágenes movibles, redimensionables, rotables y ajustables;
- 15 familias tipográficas;
- tamaños desde 8 hasta 96 px y tamaño personalizado;
- paleta ampliada de 50 colores más selector personalizado;
- estilos profesional, colorido, parvularia y minimalista;
- cuadrícula, ajuste magnético y zoom;
- exportación directa a PDF;
- exportación Word compatible en formato `.doc`;
- impresión, copia de texto y guardado automático del borrador.

### 2. Pizarra Interactiva convertida en cuaderno digital

La pizarra dejó de depender del reconocimiento matemático como función principal y se consolidó como un cuaderno digital multipágina:

- escritura y dibujo libre;
- fondos por página;
- figuras geométricas 2D;
- sólidos geométricos 3D de alambre;
- vectores, ángulos, líneas y flechas;
- gráficos vacíos 2D, 3D, polares, científicos y rectas numéricas;
- texto, imágenes, cámara y generación de imágenes con IA;
- elementos superpuestos, movibles y redimensionables;
- importación y exportación del cuaderno editable;
- exportación PNG y PDF;
- guardado local y sincronización cuando el backend está configurado.

### 3. Responsive diferenciado por tipo de pantalla

La Pizarra Interactiva y el Cuaderno Creativo ahora usan distribuciones distintas para:

- **pantallas pequeñas**, con el lienzo como contenido principal y herramientas en panel desplegable;
- **notebooks y computadores**, con distribución estándar de escritorio;
- **pantallas táctiles gigantes**, incluida la experiencia para pizarras de aproximadamente 86 pulgadas, con paneles compactos y área de trabajo prioritaria.

### 4. Creator Hub ampliado

Creator Hub incorpora 23 formatos educativos, edición de contenido, proyectos, versiones, plantillas, colaboración, transformación entre formatos, revisión de calidad y exportaciones específicas.

### 5. Nuevas bases y módulos

- Analítica administrativa de uso por módulo y agente.
- Base de proyectos y versiones para Creator Hub.
- Colaboración en proyectos de Creator Hub.
- Persistencia estructurada para cuadernos de la Pizarra Interactiva y motor matemático opcional con SymPy.
- Estudio de canciones con IA dentro de Audio Lab y servicio privado ACE-Step.
- Nuevas pruebas focalizadas para Creator Hub y Pizarra.

---

## 🗺️ Mapa de módulos

<div align="center">

| Módulo | Ruta principal | Función |
|--------|----------------|---------|
| 🏠 **Dashboard** | `/dashboard` | Inicio, estadísticas, sesiones, accesos rápidos y consola Claw |
| 📚 **Sesión de estudio** | `/study/[topic]` | Teoría, diagnóstico, quiz, resumen, modo socrático y visualizaciones |
| 🤖 **Agentes EduAI** | `/agentes` | Catálogo central de agentes y herramientas activas |
| ✦ **Open EDUAI Work** | `/chat-global` | Preguntar, investigar, crear, colaborar y ejecutar con fuentes y archivos |
| 🦾 **EduAI Claw** | `/superagent` | Orquestador, herramientas, borradores, guardrails y chat social |
| 🏫 **Planificador** | `/educador` | Planificaciones alineadas a OA oficiales MINEDUC |
| 👁️ **Editor de planificación** | `/educador/vista-previa` | Vista previa editable, multipágina y exportable |
| 🗓️ **Planificador curricular** | `/educador/planificador-curricular` | Planificación diaria, semanal, mensual, semestral y anual |
| 📓 **EduAI Notebooks** | `/notebooks` | Fuentes, RAG híbrido, chat con citas y Studio |
| 📄 **Chat Paper** | `/paper` | Lectura y conversación profunda con PDF |
| 🎨 **Creator Hub** | `/creator-hub` | 23 formatos educativos, proyectos, plantillas y exportaciones |
| ✍️ **Pizarra Interactiva** | `/pizarra-interactiva` | Cuaderno digital con trazos, figuras, gráficos, cámara e imágenes IA |
| 🖍️ **Cuaderno Creativo** | `/cuaderno-creativo` | Dibujo, pintura y biblioteca privada de plantillas |
| 🌐 **MIRA Traductor** | `/traductor` | Traducción escrita, interpretación por voz y conversación bilingüe |
| 📝 **Exámenes** | `/examen` | Simulacro, creación docente, publicación, resultados y revisión |
| 🎙️ **Audio Lab** | `/audio-lab` | Transcripción, edición, procesamiento y perfiles de voz |
| 🎵 **Estudio de canciones** | `/audio-lab/songs` | Composición y seguimiento de canciones generadas |
| 🖼️ **Image Studio** | `/image-studio` | Generación visual multi-proveedor y galería |
| 🎬 **Video Studio** | `/video-studio` | Texto-a-video, imagen-a-video, cola y seguimiento de trabajos |
| 🎵 **EduAI Music** | `/music` | Reproductor persistente, playlists, búsqueda y fuentes externas |
| ▦ **QR Studio** | `/qr-studio` | Recursos compartibles, vencimiento, escaneos y PNG |
| 📁 **Workspace** | `/workspace` | Proyectos, archivos, enlaces y materiales generados |
| 💬 **Colaboración** | `/collab` | Salas multiusuario y moderación con IA |
| 🧠 **Chat social** | `/ai-social` | Conversaciones internas entre agentes y extracción de ideas |
| 🏆 **Ranking** | `/ranking` | XP, rachas, logros y tabla de posiciones |
| ⚖️ **Gobernanza IA** | `/gobernanza-ia` | Información y criterios de uso responsable de IA |
| 🛡️ **Administración** | `/admin` | Usuarios, exámenes, seguridad, analítica y Model Lab |

</div>

---

## 🤖 Agentes y espacios activos

La página `/agentes` contiene 19 entradas verificadas.

| # | Agente o espacio | Ruta | Estado | Función principal |
|--:|------------------|------|--------|------------------|
| 1 | **Planificador** | `/educador` | Activo | Planificación docente alineada al currículo chileno |
| 2 | **Investigador** | `/investigador` | Activo | Búsqueda, síntesis y análisis de fuentes |
| 3 | **Redactor** | `/redactor` | Activo | Ensayos, informes, cartas y documentos |
| 4 | **Matemático** | `/matematico` | Activo | Resolución paso a paso y LaTeX |
| 5 | **Pizarra Interactiva** | `/pizarra-interactiva` | Activo | Cuaderno digital, figuras, gráficos y medios |
| 6 | **Cuaderno Creativo** | `/cuaderno-creativo` | Activo | Dibujo, coloreado y plantillas |
| 7 | **Traductor MIRA** | `/traductor` | Activo | Traducción, conversación e interpretación por voz |
| 8 | **Chat Paper** | `/paper` | Activo | Conversación con documentos PDF |
| 9 | **Examen** | `/examen` | Activo | Simulacro con timer y corrección |
| 10 | **Exámenes Docente** | `/examen/docente` | Activo | Creación, publicación, resultados y revisión |
| 11 | **Open EDUAI Work** | `/chat-global` | Activo | Espacio integral conectado a Claw |
| 12 | **EduAI Music** | `/music` | Activo | Música persistente y playlists |
| 13 | **Creator Hub** | `/creator-hub` | Activo | Materiales y productos educativos |
| 14 | **Audio Lab** | `/audio-lab` | Activo | Audio, transcripción, canciones y voces |
| 15 | **Image Studio** | `/image-studio` | Activo | Imágenes IA multi-proveedor |
| 16 | **Video Studio** | `/video-studio` | Mantenimiento | Generación y seguimiento de videos |
| 17 | **Galería** | `/galeria` | Activo | Historial y reutilización de imágenes |
| 18 | **Ranking** | `/ranking` | Activo | Gamificación, XP y rachas |
| 19 | **Workspace** | `/workspace` | Activo | Organización de proyectos y recursos |

---

## 🦾 EduAI Claw — Superagente

EduAI Claw es el orquestador central. Observa el contexto, selecciona herramientas, prepara borradores, sugiere próximos pasos y limita acciones no autorizadas mediante guardrails.

### Componentes principales

| Archivo | Responsabilidad |
|---------|-----------------|
| `lib/superagent/engine.ts` | Motor principal de coordinación |
| `lib/superagent/router.ts` | Selección de target y skill |
| `lib/superagent/guardrails.ts` | Restricciones de seguridad |
| `lib/superagent/action-router.ts` | Detección de intención y acciones sugeridas |
| `lib/superagent/action-executor.ts` | Ejecución controlada de acciones |
| `lib/superagent/draft-engine.ts` | Creación de borradores |
| `lib/superagent/social-engine.ts` | Conversación social entre agentes |
| `lib/superagent/superagent-core.ts` | Núcleo compatible con chat y tool calling |
| `lib/superagent/tool-registry.ts` | Registro de herramientas ejecutables |
| `lib/superagent/registry.ts` | Registro y filtrado de skills |
| `lib/superagent/eduai-map.ts` | Mapa de navegación de EduAI |

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

### Guardrails

- No inspecciona secretos.
- No inyecta mensajes en chats privados.
- No sobrescribe producción autónomamente.
- No habilita automodificación del sistema.
- Limita sugerencias, borradores y skills por ciclo.
- Diferencia permisos por contexto y rol.

---

## ✦ Open EDUAI Work

`/chat-global` es el espacio de trabajo integral de EduAI.

### Modos de trabajo

| Modo | Objetivo |
|------|----------|
| **Preguntar** | Explicar, comparar, analizar y resolver |
| **Investigar** | Usar fuentes del cuaderno, web o ambas con citas |
| **Crear** | Generar materiales, evaluaciones, imágenes, audio, video y código |
| **Colaborar** | Organizar roles, acuerdos, tareas y sesiones compartidas |
| **Ejecutar** | Convertir una solicitud en una acción o producto utilizable |

### Funciones

- Conversaciones persistentes por espacio de trabajo.
- Contexto desde un Notebook activo.
- Panel lateral con fuentes y citas.
- Investigación con fuentes, web o alcance combinado.
- Adjuntos PDF, DOCX y TXT.
- Lectura, resumen, traducción y corrección de archivos.
- Creación de podcast o narración desde documentos.
- Descarga de resultados en DOC, PDF, PPTX y XLSX.
- Renderizado de imágenes y audio dentro del chat.
- Acciones del Superagente.
- Organización de resultados por Work.

---

## 🏫 Planificador MINEDUC y editor visual

El módulo docente utiliza una base curricular local validada y rutas especializadas para conectar OA, indicadores, actividades, evaluación y recursos.

### Cobertura curricular

| Nivel | Archivos operativos |
|-------|---------------------:|
| Educación Parvularia | 6 |
| Educación Básica | 80 |
| Educación Media | 19 |
| **Total** | **105** |

### Funciones del planificador

- Selección de nivel, curso, asignatura, ámbito y núcleo.
- Conexión manual o automática de OA.
- Sinónimos temáticos para localizar OA por contexto.
- Sala heterogénea y niveles unidos en Parvularia.
- Perfiles de planificación para clase, feria científica, salida pedagógica, campaña, evento escolar, ABP/STEAM y experiencias de Parvularia.
- Planificación diaria, semanal, mensual, semestral y anual.
- Cronogramas institucionales para horizontes extensos.
- Adecuaciones y complementos pedagógicos.
- Auditoría estructurada de calidad.
- Guardado y consulta de planificaciones.
- Vista previa editable antes de descargar.

### Vista previa editable

La planificación se transfiere a `/educador/vista-previa`, donde cada elemento se convierte en un objeto independiente.

#### Selección y movimiento

- Clic para seleccionar.
- `Shift` para selección múltiple.
- Cuadro de selección sobre el lienzo.
- Arrastre libre.
- Flechas del teclado para ajustes precisos.
- `Shift + flecha` para desplazamiento de 10 px.
- Bloqueo de elementos.
- Modo mano para desplazar la vista.

#### Transformación

- Ocho controles de redimensionado.
- Control de rotación.
- Agrupar y desagrupar.
- Alinear y distribuir.
- Traer al frente, enviar al fondo y modificar capas.
- Duplicar, copiar, cortar y pegar.

#### Edición visual

- Textos, títulos, párrafos, listas, tablas, notas, figuras, líneas e imágenes.
- 15 familias tipográficas.
- 20 tamaños predefinidos entre 8 y 96 px.
- Tamaño personalizado.
- Negrita, cursiva y subrayado.
- Alineación horizontal y vertical.
- Interlineado y espaciado de letras.
- Paleta de 50 colores y selector personalizado.
- Color de texto, relleno, borde y fondo de página.
- Opacidad, sombra, borde, redondeado y relleno interno.
- Imágenes con modos contener, recortar o estirar.

#### Páginas y exportación

- Formatos A4, Carta y Oficio.
- Orientación vertical u horizontal.
- Crear, duplicar, eliminar y reordenar páginas.
- Cuadrícula, ajuste magnético y zoom.
- PDF multipágina.
- Word compatible `.doc`.
- Impresión.
- Copia como texto.
- Guardado automático y manual.

### Archivos clave

```text
app/educador/
app/educador/vista-previa/page.tsx
app/educador/vista-previa/editor.module.css
app/api/agents/educador/route.ts
app/api/agents/educador/curriculum/route.ts
app/api/agents/planificador-curricular/route.ts
lib/mineduc-oa.ts
lib/planificador-curriculum.ts
lib/planner-oa-bridge.ts
lib/planner-oa-synonyms.ts
lib/school-planning-profiles.ts
lib/planning-quality-audit.ts
lib/planning-preview.ts
data/mineduc/
```

---

## 📓 EduAI Notebooks, RAG y Chat Paper

### EduAI Notebooks

EduAI Notebooks es un workspace para construir conocimiento desde fuentes reales.

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

1. Crea la fuente en `notebook_sources`.
2. Extrae el texto mediante parser local o externo.
3. Divide el contenido en chunks con solapamiento.
4. Genera embeddings cuando existe un proveedor compatible.
5. Guarda el contenido en `notebook_chunks`.
6. Combina búsqueda vectorial y full-text.
7. Fusiona resultados con Reciprocal Rank Fusion.
8. Responde con citas.
9. Studio genera materiales desde el contenido recuperado.

#### Studio

- Infografía.
- Mapa mental.
- Quiz.
- Podcast.
- Flashcards.
- Timeline.
- Notas Cornell.
- Presentación.

### Chat Paper

`/paper` y `/paper-large` permiten cargar PDF, extraer contenido y conversar con el documento.

El sistema contempla:

- `pdf-parse` para texto nativo;
- OCR opcional para documentos escaneados;
- parser externo mediante `DOCLING_PARSER_URL`;
- Supabase Storage;
- tablas de documentos, chunks y extracciones cuando existen en la base conectada.

---

## 🎨 Creator Hub

Creator Hub es el sistema central de creación educativa y actualmente contiene **23 formatos**.

### Formatos disponibles

| Categoría | Formatos |
|-----------|----------|
| **Materiales visuales — 6** | Infografía, presentación, afiche, mapa mental, timeline y tabla de datos |
| **Estudio y evaluación — 11** | Flashcards, quiz, notas Cornell, glosario, guía de aprendizaje, rúbrica, prueba, solucionario, ficha de laboratorio, ticket de salida y lista de cotejo |
| **Narrativa, audio y video — 4** | Podcast, resumen de video, cuento educativo y canción/rap |
| **Planificación — 2** | Plan de clase e informe |

### Capacidades

- Creación desde texto, archivos o fuentes.
- Editores especializados según formato.
- Edición directa del contenido generado.
- Plantillas de diseño.
- Colores de acento.
- Proyectos persistentes.
- Historial de versiones.
- Editor universal por capas.
- Transformación entre formatos.
- Revisión de calidad.
- Colaboración en proyectos.
- Biblioteca de plantillas.
- Compartir con QR.
- Exportaciones PDF, PNG, JPG, PPTX, XLSX, CSV y otros formatos según el material.

### Áreas centrales

```text
/creator-hub
/creator-hub/notebook
/creator-hub/materials
/creator-hub/labs
/creator-hub/comics
/creator-hub/projects
/creator-hub/templates
/creator-hub/share
/creator-hub/collaboration/[id]
```

---

## ✍️ Pizarra Interactiva

La ruta `/pizarra-interactiva` es un **cuaderno digital interactivo multipágina**.

### Escritura y dibujo

- Trazos con mouse, lápiz o dedo.
- Selección de color y grosor.
- Borrado y limpieza de página.
- Deshacer y rehacer.
- Fondos blanco, cuadrícula, líneas, puntos, oscuro y azul.

### Objetos 2D

- Rectángulo.
- Cuadrado.
- Círculo y elipse.
- Triángulo.
- Rombo.
- Pentágono y hexágono.
- Estrella.
- Línea, flecha, vector y ángulo.

### Objetos 3D

- Cubo.
- Prisma.
- Pirámide.
- Tetraedro.
- Prisma triangular.
- Cilindro.
- Cono.
- Esfera.

### Gráficos vacíos

- Plano cartesiano 2D.
- Sistema de ejes 3D.
- Plano polar.
- Recta numérica.
- Gráfico científico.

### Contenido y multimedia

- Texto editable.
- Imágenes desde el dispositivo.
- Fotografías tomadas con cámara.
- Imágenes generadas con IA.
- Elementos movibles y redimensionables.
- Capas, duplicación, opacidad y eliminación.

### Cuadernos y exportación

- Varias páginas por cuaderno.
- Guardado local.
- Biblioteca de cuadernos.
- Sincronización en nube cuando Supabase está configurado.
- Motor matemático opcional en `services/whiteboard-math-engine/` para resolver, simplificar, verificar y graficar mediante SymPy.
- Importación de material JSON o imágenes.
- Exportación del cuaderno editable.
- Exportación de página a PNG y PDF.

### Distribución responsive

- Panel desplegable en pantallas pequeñas.
- Distribución estándar en notebooks y PC.
- Distribución especial en pantallas táctiles gigantes.
- El lienzo se mantiene como elemento principal en todos los tamaños.

---

## 🖍️ Cuaderno Creativo y QR Studio

### Cuaderno Creativo

`/cuaderno-creativo` permite:

- dibujar, pintar y rellenar figuras;
- utilizar lápiz, pincel, marcador, relleno, líneas, rectángulos, círculos y texto;
- trabajar en varias páginas;
- subir imágenes y convertirlas en plantillas;
- generar plantillas para colorear con IA;
- guardar, buscar, reutilizar y eliminar plantillas;
- mantener una biblioteca privada mediante Supabase Storage y RLS;
- descargar la página activa en PNG;
- descargar el cuaderno completo en PDF;
- usar panel de herramientas desplegable en pantallas pequeñas;
- adaptar la interfaz a notebooks y pantallas táctiles gigantes.

### QR Studio

`/qr-studio` permite crear recursos QR para enlaces, texto, Notebooks, proyectos y assets relacionados.

Funciones:

- código corto único;
- ruta pública `/q/[shortCode]`;
- visibilidad configurable;
- fecha de vencimiento;
- conteo de escaneos;
- descarga PNG;
- eliminación desde la biblioteca;
- protección de recursos privados o vencidos.

---

## 📋 Sistema de exámenes

EduAI incluye un sistema para docentes, estudiantes y administración.

### Flujo docente

```text
Crear → generar preguntas con IA → editar → aplicar tema y ajustes PIE
→ publicar enlace → gestionar acceso → recibir respuestas → revisar resultados
```

### Tipos de preguntas

- Alternativas.
- Verdadero/Falso.
- Desarrollo.
- Preguntas mixtas.
- Justificación y rúbricas.
- Contenido matemático con LaTeX.
- Imagen por pregunta.

### Experiencia del estudiante

- Link público por código.
- Identificación mediante RUT cuando está habilitado.
- Timer y reloj digital.
- Barra de progreso.
- Navegación entre preguntas.
- Calculadora científica autorizable.
- Narración TTS.
- Temas accesibles.
- Cuaderno de desarrollo y evidencia visual.
- Autoguardado y reanudación cuando el esquema está disponible.

### Corrección y seguridad

- Corrección automática y puntaje parcial.
- Escala chilena 1.0–7.0.
- Revisión manual.
- Re-cálculo matemático.
- Feedback configurable.
- Análisis pedagógico.
- Descarga PDF.
- Sesiones de supervisión y heartbeat.
- Registro de eventos e incidentes.
- Mensajería administrador-estudiante.
- Códigos temporales vinculados a nómina.
- Auditoría de códigos con hash.

---

## 🎙️ Audio Lab, canciones, voces y MIRA

### Audio Lab

Funciones principales:

- carga de audio o video;
- procesamiento rápido o Pro;
- transcripción con timestamps;
- edición de transcripción;
- resumen y operaciones con IA;
- exportación TXT, SRT y formatos relacionados;
- proyectos extensos en `/audio-lab-large`;
- perfiles de voz con consentimiento.

### Estudio de canciones

La ruta `/audio-lab/songs` y la tabla `audio_song_jobs` preparan un flujo para:

- título, prompt y descripción;
- letra y estilo musical;
- género, estado de ánimo e idioma;
- duración, BPM, tonalidad y compás;
- modo instrumental o vocal;
- perfil de voz autorizado;
- estados de cola, composición, generación y carga;
- almacenamiento privado de canciones generadas.

La generación efectiva depende del proveedor configurado. El proyecto incluye `services/ace-step-song-space/` como motor privado basado en ACE-Step para despliegues autorizados.

### Perfiles de voz

- Voz propia o tercero autorizado.
- Confirmación de mayoría de edad.
- Confirmación de consentimiento.
- Eventos de auditoría.
- Sesiones de seguridad.
- Ciclo de procesamiento y eliminación.
- Storage privado.
- Consentimiento separado para canto cuando se utiliza esa función.

### MIRA

MIRA es el agente de idiomas de `/traductor`.

| Modo | Funcionamiento |
|------|----------------|
| **Traducción escrita** | Traducción con explicación lingüística y cultural |
| **Intérprete por voz** | Español ↔ inglés desde grabación de audio |
| **Conversación en vivo** | Respuesta autónoma en el idioma seleccionado |

---

## 🖼️ Imagen, video y música

### Image Studio

Proveedores y opciones presentes:

- Google Gemini Image.
- OpenRouter.
- Together AI.
- Hugging Face.
- Pollinations.
- FAL para integraciones compatibles.

Funciones:

- optimización de prompts;
- prioridades por modo rápido, calidad o educativo;
- vista previa;
- galería unificada;
- generación automática desde agentes o Notebooks;
- configuración centralizada.

### Video Studio

- Texto-a-video.
- Imagen-a-video.
- Duración, FPS y relación de aspecto.
- Audio opcional.
- Moderación básica.
- Deduplicación.
- Límites de uso.
- Jobs y polling.
- Fallback entre proveedores.
- Worker Python base.

> La disponibilidad de Video Studio depende de un proveedor o worker externo y puede mostrarse en mantenimiento.

### EduAI Music

- Reproductor global persistente.
- Play, pausa, anterior, siguiente, shuffle, repeat, progreso y volumen.
- Biblioteca educativa interna.
- Playlists del sistema.
- Favoritos y cola.
- Jamendo, Audius e iTunes como fuentes compatibles.
- Spotify mediante embeds oficiales.
- Radio/proxy configurable.
- YouTube cuando existe configuración compatible.

---

## 🤝 Colaboración, gamificación y administración

### Colaboración

- Salas de estudio mediante `/collab` y `/collab/[code]`.
- Mensajes y miembros en tiempo real.
- Moderación asistida por IA.
- Amigos, presencia, notificaciones y archivos.
- Chat social de agentes.
- Colaboración específica dentro de Creator Hub.

### Gamificación

- XP por actividad.
- Misiones.
- Logros.
- Ranking global.
- Rachas.
- Repetición espaciada SM-2.

### Administración

- Dashboard administrativo.
- Gestión de usuarios.
- Reportes.
- Gestión global de exámenes.
- Seguridad de sesiones.
- Códigos de acceso.
- Mensajería y notas administrativas.
- Admin Model Lab protegido por rol.
- Analítica por módulo, agente, tipo de evento, latencia, tokens, costo estimado y errores.

---

## 🏗️ Arquitectura y estructura

### Arquitectura general

```text
Navegador
   │
   ├── Next.js App Router + React 19
   │      ├── páginas cliente y servidor
   │      ├── proxy.ts para autenticación
   │      └── Route Handlers
   │
   ├── AI Router
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
          ├── ACE-Step Song Engine privado
          ├── Whiteboard Math Engine
          ├── workers de video
          └── búsqueda web / scraping
```

### Páginas por grupo

| Grupo | Cantidad |
|-------|---------:|
| Creator Hub | 34 |
| Otros módulos y páginas | 31 |
| Administración | 11 |
| Exámenes | 6 |
| Educador | 5 |
| Audio Lab | 5 |
| Autenticación | 2 |
| Colaboración | 2 |
| Notebooks | 2 |
| Perfil | 2 |
| Superagente | 2 |
| Workspace | 2 |
| **Total** | **104** |

### APIs por grupo

| Grupo | Cantidad |
|-------|---------:|
| Agentes | 54 |
| Otros grupos | 23 |
| Notebooks | 11 |
| Creator | 9 |
| Seguridad de exámenes | 8 |
| Superagente | 6 |
| Música | 6 |
| Chat | 5 |
| Examen | 4 |
| Administración | 3 |
| Sesiones | 3 |
| QR | 3 |
| **Total** | **135** |

### Estructura resumida

```text
eduai-platform/
├── app/
│   ├── admin/                     # Administración y seguridad
│   ├── agentes/                   # Catálogo de agentes
│   ├── audio-lab/                 # Audio, voces y canciones
│   ├── chat-global/               # Open EDUAI Work
│   ├── collab/                    # Salas colaborativas
│   ├── creator-hub/               # 23 formatos y proyectos
│   ├── cuaderno-creativo/         # Lienzo y biblioteca
│   ├── educador/                  # Planificador y editor visual
│   ├── examen/                    # Exámenes y resultados
│   ├── image-studio/              # Generación visual
│   ├── music/                     # Reproductor persistente
│   ├── notebooks/                 # Workspace RAG
│   ├── paper/                     # Chat Paper
│   ├── pizarra-interactiva/       # Cuaderno digital interactivo
│   ├── qr-studio/                 # Gestión de QR
│   ├── study/                     # Sesión adaptativa
│   ├── superagent/                # Panel Claw
│   ├── traductor/                 # MIRA
│   ├── video-studio/              # Video Studio
│   ├── workspace/                 # Proyectos
│   └── api/                       # 135 endpoints internos
│
├── components/                    # UI y módulos especializados
├── lib/                           # Agentes, IA, datos y lógica
├── services/                      # Microservicios opcionales
├── wan-worker/                    # Worker base de video
├── data/mineduc/                  # Currículo validado
├── supabase/migrations/           # Migraciones versionadas
├── scripts/                       # Validación y mantenimiento
├── docs/                          # Documentación interna
├── .github/workflows/             # CI y automatizaciones
├── proxy.ts
├── next.config.ts
├── vercel.json
├── LICENSE
└── README.md
```

### Stack tecnológico

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
| **Cache** | Upstash Redis opcional |

---

## 🗄️ Base de datos y migraciones

### Migraciones incluidas

| Archivo | Contenido principal |
|---------|---------------------|
| `migration.sql` | Notebooks, RLS y búsqueda vectorial |
| `migration_bm25.sql` | Búsqueda full-text de Notebooks |
| `migration_qr_studio.sql` | QR, assets y registro de escaneos |
| `20260226000000_create_spaced_repetition.sql` | Repetición espaciada |
| `20260531_complete_audio_voice_security_and_lifecycle.sql` | Perfiles de voz, transcripciones y seguridad |
| `20260616000000_secure_student_roster_access_codes.sql` | Nómina y códigos temporales |
| `20260616053000_access_code_reuse_visibility.sql` | Reutilización y visibilidad de códigos |
| `202607210001_creative_templates.sql` | Biblioteca de plantillas creativas |
| `202607230001_admin_module_agent_analytics.sql` | Analítica administrativa por módulo y agente |
| `202607260001_creator_hub_foundation.sql` | Proyectos, versiones y plantillas de Creator Hub |
| `202607260002_creator_hub_collaboration.sql` | Colaboración en Creator Hub |
| `202607260004_whiteboard_math_studio.sql` | Cuadernos y páginas de Pizarra Interactiva |
| `202607290001_audio_song_studio.sql` | Estudio de canciones y storage privado |

### Tablas nuevas destacadas

```text
eduai_usage_events
creator_hub_projects
creator_hub_project_versions
whiteboard_notebooks
whiteboard_pages
whiteboard_recognition_runs
whiteboard_solution_runs
audio_song_jobs
```

> El proyecto también referencia tablas del esquema base de producción. Un despliegue desde cero requiere recuperar o consolidar ese esquema completo antes de habilitar todos los módulos.

---

## 💻 Desarrollo interno y CI/CD

> [!CAUTION]
> Esta sección corresponde únicamente al equipo interno y a colaboradores expresamente autorizados. La presencia de comandos técnicos en este documento no concede acceso ni licencia sobre el código.

### Requisitos

- Node.js 22.x.
- npm.
- Proyecto Supabase autorizado.
- Claves de proveedores según los módulos habilitados.
- Vercel para el despliegue recomendado.
- Python o Docker para microservicios opcionales.

### Flujo interno

```bash
# Repositorio privado: requiere autorización previa
git clone https://github.com/innova-space-edu/eduai-platform.git
cd eduai-platform
npm install
npm run test:curriculum
npm run test:planner
npm run test:creator
npm run test:whiteboard
npm run test:exam
npm run build
```

### Scripts disponibles

| Comando | Función |
|---------|---------|
| `npm run dev` | Aplica integraciones idempotentes e inicia Next.js |
| `npm run build` | Valida currículo, mantiene módulos y compila |
| `npm run start` | Inicia la compilación de producción |
| `npm run lint` | Ejecuta ESLint |
| `npm run planner:maintain` | Mantención integral del planificador |
| `npm run planning:preview` | Aplica la integración del editor de planificación |
| `npm run whiteboard:finalize` | Finaliza la integración de la pizarra |
| `npm run mira:voice` | Aplica el modo de voz de MIRA |
| `npm run test:planner` | Pruebas del planificador |
| `npm run test:creator` | Integridad de Creator Hub |
| `npm run test:whiteboard` | Integridad de Pizarra Interactiva |
| `npm run test:exam` | Pruebas de corrección de exámenes |
| `npm run curriculum:index` | Regenera el índice curricular |
| `npm run curriculum:validate` | Valida datos curriculares |
| `npm run test:curriculum` | Valida currículo en modo estricto |

### CI/CD

- GitHub Actions para integración continua.
- Validación estricta del currículo.
- Despliegues automáticos en Vercel.
- Automatizaciones para parser de audio y cola de video.
- Scripts idempotentes de mantenimiento durante desarrollo y build.

---

## 🛡️ Seguridad, privacidad y accesibilidad

### Seguridad

- RLS en las migraciones incluidas.
- Service role solamente en endpoints de servidor.
- Rutas administrativas protegidas.
- Códigos de examen con hash y auditoría.
- Políticas de sesiones e incidentes.
- Guardrails del Superagente.
- Validación de ownership en Notebooks, QR, Creator Hub y cuadernos.
- Validación de URL y fetch seguro.
- Límites de tamaño en audio y archivos.
- Tokens opcionales para microservicios.
- Repositorio de código privado.

### Privacidad

- Bibliotecas y proyectos personales protegidos por usuario.
- Storage privado en módulos sensibles.
- Consentimiento explícito para perfiles de voz.
- Separación entre recursos públicos y privados.
- Información sensible gestionada mediante variables de entorno y secretos del proveedor de despliegue.

### Accesibilidad educativa

- Perfiles PIE/NEE.
- Apoyo para dislexia, TDAH y baja visión.
- Temas de alto contraste.
- Tipografías accesibles.
- Narración TTS.
- Instrucciones por pasos.
- Evidencia visual y cuadernos digitales.
- Adaptación mediante la tool `adapt_for_pie`.
- Interfaces diferenciadas para móvil, notebook y pantallas táctiles grandes.

---

## 🧪 Estado funcional y roadmap

### Implementado

- [x] Open EDUAI Work con archivos, citas y exportaciones.
- [x] MIRA con traducción y conversación por voz.
- [x] Creator Hub con 23 formatos educativos.
- [x] Proyectos, versiones y colaboración de Creator Hub.
- [x] Editor visual multipágina para planificaciones.
- [x] Exportación PDF y Word compatible desde el editor.
- [x] Cuaderno Creativo con biblioteca privada y exportación.
- [x] Pizarra Interactiva como cuaderno digital multipágina.
- [x] Distribuciones responsive para móvil, PC y pantallas gigantes.
- [x] QR Studio con vencimiento y conteo de escaneos.
- [x] Planificador MINEDUC con 105 archivos validados.
- [x] Notebooks con RAG híbrido y RRF.
- [x] Exámenes con IA, seguridad y accesibilidad.
- [x] Audio Lab, perfiles de voz y base para canciones.
- [x] Image Studio multi-proveedor.
- [x] EduAI Music persistente.
- [x] Video Studio con jobs y procesamiento configurable.
- [x] Analítica administrativa por módulo y agente.
- [x] CI y validación curricular.

### Requiere configuración externa

- [ ] Esquema base completo de Supabase para una instalación nueva.
- [ ] Proveedor real de video o worker GPU.
- [ ] Parser externo para Audio Lab Pro.
- [ ] Proveedor de canciones compatible con `audio_song_jobs`.
- [ ] Space privado para síntesis de voz personalizada.
- [ ] Claves de búsqueda, IA, imagen, audio y video según cada módulo.

### Roadmap

- Consolidar el esquema base completo de Supabase.
- Crear un `.env.example` interno sin secretos.
- Ampliar pruebas end-to-end.
- Consolidar scripts `apply-*.mjs` en módulos estables.
- Añadir observabilidad de costos, latencia y errores.
- Mejorar edición colaborativa en tiempo real.
- Incorporar exportación `.docx` nativa al editor visual.
- Ampliar plantillas institucionales y accesibles.
- Mejorar administración de límites gratuitos para docentes.

---

## 👤 Créditos, propiedad y licencia

<div align="center">

### Dirección y desarrollo

**Esthefano Morales Campaña**  
Fundador y Director Ejecutivo de **[Innova Space Education SpA](https://innova-space-edu.cl/)**

### Desarrollo asistido por IA

**ChatGPT de OpenAI** — apoyo de co-creación, documentación y desarrollo asistido.

### Organización propietaria

**Innova Space Education SpA**  
Antofagasta, Chile · `contacto@innova-space-edu.cl`

</div>

### Licencia propietaria

Copyright © 2026 **Innova Space Education SpA**. Todos los derechos reservados.

El código fuente de EduAI Platform es **privado y propietario**. No se concede una licencia pública para copiar, modificar, publicar, distribuir, sublicenciar o vender el software.

El uso gratuito ofrecido a docentes corresponde únicamente al acceso y uso pedagógico de la plataforma alojada:

> **Free to use for teachers — uso gratuito para docentes.**

Esta autorización de uso no transfiere derechos de propiedad intelectual, no permite acceder al código fuente y no autoriza crear productos derivados del software.

Consulta [LICENSE](LICENSE) para conocer el aviso propietario aplicable al código. Las dependencias y componentes de terceros continúan sujetos a sus licencias respectivas.

---

<div align="center">

**EduAI Platform — Educación, tecnología e inteligencia artificial en un solo ecosistema.**

### 👩‍🏫 Free to use for teachers · Uso gratuito para docentes
### 🔒 Private and proprietary code · Código privado y propietario
### 🏢 Property of Innova Space Education SpA

**[🌐 Plataforma](https://eduaiplatformclon.vercel.app)** · **[🏢 Innova Space Education](https://innova-space-edu.cl/)** · **[✉️ Contacto](mailto:contacto@innova-space-edu.cl)**

</div>
