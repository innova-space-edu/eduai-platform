"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Cpu,
  Database,
  FlaskConical,
  Gauge,
  Video,
} from "lucide-react"

const SECTIONS = [
  { id: "infraestructura", label: "Infraestructura", short: "Core", icon: Database },
  { id: "brain-ai", label: "Brain AI", short: "Brain", icon: BrainCircuit },
  { id: "litert", label: "LiteRT local", short: "LiteRT", icon: Cpu },
  { id: "benchmark", label: "Rendimiento", short: "Perf", icon: Gauge },
  { id: "modelos", label: "Modelos", short: "Modelos", icon: Cpu },
  { id: "video", label: "Video Router", short: "Video", icon: Video },
  { id: "observabilidad", label: "Observabilidad", short: "Métricas", icon: BarChart3 },
  { id: "experimental", label: "Experimental", short: "Lab", icon: FlaskConical },
] as const

export default function ModelLabSectionNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id)
  const frameRef = useRef<number | null>(null)
  const ids = useMemo(() => SECTIONS.map(section => section.id), [])

  useEffect(() => {
    const updateActive = () => {
      frameRef.current = null
      const anchorY = 118
      let current = ids[0]
      for (const id of ids) {
        const element = document.getElementById(id)
        if (!element) continue
        if (element.getBoundingClientRect().top <= anchorY) current = id
        else break
      }

      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8
      if (nearBottom) current = ids[ids.length - 1]
      setActive(current)
    }

    const scheduleUpdate = () => {
      if (frameRef.current !== null) return
      frameRef.current = window.requestAnimationFrame(updateActive)
    }

    updateActive()
    window.addEventListener("scroll", scheduleUpdate, { passive: true })
    window.addEventListener("resize", scheduleUpdate)
    return () => {
      window.removeEventListener("scroll", scheduleUpdate)
      window.removeEventListener("resize", scheduleUpdate)
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    }
  }, [ids])

  function goTo(id: string) {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="sticky top-2 z-30 -mx-1 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/90 p-1.5 shadow-[0_18px_60px_rgba(2,6,23,0.38)] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max items-center gap-1">
        <div className="mr-1 hidden items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-950/30 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 lg:flex">
          <Activity className="h-3.5 w-3.5" /> Model Lab
        </div>
        {SECTIONS.map(section => {
          const Icon = section.icon
          const selected = active === section.id
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => goTo(section.id)}
              className={`group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-all ${selected ? "bg-cyan-950/55 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.22)]" : "text-slate-500 hover:bg-slate-900/70 hover:text-slate-200"}`}
              aria-current={selected ? "location" : undefined}
            >
              <Icon className={`h-3.5 w-3.5 transition ${selected ? "text-cyan-300" : "text-slate-600 group-hover:text-slate-300"}`} />
              <span className="hidden md:inline">{section.label}</span>
              <span className="md:hidden">{section.short}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
