"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

const FORMATS = [
  { id: "infographic", icon: "📊", label: "Infografía",    desc: "Visual con bloques de datos, estadísticas y conceptos clave",     color: "#3b82f6" },
  { id: "ppt",         icon: "📑", label: "Presentación",  desc: "Slides profesionales con temas, títulos y notas del orador",      color: "#8b5cf6" },
  { id: "poster",      icon: "🎨", label: "Afiche",        desc: "Poster visual para ferias, clases y proyectos escolares",          color: "#ec4899" },
  { id: "podcast",     icon: "🎙️", label: "Podcast",       desc: "Guión conversacional con voz de Álvaro y Elvira (Edge TTS)",      color: "#f59e0b" },
  { id: "mindmap",     icon: "🧠", label: "Mapa Mental",   desc: "Árbol de conceptos interactivo con zoom y navegación",            color: "#10b981" },
  { id: "flashcards",  icon: "📇", label: "Flashcards",    desc: "Tarjetas frente/reverso integradas con repetición espaciada",     color: "#06b6d4" },
  { id: "quiz",        icon: "✅", label: "Quiz",           desc: "Preguntas con taxonomía de Bloom, feedback y puntaje",            color: "#22c55e" },
  { id: "timeline",    icon: "⏳", label: "Timeline",       desc: "Línea temporal con hitos, fechas e importancia visual",          color: "#f97316" },
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
          <p className="text-muted2 text-xs">Elige un formato para empezar</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-8">

        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-main mb-2">
            Crea material de estudio
          </h1>
          <p className="text-muted2 text-sm leading-relaxed">
            Transforma cualquier tema, texto, PDF o URL en 8 formatos distintos. Cada sub-agente está especializado en su propio formato y genera resultados descargables.
          </p>
        </div>

        {/* Grid de formatos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
          {FORMATS.map(f => (
            <Link
              key={f.id}
              href={`/creator-hub/${f.id}`}
              className="group flex items-center gap-4 p-4 rounded-2xl border transition-all animate-fade-in"
              style={{
                background:   "var(--bg-card-soft)",
                borderColor:  "var(--bg-card-soft)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = `${f.color}0c`
                ;(e.currentTarget as HTMLElement).style.borderColor = `${f.color}25`
                ;(e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${f.color}15`
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-card-soft)"
                ;(e.currentTarget as HTMLElement).style.borderColor = "var(--bg-card-soft)"
                ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
              }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:scale-105"
                style={{ background: `${f.color}15`, border: `1px solid ${f.color}25` }}
              >
                {f.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-main font-semibold text-sm leading-tight">{f.label}</p>
                <p className="text-muted2 text-xs mt-0.5 leading-relaxed line-clamp-2">{f.desc}</p>
              </div>

              {/* Arrow */}
              <ChevronRight
                size={16}
                className="text-muted2 group-hover:text-sub transition-all group-hover:translate-x-0.5 flex-shrink-0"
              />
            </Link>
          ))}
        </div>

        {/* Tip */}
        <div
          className="rounded-2xl px-5 py-4 border text-sm text-muted2 leading-relaxed animate-fade-in"
          style={{ background: "rgba(59,130,246,0.04)", borderColor: "rgba(59,130,246,0.12)" }}
        >
          <span className="text-blue-400 font-semibold">💡 Tip: </span>
          Puedes usar el mismo tema en todos los formatos. Empieza con un mapa mental para estructurar el contenido, luego genera la infografía y la presentación.
        </div>
      </div>
    </div>
  )
}
