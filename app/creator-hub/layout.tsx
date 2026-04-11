"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft } from "lucide-react"

const FORMATS = [
  { id: "infographic", icon: "📊", label: "Infografía",   desc: "Visual con datos clave",      color: "#3b82f6" },
  { id: "ppt",         icon: "📑", label: "Presentación", desc: "Slides descargables",          color: "#8b5cf6" },
  { id: "poster",      icon: "🎨", label: "Afiche",       desc: "Poster visual atractivo",      color: "#ec4899" },
  { id: "podcast",     icon: "🎙️", label: "Podcast",      desc: "Audio conversacional",         color: "#f59e0b" },
  { id: "mindmap",     icon: "🧠", label: "Mapa Mental",  desc: "Conceptos conectados",         color: "#10b981" },
  { id: "flashcards",  icon: "📇", label: "Flashcards",   desc: "Tarjetas de estudio",          color: "#06b6d4" },
  { id: "quiz",        icon: "✅", label: "Quiz",          desc: "Evaluación adaptativa",        color: "#22c55e" },
  { id: "timeline",    icon: "⏳", label: "Timeline",      desc: "Línea temporal",               color: "#f97316" },
]

export default function CreatorHubLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
      else setReady(true)
    })
  }, [])

  // Extraer el format activo de la URL: /creator-hub/ppt → "ppt"
  const activeFormat = pathname.split("/").pop() || ""

  if (!ready) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-soft border-t-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app flex">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 h-full w-[220px] z-20 flex flex-col border-r border-soft bg-header-theme backdrop-blur-xl">

        {/* Header */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-soft flex-shrink-0">
          <Link
            href="/dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main hover:bg-input-theme transition-all flex-shrink-0"
          >
            <ArrowLeft size={14} />
          </Link>
          <div className="min-w-0">
            <p className="text-main font-bold text-sm leading-tight">Creator Hub</p>
            <p className="text-muted2 text-[10px]">8 formatos</p>
          </div>
        </div>

        {/* Format list */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
          {FORMATS.map(f => {
            const isActive = activeFormat === f.id
            return (
              <Link
                key={f.id}
                href={`/creator-hub/${f.id}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-all group"
                style={{
                  background:   isActive ? `${f.color}12` : "transparent",
                  borderColor:  isActive ? `${f.color}30` : "transparent",
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-input)"
                    ;(e.currentTarget as HTMLElement).style.borderColor = "var(--bg-card-soft)"
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = "transparent"
                    ;(e.currentTarget as HTMLElement).style.borderColor = "transparent"
                  }
                }}
              >
                {/* Icon dot */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 transition-transform group-hover:scale-105"
                  style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}
                >
                  {f.icon}
                </div>

                {/* Labels */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate"
                     style={{ color: isActive ? f.color : "var(--text-primary)" }}>
                    {f.label}
                  </p>
                  <p className="text-[10px] text-muted2 truncate">{f.desc}</p>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                       style={{ background: f.color }} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer: link al Creator original */}
        <div className="border-t border-soft p-3 flex-shrink-0">
          <Link
            href="/creator"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-muted2 hover:text-sub hover:bg-card-soft-theme transition-all text-xs"
          >
            <span>✨</span>
            <span>Creator clásico</span>
          </Link>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-screen" style={{ marginLeft: "220px" }}>
        {children}
      </main>
    </div>
  )
}
