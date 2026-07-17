"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock3,
  FolderOpen,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import {
  CREATOR_HUB_CATEGORIES,
  CREATOR_HUB_CORE_TOOLS,
  CREATOR_HUB_FORMATS,
  CREATOR_HUB_LABS,
  getCreatorHubFormat,
} from "@/components/creator-hub/catalog"
import { loadCreatorHubProjects, type CreatorHubProject } from "@/components/creator-hub/project-store"

type SearchItem = {
  id: string
  href: string
  icon: string
  label: string
  description: string
  color: string
  group: string
}

const QUICK_ACTIONS = [
  {
    href: "/creator-hub/notebook",
    icon: "📓",
    label: "Cuaderno EduAI",
    description: "Lee fuentes, analiza papers y conversa con citas.",
    color: "#2563eb",
  },
  {
    href: "/creator-hub/materials",
    icon: "✨",
    label: "Crear material",
    description: "Elige el formato dentro de un catálogo ordenado.",
    color: "#7c3aed",
  },
  {
    href: "/creator-hub/labs",
    icon: "🧪",
    label: "Multimedia",
    description: "Audio, imágenes, video, música y galería.",
    color: "#0d9488",
  },
  {
    href: "/creator-hub/comics",
    icon: "💬",
    label: "Manga e historieta",
    description: "Diseña historias visuales y storyboards educativos.",
    color: "#db2777",
  },
]

const COMPACT_LINKS = [
  { href: "/paper", icon: "📄", label: "Chat Paper" },
  { href: "/investigador", icon: "🔎", label: "Investigador" },
  { href: "/creator-hub/share", icon: "◩", label: "Compartir con QR" },
  { href: "/creator-hub/projects", icon: "🗂️", label: "Mis proyectos" },
]

function ActionCard({ action }: { action: (typeof QUICK_ACTIONS)[number] }) {
  return (
    <Link
      href={action.href}
      className="group rounded-3xl border border-soft bg-card-theme p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-xl"
          style={{ background: `${action.color}12`, border: `1px solid ${action.color}22` }}
        >
          {action.icon}
        </span>
        <ChevronRight
          size={16}
          className="mt-1 transition-transform group-hover:translate-x-1"
          style={{ color: action.color }}
        />
      </div>
      <h2 className="mt-4 text-sm font-bold text-main">{action.label}</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-muted2">{action.description}</p>
    </Link>
  )
}

