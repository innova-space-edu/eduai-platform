import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/agentes/page.tsx"
const MARKER = "AGENT_LIBRARY_REPOSITORY_CARDS_V1"

if (!existsSync(PAGE)) {
  throw new Error(`[agent-cards] No existe ${PAGE}`)
}

let source = readFileSync(PAGE, "utf8")

if (!source.includes(MARKER)) {
  const anchor = `  {
    id: "workspace",
    icon: "📁",
    name: "Workspace",
    description: "Organiza imágenes, transcripciones, presentaciones y más en proyectos",
    color: "from-indigo-500 to-blue-600",
    glow: "rgba(67,56,202,0.15)",
    border: "rgba(67,56,202,0.2)",
    href: "/workspace",
    tag: "Organización",
    status: "active",
  },
];`

  const replacement = `  {
    id: "workspace",
    icon: "📁",
    name: "Workspace",
    description: "Organiza imágenes, transcripciones, presentaciones y más en proyectos",
    color: "from-indigo-500 to-blue-600",
    glow: "rgba(67,56,202,0.15)",
    border: "rgba(67,56,202,0.2)",
    href: "/workspace",
    tag: "Organización",
    status: "active",
  },
  {
    id: "biblioteca",
    icon: "📚",
    name: "Biblioteca",
    description: "Explora libros, colecciones y lecturas digitales desde el catálogo de EduAI.",
    color: "from-amber-500 to-orange-600",
    glow: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.22)",
    href: "/biblioteca",
    tag: "Organización",
    status: "active",
    ctaLabel: "Abrir biblioteca",
  },
  {
    id: "repositorio",
    icon: "☁️",
    name: "Nube EduAI",
    description: "Guarda, ordena y consulta tus materiales educativos por curso y asignatura.",
    color: "from-sky-400 to-indigo-500",
    glow: "rgba(56,189,248,0.16)",
    border: "rgba(99,102,241,0.20)",
    href: "/repositorio",
    tag: "Organización",
    status: "active",
    ctaLabel: "Abrir Nube EduAI",
  },
];

// ${MARKER}`

  if (!source.includes(anchor)) {
    throw new Error("[agent-cards] No se encontró el bloque final de Workspace")
  }

  source = source.replace(anchor, replacement)
}

source = source
  .replace('name: "Repositorio"', 'name: "Nube EduAI"')
  .replace('ctaLabel: "Abrir repositorio"', 'ctaLabel: "Abrir Nube EduAI"')
  .replace('icon: "🗂️",\n    name: "Nube EduAI"', 'icon: "☁️",\n    name: "Nube EduAI"')
  .replace('color: "from-teal-500 to-emerald-700",\n    glow: "rgba(20,184,166,0.15)",\n    border: "rgba(20,184,166,0.22)",\n    href: "/repositorio"', 'color: "from-sky-400 to-indigo-500",\n    glow: "rgba(56,189,248,0.16)",\n    border: "rgba(99,102,241,0.20)",\n    href: "/repositorio"')

writeFileSync(PAGE, source)

const verified = readFileSync(PAGE, "utf8")
for (const required of [
  MARKER,
  'id: "biblioteca"',
  'id: "repositorio"',
  'name: "Nube EduAI"',
  'ctaLabel: "Abrir Nube EduAI"',
  'href: "/biblioteca"',
  'href: "/repositorio"',
]) {
  if (!verified.includes(required)) {
    throw new Error(`[agent-cards] Falta ${required}`)
  }
}

console.log("[agent-cards] Biblioteca y Nube EduAI disponibles en Agentes")
