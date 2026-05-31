"use client"
// app/creator-hub/page.tsx — v4
// Agrega Notebook Hub, QR Studio y Comics manteniendo modo clásico

import Link from "next/link"
import { ChevronRight } from "lucide-react"

const FORMATS = [
  { id: "infographic", icon: "📊", label: "Infografía",       desc: "Bloques de datos, estadísticas y conceptos visualizados",           color: "#3b82f6", cat: "visual" },
  { id: "ppt",         icon: "📑", label: "Presentación",     desc: "Slides profesionales con portada, temas y notas del orador",         color: "#8b5cf6", cat: "visual" },
  { id: "poster",      icon: "🎨", label: "Afiche",           desc: "Poster llamativo para ferias, clases y proyectos escolares",         color: "#ec4899", cat: "visual" },
  { id: "mindmap",     icon: "🧠", label: "Mapa Mental",      desc: "Árbol de conceptos interactivo con zoom y navegación",               color: "#10b981", cat: "visual" },
  { id: "timeline",    icon: "⏳", label: "Timeline",         desc: "Línea temporal con hitos, fechas e importancia visual",              color: "#f97316", cat: "visual" },
  { id: "flashcards",  icon: "📇", label: "Flashcards",       desc: "Tarjetas frente/reverso con repetición espaciada y pistas",         color: "#06b6d4", cat: "study"  },
  { id: "quiz",        icon: "✅", label: "Quiz",             desc: "Preguntas con taxonomía de Bloom, feedback y puntaje",              color: "#22c55e", cat: "study"  },
  { id: "cornell",     icon: "📓", label: "Notas Cornell",    desc: "Apuntes estructurados en formato Cornell con resumen final",        color: "#a78bfa", cat: "study"  },
  { id: "glossary",    icon: "📖", label: "Glosario",         desc: "Definiciones claras de términos clave con ejemplos y contexto",     color: "#34d399", cat: "study"  },
  { id: "podcast",     icon: "🎙️", label: "Podcast",          desc: "Guión conversacional entre Álvaro y Elvira con audio inmediato",   color: "#f59e0b", cat: "narrative" },
  { id: "story",       icon: "📚", label: "Cuento Educativo", desc: "Historia narrativa que enseña un concepto con personajes y trama",  color: "#f87171", cat: "narrative" },
  { id: "song",        icon: "🎵", label: "Canción / Rap",    desc: "Letra mnemónica o rap para memorizar conceptos fácilmente",         color: "#fb923c", cat: "narrative" },
  { id: "lessonplan",  icon: "🗒️", label: "Plan de Clase",   desc: "Estructura completa: objetivo, actividades, evaluación y recursos", color: "#60a5fa", cat: "plan"    },
]

const CATEGORIES = [
  { id: "visual",    label: "Visuales",      icon: "🖼️" },
  { id: "study",     label: "Estudio",       icon: "📚" },
  { id: "narrative", label: "Narrativo",     icon: "🎙️" },
  { id: "plan",      label: "Planificación", icon: "🗒️" },
]

const FEATURED_TOOLS = [
  {
    href: "/notebooks",
    icon: "📓",
    title: "Chat Paper",
    badge: "ACTIVO",
    desc: "Sube fuentes, agrega enlaces, conversa con documentos y crea materiales desde información verificable.",
    features: ["PDF y URL", "Chat RAG", "Studio conectado"],
    color: "#3b82f6",
  },
  {
    href: "/qr-studio",
    icon: "◩",
    title: "QR Studio",
    badge: "NUEVO",
    desc: "Genera códigos QR descargables para compartir enlaces, textos y cuadernos de Chat Paper.",
    features: ["PNG", "Vencimiento", "Contador"],
    color: "#06b6d4",
  },
  {
    href: "/creator-hub/comics",
    icon: "💬",
    title: "Mangas e historietas",
    badge: "BETA",
    desc: "Diseña un storyboard educativo editable con personajes, escenas, diálogos y estilos visuales.",
    features: ["Manga", "Webtoon", "Cómic escolar"],
    color: "#ec4899",
  },
]

export default function CreatorHubPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b border-soft bg-app backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <p className="text-main font-bold text-sm">Creator Hub</p>
          </div>
          <p className="text-muted2 text-xs">{FORMATS.length} formatos clásicos + 3 herramientas</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-6 py-10 flex flex-col gap-9">
        <div>
          <h1 className="text-2xl font-bold text-main mb-2">Crea, investiga y comparte</h1>
          <p className="text-muted2 text-sm leading-relaxed">
            Usa herramientas conectadas para conversar con fuentes, producir materiales y compartirlos con códigos QR.
          </p>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <span>🚀</span>
            <h2 className="text-main font-semibold text-sm">Herramientas destacadas</h2>
            <div className="flex-1 h-px" style={{ background: "var(--border-soft)" }} />
          </div>
          <div className="grid gap-3">
            {FEATURED_TOOLS.map((tool) => (
              <Link key={tool.href} href={tool.href} className="group">
                <div className="relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all overflow-hidden"
                  style={{ background: `${tool.color}08`, borderColor: `${tool.color}22` }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: `${tool.color}16`, border: `1px solid ${tool.color}30` }}>
                    {tool.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-main font-bold text-sm">{tool.title}</p>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: `${tool.color}18`, color: tool.color }}>
                        {tool.badge}
                      </span>
                    </div>
                    <p className="text-muted2 text-xs mt-1 leading-relaxed">{tool.desc}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tool.features.map((feature) => (
                        <span key={feature} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${tool.color}10`, color: tool.color }}>
                          ✓ {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight size={17} style={{ color: tool.color }} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ background: "var(--border-soft)" }} />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted2">Modo clásico — desde prompt</span>
          <div className="flex-1 h-px" style={{ background: "var(--border-soft)" }} />
        </div>

        {CATEGORIES.map((category) => {
          const formats = FORMATS.filter((format) => format.cat === category.id)
          return (
            <section key={category.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{category.icon}</span>
                <h2 className="text-main font-semibold text-sm">{category.label}</h2>
                <div className="flex-1 h-px" style={{ background: "var(--border-soft)" }} />
                <span className="text-muted2 text-xs">{formats.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {formats.map((format) => (
                  <Link key={format.id} href={`/creator-hub/${format.id}`}
                    className="group flex items-center gap-4 p-4 rounded-2xl border transition-all"
                    style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-105"
                      style={{ background: `${format.color}15`, border: `1px solid ${format.color}25` }}>
                      {format.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-main font-semibold text-sm leading-tight">{format.label}</p>
                      <p className="text-muted2 text-xs mt-0.5 leading-relaxed line-clamp-2">{format.desc}</p>
                    </div>
                    <ChevronRight size={15} className="text-muted2 group-hover:text-sub transition-all group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          )
        })}

        <div className="rounded-2xl px-5 py-4 border text-sm text-muted2 leading-relaxed"
          style={{ background: "rgba(59,130,246,0.04)", borderColor: "rgba(59,130,246,0.12)" }}>
          <span className="text-blue-400 font-semibold">💡 Recomendado: </span>
          Comienza desde <strong className="text-sub">Chat Paper</strong> cuando trabajes con documentos reales y utiliza <strong className="text-sub">QR Studio</strong> para compartir el resultado.
        </div>
      </div>
    </div>
  )
}
