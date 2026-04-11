"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronRight, Wrench } from "lucide-react"

type AgentItem = {
  id: string
  icon: string
  name: string
  description: string
  color: string
  glow: string
  border: string
  href: string
  tag: string
  status?: "active" | "maintenance"
  ctaLabel?: string
}

const AGENTS: AgentItem[] = [
  {
    id: "educador",
    icon: "🏫",
    name: "Planificador",
    description: "Planificaciones MINEDUC para docentes chilenos",
    color: "from-emerald-500 to-teal-600",
    glow: "rgba(16,185,129,0.15)",
    border: "rgba(16,185,129,0.2)",
    href: "/educador",
    tag: "Docentes",
    status: "active",
  },
  {
    id: "investigador",
    icon: "🔬",
    name: "Investigador",
    description: "Busca y resume fuentes académicas y papers",
    color: "from-blue-500 to-indigo-600",
    glow: "rgba(59,130,246,0.15)",
    border: "rgba(59,130,246,0.2)",
    href: "/investigador",
    tag: "Investigación",
    status: "active",
  },
  {
    id: "redactor",
    icon: "✍️",
    name: "Redactor",
    description: "Ensayos, informes, cartas y documentos formales",
    color: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.15)",
    border: "rgba(139,92,246,0.2)",
    href: "/redactor",
    tag: "Escritura",
    status: "active",
  },
  {
    id: "matematico",
    icon: "🧮",
    name: "Matemático",
    description: "Resolución paso a paso con notación LaTeX profesional",
    color: "from-orange-500 to-amber-600",
    glow: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.2)",
    href: "/matematico",
    tag: "Matemáticas",
    status: "active",
  },
  {
    id: "traductor",
    icon: "🌐",
    name: "Traductor",
    description: "Traducción con explicación lingüística y cultural",
    color: "from-cyan-500 to-sky-600",
    glow: "rgba(6,182,212,0.15)",
    border: "rgba(6,182,212,0.2)",
    href: "/traductor",
    tag: "Idiomas",
    status: "active",
  },
  {
    id: "paper",
    icon: "📄",
    name: "Chat Paper",
    description: "Sube un PDF y conversa profundamente sobre su contenido",
    color: "from-indigo-500 to-blue-700",
    glow: "rgba(99,102,241,0.15)",
    border: "rgba(99,102,241,0.2)",
    href: "/paper",
    tag: "PDF",
    status: "active",
  },
  {
    id: "examen",
    icon: "📝",
    name: "Examen",
    description: "Simulacro completo con timer, corrección IA y retroalimentación",
    color: "from-red-500 to-rose-600",
    glow: "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.2)",
    href: "/examen",
    tag: "Evaluación",
    status: "active",
  },
  {
    id: "examen-docente",
    icon: "📋",
    name: "Exámenes Docente",
    description: "Crea pruebas con IA, comparte el link y recibe notas automáticas",
    color: "from-red-500 to-orange-600",
    glow: "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.2)",
    href: "/examen/docente",
    tag: "Docentes",
    status: "active",
  },
  {
    id: "creator-hub",
    icon: "🎨",
    name: "Creator Hub",
    description: "8 sub-agentes: infografías, PPT, podcast, mapas mentales, flashcards y más",
    color: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.15)",
    border: "rgba(139,92,246,0.2)",
    href: "/creator-hub",
    tag: "Creativo",
    status: "active",
  },
  {
    id: "audio-lab",
    icon: "🎙️",
    name: "Audio Lab",
    description: "Transcribe audio y video con IA, edita y exporta en TXT, SRT y más",
    color: "from-purple-500 to-fuchsia-600",
    glow: "rgba(168,85,247,0.15)",
    border: "rgba(168,85,247,0.2)",
    href: "/audio-lab",
    tag: "Creativo",
    status: "active",
  },
  {
    id: "image-studio",
    icon: "🖼️",
    name: "Image Studio",
    description: "Genera imágenes con FLUX y SD, galería unificada con filtros y fullscreen",
    color: "from-pink-500 to-rose-600",
    glow: "rgba(236,72,153,0.15)",
    border: "rgba(236,72,153,0.2)",
    href: "/image-studio",
    tag: "Creativo",
    status: "active",
  },
  {
    id: "video-studio",
    icon: "🎬",
    name: "Video Studio",
    description:
      "Generación de video con IA conectada al nuevo motor de video. Por ahora se encuentra en mantención mientras finalizamos la integración.",
    color: "from-cyan-500 to-blue-600",
    glow: "rgba(34,211,238,0.14)",
    border: "rgba(34,211,238,0.24)",
    href: "/video-studio",
    tag: "Creativo",
    status: "maintenance",
    ctaLabel: "Ver estado",
  },
  {
    id: "galeria",
    icon: "🖼️",
    name: "Galería",
    description: "Todas tus imágenes generadas, manuales y automáticas durante el estudio",
    color: "from-fuchsia-500 to-pink-600",
    glow: "rgba(217,70,239,0.15)",
    border: "rgba(217,70,239,0.2)",
    href: "/galeria",
    tag: "Creativo",
    status: "active",
  },
  {
    id: "ranking",
    icon: "🏆",
    name: "Ranking",
    description: "Tabla de posiciones global con podio, XP y racha de estudio",
    color: "from-amber-500 to-orange-600",
    glow: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.2)",
    href: "/ranking",
    tag: "Comunidad",
    status: "active",
  },
  {
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
]

