"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"

const AGENTS = [
  {
    id: "educador",
    icon: "🏫",
    name: "Planificador",
    description: "Planificaciones MINEDUC para docentes chilenos",
    color: "from-emerald-500 to-teal-600",
    href: "/educador",
    tag: "Docentes",
  },
  {
    id: "investigador",
    icon: "🔬",
    name: "Investigador",
    description: "Busca y resume fuentes académicas y papers",
    color: "from-blue-500 to-indigo-600",
    href: "/investigador",
    tag: "Investigación",
  },
  {
    id: "redactor",
    icon: "✍️",
    name: "Redactor",
    description: "Ensayos, informes, cartas y documentos formales",
    color: "from-violet-500 to-purple-600",
    href: "/redactor",
    tag: "Escritura",
  },
  {
    id: "matematico",
    icon: "🧮",
    name: "Matemático",
    description: "Resolución paso a paso con notación LaTeX profesional",
    color: "from-orange-500 to-amber-600",
    href: "/matematico",
    tag: "Matemáticas",
  },
  {
    id: "traductor",
    icon: "🌐",
    name: "Traductor",
    description: "Traducción con explicación lingüística y cultural",
    color: "from-cyan-500 to-sky-600",
    href: "/traductor",
    tag: "Idiomas",
  },
  {
    id: "paper",
    icon: "📄",
    name: "Chat Paper",
    description: "Sube un PDF y conversa profundamente sobre su contenido",
    color: "from-indigo-500 to-blue-700",
    href: "/paper",
    tag: "PDF",
  },
  {
    id: "examen",
    icon: "📝",
    name: "Examen",
    description: "Simulacro completo con timer, corrección IA y retroalimentación",
    color: "from-red-500 to-rose-600",
    href: "/examen",
    tag: "Evaluación",
  },
  {
    id: "imagenes",
    icon: "🎨",
    name: "Generador de Imágenes",
    description: "Crea imágenes con FLUX y Stable Diffusion desde texto",
    color: "from-pink-500 to-purple-600",
    href: "/imagenes",
    tag: "Creativo",
  },
  {
    id: "galeria",
    icon: "🖼️",
    name: "Galería",
    description: "Todas tus imágenes generadas, manuales y automáticas",
    color: "from-fuchsia-500 to-pink-600",
    href: "/galeria",
    tag: "Creativo",
  },
]

const TAG_COLORS: Record<string, string> = {
  "Docentes":      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Investigación": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Escritura":     "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "Matemáticas":   "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Idiomas":       "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "PDF":           "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "Evaluación":    "bg-red-500/10 text-red-400 border-red-500/20",
  "Creativo":      "bg-pink-500/10 text-pink-400 border-pink-500/20",
}

export default function AgentesPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm"
          >←</button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg">🤖</div>
          <div>
            <h1 className="text-white font-semibold text-sm">Agentes de IA</h1>
            <p className="text-gray-500 text-xs">{AGENTS.length} agentes especializados disponibles</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map(a => (
            <Link
              key={a.id}
              href={a.href}
              className="group bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-5 flex flex-col gap-4 transition-all hover:bg-gray-900/80 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20"
            >
              {/* Icon + tag */}
              <div className="flex items-start justify-between">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center text-2xl shadow-lg group-hover:scale-105 transition-transform`}>
                  {a.icon}
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${TAG_COLORS[a.tag] || "bg-gray-800 text-gray-500 border-gray-700"}`}>
                  {a.tag}
                </span>
              </div>

              {/* Info */}
              <div>
                <h3 className="text-white font-semibold text-base mb-1 group-hover:text-blue-300 transition-colors">
                  {a.name}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {a.description}
                </p>
              </div>

              {/* CTA */}
              <div className="flex items-center gap-1 text-gray-600 group-hover:text-blue-400 text-xs font-medium transition-colors mt-auto">
                <span>Abrir agente</span>
                <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
