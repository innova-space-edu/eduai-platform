// PATCH para app/agentes/page.tsx
// Agregar entrada del Notebook Hub en el array AGENTS
// Insertarlo ANTES del entry "creator-hub" (línea ~118)

// ─── AGREGAR ESTE OBJETO AL ARRAY AGENTS ────────────────────────────────────

/*
  {
    id: "notebooks",
    icon: "📓",
    name: "Notebook Hub",
    description: "Fuentes → Chat especialista → Studio. Crea desde contenido real, no desde cero.",
    color: "from-blue-500 to-indigo-600",
    glow: "rgba(37,99,235,0.15)",
    border: "rgba(37,99,235,0.2)",
    href: "/notebooks",
    tag: "Nuevo",
    status: "active",
    ctaLabel: "Abrir",
  },
*/

// ─── REEMPLAZAR EL ENTRY DE CREATOR HUB así ──────────────────────────────────

/*
  {
    id: "creator-hub",
    icon: "✨",
    name: "Creator Hub",
    description: "Modo clásico: genera infografías, PPT, podcast, mapas y más desde un prompt",
    color: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.15)",
    border: "rgba(139,92,246,0.2)",
    href: "/creator-hub",
    tag: "Creativo",
    status: "active",
  },
*/

// ─── NOTA ────────────────────────────────────────────────────────────────────
// El Notebook Hub aparecerá ANTES del Creator Hub clásico en la lista.
// Los dos coexisten: notebook = desde fuentes, creator = desde prompt.