export default function CreatorHubPage() {
  const [recent, setRecent] = useState<CreatorHubProject[]>([])
  const [query, setQuery] = useState("")
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const refresh = () => setRecent(loadCreatorHubProjects().slice(0, 4))
    refresh()
    window.addEventListener("creator-hub-projects-updated", refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener("creator-hub-projects-updated", refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  const searchItems = useMemo<SearchItem[]>(() => {
    const core = CREATOR_HUB_CORE_TOOLS.map((tool) => ({
      id: `core-${tool.id}`,
      href: tool.href,
      icon: tool.icon,
      label: tool.label,
      description: tool.description,
      color: tool.color,
      group: "Espacios",
    }))
    const formats = CREATOR_HUB_FORMATS.map((format) => ({
      id: `format-${format.id}`,
      href: `/creator-hub/${format.id}`,
      icon: format.icon,
      label: format.label,
      description: format.description,
      color: format.color,
      group: "Formatos",
    }))
    const labs = CREATOR_HUB_LABS.map((tool) => ({
      id: `lab-${tool.id}`,
      href: tool.href,
      icon: tool.icon,
      label: tool.label,
      description: tool.description,
      color: tool.color,
      group: "Multimedia",
    }))
    const extras: SearchItem[] = [
      {
        id: "extra-paper",
        href: "/paper",
        icon: "📄",
        label: "Chat Paper",
        description: "Analiza documentos académicos con un agente especializado.",
        color: "#7c3aed",
        group: "Investigación",
      },
      {
        id: "extra-investigator",
        href: "/investigador",
        icon: "🔎",
        label: "Investigador",
        description: "Busca y organiza información para iniciar un proyecto.",
        color: "#2563eb",
        group: "Investigación",
      },
    ]
    return [...core, ...formats, ...labs, ...extras]
  }, [])

  const normalizedQuery = query.trim().toLocaleLowerCase("es")
  const results = normalizedQuery
    ? searchItems
        .filter((item) => `${item.label} ${item.description} ${item.group}`.toLocaleLowerCase("es").includes(normalizedQuery))
        .slice(0, 10)
    : []

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-7">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-500">
              <Sparkles size={12} /> Creator Hub
            </p>
            <h1 className="mt-0.5 text-lg font-bold text-main">Centro creativo</h1>
          </div>
          <Link
            href="/creator-hub/materials"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
          >
            Crear <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-7 sm:px-7 sm:py-9">
        <section className="rounded-[28px] border border-soft bg-card-theme p-5 sm:p-7">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-blue-600">Empieza con una acción</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-main sm:text-3xl">
              ¿Qué quieres hacer hoy?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted2">
              Las herramientas siguen disponibles, pero la portada muestra primero solo lo esencial.
            </p>
          </div>

          <div className="relative mt-5 max-w-2xl">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar una herramienta o formato..."
              className="w-full rounded-2xl border border-soft bg-input-theme py-3.5 pl-11 pr-11 text-sm text-main outline-none transition focus:border-blue-500/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-muted2 hover:bg-card-soft-theme hover:text-main"
                aria-label="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {normalizedQuery && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-soft bg-app">
              {results.length === 0 ? (
                <div className="px-5 py-7 text-center">
                  <p className="text-sm font-semibold text-main">No encontramos esa herramienta</p>
                  <p className="mt-1 text-xs text-muted2">Prueba con palabras como audio, presentación, quiz, paper o imagen.</p>
                </div>
              ) : (
                <div className="grid gap-px bg-[var(--border-soft)] sm:grid-cols-2">
                  {results.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center gap-3 bg-card-theme px-4 py-3.5 transition hover:bg-card-soft-theme"
                    >
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                        style={{ background: `${item.color}12` }}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-main">{item.label}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted2">{item.group}</span>
                      </span>
                      <ChevronRight size={14} className="text-muted2" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {!normalizedQuery && (
          <>
            <section>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">Acciones principales</p>
                  <h2 className="mt-1 text-lg font-bold text-main">Elige un espacio</h2>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {QUICK_ACTIONS.map((action) => <ActionCard key={action.href} action={action} />)}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {COMPACT_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-full border border-soft bg-card-theme px-3 py-2 text-xs font-semibold text-sub transition hover:border-blue-500/20 hover:bg-card-soft-theme hover:text-main"
                  >
                    <span>{item.icon}</span>{item.label}
                  </Link>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_0.78fr]">
              <div>
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">Continuar</p>
                    <h2 className="mt-1 text-lg font-bold text-main">Creaciones recientes</h2>
                  </div>
                  <Link href="/creator-hub/projects" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                    Ver proyectos <ArrowRight size={12} />
                  </Link>
                </div>

                <div className="overflow-hidden rounded-3xl border border-soft bg-card-theme">
                  {recent.length === 0 ? (
                    <div className="px-6 py-9 text-center">
                      <FolderOpen size={24} className="mx-auto text-muted2" />
                      <p className="mt-3 text-sm font-bold text-main">Aún no hay proyectos guardados</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted2">Tus próximas creaciones aparecerán aquí para retomarlas rápidamente.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-soft">
                      {recent.map((project) => {
                        const format = getCreatorHubFormat(project.format)
                        return (
                          <Link
                            href={`/creator-hub/${project.format}`}
                            key={project.id}
                            className="flex items-center gap-3 p-4 transition hover:bg-card-soft-theme"
                          >
                            <span
                              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                              style={{ background: `${format?.color || "#64748b"}12` }}
                            >
                              {format?.icon || "📄"}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-bold text-main">{project.title}</span>
                              <span className="mt-1 flex items-center gap-1 text-[10px] text-muted2">
                                <Clock3 size={10} /> {new Date(project.updatedAt).toLocaleDateString("es-CL")}
                              </span>
                            </span>
                            <ChevronRight size={14} className="text-muted2" />
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">Explorar</p>
                  <h2 className="mt-1 text-lg font-bold text-main">Todas las herramientas</h2>
                </div>

                <div className="rounded-3xl border border-soft bg-card-theme p-4">
                  <p className="text-xs leading-relaxed text-muted2">
                    Para evitar una pantalla saturada, el catálogo completo permanece cerrado hasta que lo necesites.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAll((current) => !current)}
                    className="mt-4 flex w-full items-center justify-between rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-left text-xs font-bold text-main"
                  >
                    <span>{CREATOR_HUB_FORMATS.length + CREATOR_HUB_LABS.length} herramientas disponibles</span>
                    <ChevronDown size={15} className={`transition-transform ${showAll ? "rotate-180" : ""}`} />
                  </button>

                  {showAll && (
                    <div className="mt-4 space-y-4">
                      {CREATOR_HUB_CATEGORIES.map((category) => {
                        const formats = CREATOR_HUB_FORMATS.filter((format) => format.category === category.id)
                        return (
                          <div key={category.id}>
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted2">{category.icon} {category.label}</p>
                            <div className="flex flex-wrap gap-2">
                              {formats.map((format) => (
                                <Link
                                  key={format.id}
                                  href={`/creator-hub/${format.id}`}
                                  className="rounded-xl border border-soft px-2.5 py-2 text-[11px] font-semibold text-sub transition hover:bg-card-soft-theme"
                                >
                                  {format.icon} {format.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted2">🧪 Multimedia</p>
                        <div className="flex flex-wrap gap-2">
                          {CREATOR_HUB_LABS.map((tool) => (
                            <Link
                              key={tool.id}
                              href={tool.href}
                              className="rounded-xl border border-soft px-2.5 py-2 text-[11px] font-semibold text-sub transition hover:bg-card-soft-theme"
                            >
                              {tool.icon} {tool.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
