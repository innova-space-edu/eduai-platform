"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronRight } from "lucide-react"

const AGENTS = [
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
  },
]

const TAGS = Array.from(new Set(AGENTS.map(a => a.tag)))

const TAG_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Docentes":      { bg: "rgba(16,185,129,0.1)",  text: "#6ee7b7", border: "rgba(16,185,129,0.2)"  },
  "Investigación": { bg: "rgba(59,130,246,0.1)",   text: "#93c5fd", border: "rgba(59,130,246,0.2)"  },
  "Escritura":     { bg: "rgba(139,92,246,0.1)",   text: "#c4b5fd", border: "rgba(139,92,246,0.2)"  },
  "Matemáticas":   { bg: "rgba(245,158,11,0.1)",   text: "#fcd34d", border: "rgba(245,158,11,0.2)"  },
  "Idiomas":       { bg: "rgba(6,182,212,0.1)",    text: "#67e8f9", border: "rgba(6,182,212,0.2)"   },
  "PDF":           { bg: "rgba(99,102,241,0.1)",   text: "#a5b4fc", border: "rgba(99,102,241,0.2)"  },
  "Evaluación":    { bg: "rgba(239,68,68,0.1)",    text: "#fca5a5", border: "rgba(239,68,68,0.2)"   },
  "Creativo":      { bg: "rgba(236,72,153,0.1)",   text: "#f9a8d4", border: "rgba(236,72,153,0.2)"  },
  "Comunidad":     { bg: "rgba(245,158,11,0.1)",   text: "#fcd34d", border: "rgba(245,158,11,0.2)"  },
  "Organización":  { bg: "rgba(67,56,202,0.1)",    text: "#a5b4fc", border: "rgba(67,56,202,0.2)"   },
}

export default function AgentesPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Header */}
      <header className="border-b border-white/[0.06] bg-gray-950/90 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.07] transition-all"
          >
            <ArrowLeft size={15} />
          </button>

          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            🤖
          </div>

          <div>
            <h1 className="text-white font-semibold text-sm">Agentes de IA</h1>
            <p className="text-gray-500 text-xs">{AGENTS.length} agentes especializados</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Category chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {TAGS.map(tag => {
            const style = TAG_STYLES[tag] || TAG_STYLES["Creativo"]
            const count = AGENTS.filter(a => a.tag === tag).length
            return (
              <div
                key={tag}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium"
                style={{ background: style.bg, color: style.text, borderColor: style.border }}
              >
                <span>{tag}</span>
                <span className="opacity-60">({count})</span>
              </div>
            )
          })}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {AGENTS.map(a => {
            const tagStyle = TAG_STYLES[a.tag] || TAG_STYLES["Creativo"]
            return (
              <Link
                key={a.id}
                href={a.href}
                className="group relative flex flex-col gap-4 p-5 rounded-2xl border transition-all duration-200 hover:scale-[1.02] animate-fade-in"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.07)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = a.glow
                  ;(e.currentTarget as HTMLElement).style.borderColor = a.border
                  ;(e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${a.glow}`
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"
                  ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"
                  ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
                }}
              >
                {/* Icon + tag */}
                <div className="flex items-start justify-between">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center text-2xl shadow-lg transition-transform duration-200 group-hover:scale-105`}
                  >
                    {a.icon}
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full border"
                    style={{ background: tagStyle.bg, color: tagStyle.text, borderColor: tagStyle.border }}
                  >
                    {a.tag}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-base mb-1.5 group-hover:text-white transition-colors">
                    {a.name}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {a.description}
                  </p>
                </div>

                {/* CTA */}
                <div className="flex items-center gap-1 text-gray-600 group-hover:text-blue-400 text-xs font-medium transition-colors">
                  <span>Abrir agente</span>
                  <ChevronRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
