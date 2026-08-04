import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/agentes/page.tsx"
const LIBRARY_ID = 'id: "biblioteca"'
const REPOSITORY_ID = 'id: "repositorio"'

if (!existsSync(PAGE)) {
  throw new Error(`[agent-cards] No existe ${PAGE}`)
}

let source = readFileSync(PAGE, "utf8")

if (!source.includes(LIBRARY_ID) || !source.includes(REPOSITORY_ID)) {
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
    icon: "🗂️",
    name: "Repositorio",
    description: "Guarda, ordena y consulta tus materiales educativos privados por curso y asignatura.",
    color: "from-teal-500 to-emerald-700",
    glow: "rgba(20,184,166,0.15)",
    border: "rgba(20,184,166,0.22)",
    href: "/repositorio",
    tag: "Organización",
    status: "active",
    ctaLabel: "Abrir repositorio",
  },
];`

  if (!source.includes(anchor)) {
    throw new Error("[agent-cards] No se encontró el bloque final de Workspace")
  }

  source = source.replace(anchor, replacement)
  writeFileSync(PAGE, source)
}

const verified = readFileSync(PAGE, "utf8")
for (const required of [
  LIBRARY_ID,
  REPOSITORY_ID,
  'href: "/biblioteca"',
  'href: "/repositorio"',
]) {
  if (!verified.includes(required)) {
    throw new Error(`[agent-cards] Falta ${required}`)
  }
}

console.log("[agent-cards] Biblioteca y Repositorio disponibles en Agentes")