const TAGS = Array.from(new Set(AGENTS.map((a) => a.tag)))

const TAG_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Docentes: { bg: "rgba(16,185,129,0.1)", text: "#6ee7b7", border: "rgba(16,185,129,0.2)" },
  Investigación: { bg: "rgba(59,130,246,0.1)", text: "#93c5fd", border: "rgba(59,130,246,0.2)" },
  Escritura: { bg: "rgba(139,92,246,0.1)", text: "#c4b5fd", border: "rgba(139,92,246,0.2)" },
  Matemáticas: { bg: "rgba(245,158,11,0.1)", text: "#fcd34d", border: "rgba(245,158,11,0.2)" },
  Idiomas: { bg: "rgba(6,182,212,0.1)", text: "#67e8f9", border: "rgba(6,182,212,0.2)" },
  PDF: { bg: "rgba(99,102,241,0.1)", text: "#a5b4fc", border: "rgba(99,102,241,0.2)" },
  Evaluación: { bg: "rgba(239,68,68,0.1)", text: "#fca5a5", border: "rgba(239,68,68,0.2)" },
  Creativo: { bg: "rgba(236,72,153,0.1)", text: "#f9a8d4", border: "rgba(236,72,153,0.2)" },
  Comunidad: { bg: "rgba(245,158,11,0.1)", text: "#fcd34d", border: "rgba(245,158,11,0.2)" },
  Organización: { bg: "rgba(67,56,202,0.1)", text: "#a5b4fc", border: "rgba(67,56,202,0.2)" },
}

function statusPill(status?: "active" | "maintenance") {
  if (status === "maintenance") {
    return {
      label: "En mantención",
      className:
        "bg-amber-500/10 text-amber-700 border border-amber-400/20",
    }
  }

  return {
    label: "Disponible",
    className:
      "bg-emerald-500/10 text-emerald-700 border border-emerald-400/20",
  }
}

export default function AgentesPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-app">
      <header className="sticky top-0 z-10 border-b border-soft bg-app backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5">
          <button
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-soft bg-card-soft-theme text-sub transition-all hover:bg-input-theme hover:text-main"
          >
            <ArrowLeft size={15} />
          </button>

          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20">
            🤖
          </div>

          <div>
            <h1 className="text-sm font-semibold text-main">Agentes de IA</h1>
            <p className="text-xs text-muted2">{AGENTS.length} agentes especializados</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-wrap gap-2">
          {TAGS.map((tag) => {
            const style = TAG_STYLES[tag] || TAG_STYLES["Creativo"]
            const count = AGENTS.filter((a) => a.tag === tag).length

            return (
              <div
                key={tag}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                style={{
                  background: style.bg,
                  color: style.text,
                  borderColor: style.border,
                }}
              >
                <span>{tag}</span>
                <span className="opacity-60">({count})</span>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger">
          {AGENTS.map((a) => {
            const tagStyle = TAG_STYLES[a.tag] || TAG_STYLES["Creativo"]
            const state = statusPill(a.status)

            return (
              <Link
                key={a.id}
                href={a.href}
                className="group relative flex flex-col gap-4 rounded-2xl border p-5 transition-all duration-200 hover:scale-[1.02] animate-fade-in"
                style={{
                  background: "var(--bg-card-soft)",
                  borderColor: "var(--bg-card-soft)",
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = a.glow
                  ;(e.currentTarget as HTMLElement).style.borderColor = a.border
                  ;(e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${a.glow}`
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = "var(--bg-card-soft)"
                  ;(e.currentTarget as HTMLElement).style.borderColor = "var(--bg-card-soft)"
                  ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${a.color} text-2xl shadow-lg transition-transform duration-200 group-hover:scale-105`}
                  >
                    {a.icon}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span
                      className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                      style={{
                        background: tagStyle.bg,
                        color: tagStyle.text,
                        borderColor: tagStyle.border,
                      }}
                    >
                      {a.tag}
                    </span>

                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${state.className}`}>
                      {a.status === "maintenance" ? (
                        <span className="inline-flex items-center gap-1">
                          <Wrench size={10} />
                          {state.label}
                        </span>
                      ) : (
                        state.label
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="mb-1.5 text-base font-semibold text-main transition-colors group-hover:text-main">
                    {a.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted2">{a.description}</p>
                </div>

                <div
                  className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                    a.status === "maintenance"
                      ? "text-amber-700 group-hover:text-amber-700"
                      : "text-muted2 group-hover:text-blue-400"
                  }`}
                >
                  <span>{a.ctaLabel || "Abrir agente"}</span>
                  <ChevronRight size={13} className="transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
