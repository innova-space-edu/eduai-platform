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

[![Netlify Status](https://api.netlify.com/api/v1/badges/eduai-platform/deploy-status)](https://eduai-pl.netlify.app)
![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-blue)

**[🌐 Ver demo en vivo](https://eduai-pl.netlify.app)** · **[📋 Reportar bug](https://github.com/innova-space-edu/eduai-platform/issues)** · **[✨ Solicitar feature](https://github.com/innova-space-edu/eduai-platform/issues)**

</div>

---

## ¿Qué es EduAI Platform?

EduAI Platform es una plataforma educativa de siguiente generación que combina **18 agentes de inteligencia artificial especializados** para ofrecer una experiencia de aprendizaje completamente personalizada, adaptativa y gamificada. Va más allá de un simple chatbot — es un ecosistema inteligente donde múltiples agentes colaboran para que el estudiante aprenda más rápido y de forma más profunda.

Diseñada especialmente para el contexto educativo chileno, incluye cobertura curricular completa del **MINEDUC** (Parvularia, Básica y Media).

---

## Funcionalidades principales

### Para estudiantes
- **Sesiones de estudio sobre cualquier tema** — historia, ciencias, matemáticas, idiomas, y más
- **4 modos de aprendizaje:** Normal, Socrático, Evaluación y Colaborativo
- **Quiz adaptativo** que ajusta dificultad automáticamente según tu desempeño
- **Modo Examen completo** con timer, corrección automática y retroalimentación detallada
- **Chat con Papers PDF** — sube un paper académico y conéctate con él
- **Visualizaciones automáticas:** imágenes IA, diagramas Mermaid, gráficos Chart.js
- **Matemáticas con LaTeX** — fórmulas renderizadas como en un libro de texto profesional
- **Narración por voz (TTS)** — el contenido se puede escuchar
- **Historial de sesiones** organizado como carpetas
- **Repaso espaciado inteligente** basado en el algoritmo SM-2 (Ebbinghaus)

### Para docentes
- **Planificador MINEDUC (APl)** — genera planificaciones de clase alineadas al currículo nacional
- Soporte para todos los niveles: Parvularia, 1° Básico hasta 4° Medio
- Adaptaciones para **Necesidades Educativas Especiales (NEE)**
- Actividades lúdicas, rúbricas, proyectos interdisciplinarios
- Contexto del calendario escolar chileno (Fiestas Patrias, vacaciones de invierno, etc.)

### Herramientas generales
- **Investigador** — busca y resume fuentes académicas y papers
- **Redactor** — genera ensayos, informes y cartas formales
- **Matemático** — resolución paso a paso con notación LaTeX profesional
- **Traductor** — traducción multiidioma con explicación lingüística y cultural

---

## Los 18 Agentes de IA

### Agentes de Estudio Activo

| Agente | Nombre | Función |
|--------|--------|---------|
| 🧠 **AGT** | Tutor General | Explica cualquier tema con profundidad adaptativa al nivel del estudiante |
| 🤔 **ASc** | Socrático | Guía mediante preguntas estratégicas — nunca da la respuesta directamente |
| 📊 **AEv** | Evaluador | Genera preguntas de distinto tipo y evalúa las respuestas con criterio pedagógico |
| 🎯 **AAD** | Adaptativo | Ajusta automáticamente la dificultad según el desempeño del usuario en tiempo real |
| 🔍 **ADL** | Diagnóstico | Detecta lagunas de conocimiento y reporta áreas débiles del estudiante |
| 🔄 **ARE** | Repaso Espaciado | Implementa el algoritmo SM-2 para programar repasos en el momento óptimo |
| 🎮 **AGm** | Gamificación | Gestiona misiones, logros, XP y el sistema de ranking global |
| 💾 **AML** | Memoria Larga | Recuerda el historial completo de aprendizaje de cada usuario |
| 📄 **ARe** | Resumidor PDF | Genera resúmenes descargables en PDF de las sesiones de estudio |
| 🔊 **AVN** | Voz y Narración | Text-to-Speech — lee el contenido en voz alta con reproducción automática |
| 🤝 **ACo** | Colaborativo | Salas de estudio en tiempo real con otros usuarios (Supabase Realtime) |
| 🖼️ **AIm** | Visual | Genera imágenes IA (FLUX), diagramas Mermaid y gráficos Chart.js automáticamente |

### Agentes Especializados (Sidebar)

| Agente | Nombre | Función |
|--------|--------|---------|
| 🏫 **APl** | Planificador MINEDUC | Planificaciones curriculares completas para docentes chilenos |
| 🔬 **Investigador** | Investigador Académico | Busca, resume y analiza papers y fuentes académicas |
| ✍️ **Redactor** | Redactor Profesional | Ensayos, informes, cartas y documentos formales |
| 🧮 **Matemático** | Experto Matemático | Resolución paso a paso con renderizado LaTeX profesional (KaTeX) |
| 🌐 **Traductor** | Traductor Multiidioma | Traducción con explicación de matices lingüísticos y culturales |
| 📄 **Chat Paper** | Analizador de Papers | Sube un PDF y conversa profundamente sobre su contenido |
| 📝 **Examen** | Simulacro de Examen | Exámenes completos con timer, corrección IA y retroalimentación detallada |

---

## Sistema de Gamificación

```
Principiante → Aprendiz → Practicante → Avanzado → Experto → Maestro
    0 XP         100 XP      500 XP       1200 XP    2500 XP   5000 XP
```

- ⚡ **Sistema XP** — gana puntos por cada sesión, quiz y misión completada
- 📅 **Misiones diarias y semanales** con recompensas XP
- 🏆 **Logros desbloqueables** por hitos de aprendizaje
- 🔥 **Racha de días** consecutivos de estudio
- 🥇 **Ranking global** entre todos los usuarios de la plataforma

---

## Stack Tecnológico

### Frontend
```
Next.js 16.1    React 18      TypeScript 5
Tailwind CSS    KaTeX         react-markdown
Chart.js        Mermaid.js    Web Speech API
```

### Backend & Base de Datos
```
Supabase (PostgreSQL + Auth + Realtime)
Next.js API Routes (serverless)
Netlify (deployment)
```

### Proveedores de IA — Router Multi-modelo

```
┌─────────────────────────────────────────────┐
│           ROUTER DE IA (lib/ai-router.ts)    │
├─────────────────────────────────────────────┤
│  1° Groq        → Llama 3.3 70B  (rápido)  │
│  2° OpenRouter  → 29 modelos free (fallback)│
│  3° Gemini      → 2.0 Flash      (volumen) │
└─────────────────────────────────────────────┘
```

### Servicios de Generación Visual
```
Pollinations.ai   → Imágenes FLUX (gratuito)
HuggingFace       → Stable Diffusion (backup)
Google Gemini     → Extracción de texto PDF
```

---

## Arquitectura

```
eduai-platform/
├── app/
│   ├── dashboard/          # Panel principal + sidebar agentes
│   ├── study/[topic]/      # Sesión de estudio activo (12 agentes)
│   │   ├── StudyClient.tsx
│   │   ├── QuizMode.tsx
│   │   └── VisualBlock.tsx
│   ├── educador/           # APl — Planificador MINEDUC
│   ├── investigador/       # Agente investigador académico
│   ├── redactor/           # Agente redactor de documentos
│   ├── matematico/         # Agente matemático con LaTeX
│   ├── traductor/          # Agente traductor multiidioma
│   ├── paper/              # Chat con Paper PDF
│   ├── examen/             # Modo examen completo
│   ├── profile/            # Perfil + configuración
│   ├── ranking/            # Ranking global
│   └── collab/             # Salas colaborativas
├── api/agents/
│   ├── chat/               # AGT tutor principal
│   ├── educador/           # APl MINEDUC
│   ├── examen/             # Simulacro de examen
│   ├── image/              # AIm visual generation
│   ├── investigador/       # Investigación académica
│   ├── matematico/         # Matemáticas + LaTeX
│   ├── paper/              # Chat con PDF
│   ├── redactor/           # Redacción documentos
│   └── traductor/          # Traducción
├── lib/
│   ├── ai-router.ts        # Router multi-modelo con fallback
│   └── supabase/           # Cliente Supabase
└── components/
    ├── ui/
    │   ├── MathRenderer.tsx # Renderizado LaTeX con KaTeX
    │   └── AgentHeader.tsx  # Header reutilizable con botón volver
    └── dashboard/
        └── MissionsPanel.tsx
```

---

## Instalación y desarrollo

### Requisitos previos
- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (gratuita)
- API Keys gratuitas (ver abajo)

### 1. Clonar el repositorio
```bash
git clone https://github.com/innova-space-edu/eduai-platform.git
cd eduai-platform
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env.local
```

Edita `.env.local` con tus claves:
```env
# Supabase (supabase.com → gratis)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Groq (console.groq.com → gratis)
GROQ_API_KEY=gsk_xxx...

# OpenRouter (openrouter.ai → gratis, sin tarjeta)
OPENROUTER_API_KEY=sk-or-xxx...

# Google Gemini (aistudio.google.com → gratis)
GEMINI_API_KEY=AIzaXxx...

# HuggingFace (huggingface.co → gratis)
HF_TOKEN_1=hf_xxx...
HF_TOKEN_2=hf_xxx...
HF_TOKEN_3=hf_xxx...
```

### 3. Configurar base de datos Supabase
Ejecuta el siguiente SQL en el editor de Supabase:
```sql
-- Progreso del usuario
create table user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  xp integer default 0,
  streak integer default 0,
  sessions integer default 0,
  created_at timestamp default now()
);

-- Sesiones de estudio
create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  topic text not null,
  score integer,
  messages_count integer default 0,
  created_at timestamp default now()
);

-- Misiones
create table missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mission_id text not null,
  completed boolean default false,
  progress integer default 0,
  last_reset date
);

-- RLS
alter table user_progress enable row level security;
alter table study_sessions enable row level security;
alter table missions enable row level security;

create policy "users own data" on user_progress for all using (auth.uid() = user_id);
create policy "users own data" on study_sessions for all using (auth.uid() = user_id);
create policy "users own data" on missions for all using (auth.uid() = user_id);
```

### 4. Ejecutar en desarrollo
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000)

---

## Despliegue en Netlify

1. Conecta tu repositorio en [netlify.com](https://netlify.com)
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Agrega las variables de entorno en Netlify → Site settings → Environment variables

---

## Comparación con alternativas

| Feature | EduAI Platform | Khan Academy | ChatGPT Edu | NotebookLM |
|---------|---------------|--------------|-------------|------------|
| Multi-agente especializado | ✅ 18 agentes | ❌ | ❌ | ❌ |
| Adaptativo en tiempo real | ✅ | ✅ | ❌ | ❌ |
| Currículo MINEDUC Chile | ✅ | ❌ | ❌ | ❌ |
| Chat con Papers PDF | ✅ | ❌ | ✅ parcial | ✅ |
| Modo Examen con IA | ✅ | ✅ | ❌ | ❌ |
| Gamificación completa | ✅ | ✅ | ❌ | ❌ |
| LaTeX matemático | ✅ | ✅ | ✅ | ❌ |
| Colaborativo en tiempo real | ✅ | ❌ | ❌ | ❌ |
| 100% gratuito | ✅ | ✅ | ❌ | ✅ |
| Open source | ✅ | ❌ | ❌ | ❌ |

---

## Roadmap

### Próximas funcionalidades
- [ ] **AMt** — Mapas mentales interactivos generados por IA
- [ ] **AFlash** — Flashcards automáticas con algoritmo Leitner
- [ ] **AOp** — Orquestador central (arquitectura 14 agentes / 5 capas)
- [ ] **ADebate** — Modo debate: el estudiante defiende una postura frente a la IA
- [ ] **AProf** — Modo profesor inverso: el estudiante explica, la IA evalúa
- [ ] **App móvil** — Conversión a Android/iOS con Capacitor
- [ ] **Análisis de datos** — Dashboard analítico para docentes
- [ ] **Integración Google Colab** — Modelos locales para mayor privacidad

### Arquitectura planificada (5 capas)
```
Capa 1 — Orquestación:  AOp (Claude Opus) + AEC (estado sesión)
Capa 2 — Contenido:     AGT + AER (ejemplos) + AIV (imágenes) + ATD (tablas)
Capa 3 — Evaluación:    AEv + AAD (dificultad) + ADL (lagunas)
Capa 4 — Experiencia:   AVN (voz) + ASc (Sócrates) + AGm (gamificación)
Capa 5 — Memoria:       AML (largo plazo) + ARE (Ebbinghaus)
```

---

## Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'feat: descripción del cambio'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

---

## Licencia

MIT License — ver [LICENSE](LICENSE) para más detalles.

---

<div align="center">

Desarrollado **[Innova Space Education](https://innova-space-edu.cl/)**

**[🌐 eduai-pl.netlify.app](https://eduai-pl.netlify.app)**

</div>
