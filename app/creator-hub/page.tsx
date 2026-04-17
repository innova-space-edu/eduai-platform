"use client"
// app/creator-hub/page.tsx — v2
// Añade: Cornell Notes, Glosario, Cuento, Canción/Rap, Plan de Clase

import Link from "next/link"
import { ChevronRight } from "lucide-react"

const FORMATS = [
  // ── Visuales ─────────────────────────────────────────────────────────
  { id: "infographic", icon: "📊", label: "Infografía",     desc: "Bloques de datos, estadísticas y conceptos visualizados",          color: "#3b82f6", cat: "visual" },
  { id: "ppt",         icon: "📑", label: "Presentación",   desc: "Slides profesionales con portada, temas y notas del orador",        color: "#8b5cf6", cat: "visual" },
  { id: "poster",      icon: "🎨", label: "Afiche",         desc: "Poster llamativo para ferias, clases y proyectos escolares",        color: "#ec4899", cat: "visual" },
  { id: "mindmap",     icon: "🧠", label: "Mapa Mental",    desc: "Árbol de conceptos interactivo con zoom y navegación",              color: "#10b981", cat: "visual" },
  { id: "timeline",    icon: "⏳", label: "Timeline",        desc: "Línea temporal con hitos, fechas e importancia visual",            color: "#f97316", cat: "visual" },

  // ── Estudio ───────────────────────────────────────────────────────────
  { id: "flashcards",  icon: "📇", label: "Flashcards",     desc: "Tarjetas frente/reverso con repetición espaciada y pistas",        color: "#06b6d4", cat: "study"  },
  { id: "quiz",        icon: "✅", label: "Quiz",            desc: "Preguntas con taxonomía de Bloom, feedback y puntaje",             color: "#22c55e", cat: "study"  },
  { id: "cornell",     icon: "📓", label: "Notas Cornell",  desc: "Apuntes estructurados en formato Cornell con resumen final",       color: "#a78bfa", cat: "study"  },
  { id: "glossary",    icon: "📖", label: "Glosario",       desc: "Definiciones claras de términos clave con ejemplos y contexto",    color: "#34d399", cat: "study"  },

  // ── Narrativo ─────────────────────────────────────────────────────────
  { id: "podcast",     icon: "🎙️", label: "Podcast",        desc: "Guión conversacional entre Álvaro y Elvira con audio inmediato",  color: "#f59e0b", cat: "narrative" },
  { id: "story",       icon: "📚", label: "Cuento Educativo", desc: "Historia narrativa que enseña un concepto con personajes y trama", color: "#f87171", cat: "narrative" },
  { id: "song",        icon: "🎵", label: "Canción / Rap",  desc: "Letra mnemónica o rap para memorizar conceptos fácilmente",        color: "#fb923c", cat: "narrative" },

  // ── Planificación ─────────────────────────────────────────────────────
  { id: "lessonplan",  icon: "🗒️", label: "Plan de Clase",  desc: "Estructura completa: objetivo, actividades, evaluación y recursos", color: "#60a5fa", cat: "plan"    },
]

const CATEGORIES = [
  { id: "visual",    label: "Visuales",       icon: "🖼️" },
  { id: "study",     label: "Estudio",         icon: "📚" },
  { id: "narrative", label: "Narrativo",       icon: "🎙️" },
  { id: "plan",      label: "Planificación",   icon: "🗒️" },
]

export default function CreatorHubPage() {
  return (
    <div className="flex flex-col min-h-screen">

      {/* Topbar */}
      <div className="border-b border-soft bg-app backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <p className="text-main font-bold text-sm">Creator Hub</p>
          </div>
          <p className="text-muted2 text-xs">{FORMATS.length} formatos disponibles</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-main mb-2">Crea material de estudio</h1>
          <p className="text-muted2 text-sm leading-relaxed">
            Transforma cualquier tema, texto, PDF o URL en {FORMATS.length} formatos distintos.
            Cada agente está especializado y genera resultados interactivos y descargables.
          </p>
        </div>

        {/* Categories */}
        {CATEGORIES.map(cat => {
          const catFormats = FORMATS.filter(f => f.cat === cat.id)
          return (
            <section key={cat.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{cat.icon}</span>
                <h2 className="text-main font-semibold text-sm">{cat.label}</h2>
                <div className="flex-1 h-px" style={{ background: "var(--border-soft)" }} />
                <span className="text-muted2 text-xs">{catFormats.length}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {catFormats.map(f => (
                  <Link
                    key={f.id}
                    href={`/creator-hub/${f.id}`}
                    className="group flex items-center gap-4 p-4 rounded-2xl border transition-all"
                    style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background   = `${f.color}0c`
                      ;(e.currentTarget as HTMLElement).style.borderColor = `${f.color}25`
                      ;(e.currentTarget as HTMLElement).style.boxShadow   = `0 4px 20px ${f.color}15`
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background   = "var(--bg-card-soft)"
                      ;(e.currentTarget as HTMLElement).style.borderColor = "var(--bg-card-soft)"
                      ;(e.currentTarget as HTMLElement).style.boxShadow   = "none"
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-105"
                      style={{ background: `${f.color}15`, border: `1px solid ${f.color}25` }}
                    >
                      {f.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-main font-semibold text-sm leading-tight">{f.label}</p>
                      <p className="text-muted2 text-xs mt-0.5 leading-relaxed line-clamp-2">{f.desc}</p>
                    </div>
                    <ChevronRight size={15} className="text-muted2 group-hover:text-sub transition-all group-hover:translate-x-0.5 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )
        })}

        {/* Tip */}
        <div className="rounded-2xl px-5 py-4 border text-sm text-muted2 leading-relaxed"
          style={{ background: "rgba(59,130,246,0.04)", borderColor: "rgba(59,130,246,0.12)" }}>
          <span className="text-blue-400 font-semibold">💡 Flujo recomendado: </span>
          Empieza con un <strong className="text-sub">Mapa Mental</strong> para estructurar el tema →
          genera la <strong className="text-sub">Infografía</strong> para visualizarlo →
          crea el <strong className="text-sub">Quiz</strong> para evaluarlo →
          y el <strong className="text-sub">Podcast</strong> para repasarlo de camino a casa.
        </div>
      </div>
    </div>
  )
}
