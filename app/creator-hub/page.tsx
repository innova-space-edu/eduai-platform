"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronRight, Clock3, FolderOpen, Sparkles, WandSparkles } from "lucide-react"
import {
  CREATOR_HUB_CATEGORIES,
  CREATOR_HUB_CORE_TOOLS,
  CREATOR_HUB_FORMATS,
  CREATOR_HUB_LABS,
  getCreatorHubFormat,
} from "@/components/creator-hub/catalog"
import { loadCreatorHubProjects, type CreatorHubProject } from "@/components/creator-hub/project-store"

function CoreToolCard({ tool }: { tool: (typeof CREATOR_HUB_CORE_TOOLS)[number] }) {
  return (
    <Link href={tool.href} className="group rounded-3xl border border-soft p-5 bg-card-theme hover:bg-card-soft-theme transition-all">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${tool.color}15`, border: `1px solid ${tool.color}28` }}>
          {tool.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-main text-sm font-bold">{tool.label}</h3>
            {tool.badge && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: `${tool.color}14`, color: tool.color }}>{tool.badge}</span>}
          </div>
          <p className="text-muted2 text-xs leading-relaxed mt-1.5">{tool.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tool.features.map((feature) => (
              <span key={feature} className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: `${tool.color}0d`, color: tool.color }}>{feature}</span>
            ))}
          </div>
        </div>
        <ChevronRight size={17} style={{ color: tool.color }} className="mt-1 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  )
}

export default function CreatorHubPage() {
  const [recent, setRecent] = useState<CreatorHubProject[]>(() => loadCreatorHubProjects().slice(0, 4))

  useEffect(() => {
    const refresh = () => setRecent(loadCreatorHubProjects().slice(0, 4))
    window.addEventListener("creator-hub-projects-updated", refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener("creator-hub-projects-updated", refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-7 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-violet-500 text-xs font-bold tracking-widest uppercase">
              <Sparkles size={14} /> Creator Hub
            </div>
            <h1 className="text-main text-xl sm:text-2xl font-bold mt-1">Crea, investiga y comparte</h1>
          </div>
          <Link href="/creator-hub/materials" className="hidden sm:flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
            <WandSparkles size={15} /> Crear material
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-7 py-7 sm:py-9 space-y-9">
        <section className="rounded-[28px] border border-soft overflow-hidden bg-card-theme">
          <div className="grid lg:grid-cols-[1.25fr_0.75fr]">
            <div className="p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold text-blue-600" style={{ background: "rgba(37,99,235,0.10)" }}>
                <Sparkles size={13} /> TODO SIGUE DISPONIBLE
              </div>
              <h2 className="text-main text-2xl sm:text-3xl font-bold leading-tight mt-4 max-w-2xl">Un centro creativo más claro, sin perder ninguna función.</h2>
              <p className="text-muted2 text-sm leading-relaxed mt-3 max-w-2xl">
                Usa el cuaderno con fuentes, crea materiales, genera audio, diseña mangas, trabaja con imágenes y video, o comparte por QR. Las herramientas existentes se mantienen y ahora están agrupadas por propósito.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-5">
                <Link href="/creator-hub/notebook" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                  📓 Abrir Cuaderno EduAI <ArrowRight size={14} />
                </Link>
                <Link href="/creator-hub/materials" className="flex items-center gap-2 rounded-xl border border-soft px-4 py-2.5 text-xs font-bold text-sub hover:bg-card-soft-theme transition-colors">
                  ✨ Ver los {CREATOR_HUB_FORMATS.length} formatos
                </Link>
              </div>
            </div>
            <div className="p-6 sm:p-8 border-t lg:border-t-0 lg:border-l border-soft" style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(124,58,237,0.08))" }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted2">Ruta recomendada</p>
              <div className="space-y-3 mt-4">
                {[
                  ["1", "Reúne información", "Cuaderno EduAI, Chat Paper o Investigador"],
                  ["2", "Transforma el contenido", "Presentación, infografía, quiz, podcast y más"],
                  ["3", "Complementa el material", "Audio, voces, imágenes, video o manga"],
                  ["4", "Comparte el resultado", "QR Studio y exportaciones descargables"],
                ].map(([step, title, description]) => (
                  <div key={step} className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 bg-white/80 border border-blue-500/15 flex-shrink-0">{step}</span>
                    <span>
                      <span className="block text-main text-xs font-bold">{title}</span>
                      <span className="block text-muted2 text-[11px] leading-relaxed mt-0.5">{description}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted2">Espacios principales</p>
              <h2 className="text-main text-lg font-bold mt-1">Elige cómo quieres comenzar</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {CREATOR_HUB_CORE_TOOLS.map((tool) => <CoreToolCard key={tool.id} tool={tool} />)}
            <Link href="/creator-hub/projects" className="group rounded-3xl border border-soft p-5 bg-card-theme hover:bg-card-soft-theme transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-slate-500/10 border border-slate-500/20">🗂️</div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-main text-sm font-bold">Mis proyectos</h3>
                  <p className="text-muted2 text-xs leading-relaxed mt-1.5">Revisa las creaciones recientes generadas desde Creator Hub y descarga su respaldo.</p>
                  <div className="flex flex-wrap gap-1.5 mt-3"><span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-500/10 text-muted2">Historial local</span><span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-500/10 text-muted2">JSON</span></div>
                </div>
                <ChevronRight size={17} className="text-muted2 mt-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted2">Generación rápida</p>
              <h2 className="text-main text-lg font-bold mt-1">Crear un material desde un tema, texto o archivo</h2>
            </div>
            <Link href="/creator-hub/materials" className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">Ver todos <ArrowRight size={13} /></Link>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {CREATOR_HUB_CATEGORIES.map((category) => {
              const formats = CREATOR_HUB_FORMATS.filter((format) => format.category === category.id)
              return (
                <Link key={category.id} href={`/creator-hub/materials#${category.id}`} className="rounded-3xl border border-soft bg-card-theme hover:bg-card-soft-theme transition-all p-4 group">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{category.icon}</span>
                    <span className="text-[10px] font-bold text-muted2">{formats.length} FORMATOS</span>
                  </div>
                  <h3 className="text-main text-sm font-bold mt-4">{category.label}</h3>
                  <p className="text-muted2 text-xs leading-relaxed mt-1.5">{category.description}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {formats.slice(0, 3).map((format) => <span key={format.id} className="text-[10px] text-sub px-2 py-0.5 rounded-full bg-card-soft-theme">{format.icon} {format.label}</span>)}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="grid xl:grid-cols-[1fr_0.86fr] gap-5">
          <div>
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted2">Multimedia</p>
                <h2 className="text-main text-lg font-bold mt-1">Audio, imagen, video y recursos</h2>
              </div>
              <Link href="/creator-hub/labs" className="text-teal-600 text-xs font-bold flex items-center gap-1 hover:underline">Abrir labs <ArrowRight size={13} /></Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {CREATOR_HUB_LABS.slice(0, 6).map((tool) => (
                <Link key={tool.id} href={tool.href} className="rounded-2xl border border-soft bg-card-theme hover:bg-card-soft-theme transition-all px-4 py-3 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${tool.color}13` }}>{tool.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block text-main text-xs font-bold truncate">{tool.label}</span><span className="block text-muted2 text-[10px] truncate mt-0.5">{tool.description}</span></span>
                  <ChevronRight size={14} className="text-muted2" />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted2">Historial</p>
                <h2 className="text-main text-lg font-bold mt-1">Creaciones recientes</h2>
              </div>
              <Link href="/creator-hub/projects" className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">Ver proyectos <ArrowRight size={13} /></Link>
            </div>
            <div className="rounded-3xl border border-soft bg-card-theme overflow-hidden">
              {recent.length === 0 ? (
                <div className="p-6 text-center">
                  <FolderOpen size={24} className="text-muted2 mx-auto" />
                  <p className="text-main text-sm font-bold mt-3">Todavía no hay creaciones guardadas</p>
                  <p className="text-muted2 text-xs mt-1 leading-relaxed">Al generar un material desde Creator Hub aparecerá automáticamente en este historial local.</p>
                </div>
              ) : (
                <div className="divide-y divide-soft">
                  {recent.map((project) => {
                    const format = getCreatorHubFormat(project.format)
                    return (
                      <Link href={`/creator-hub/${project.format}`} key={project.id} className="flex items-center gap-3 p-3.5 hover:bg-card-soft-theme transition-all">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${format?.color || "#64748b"}13` }}>{format?.icon || "📄"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-main text-xs font-bold truncate">{project.title}</span>
                          <span className="flex items-center gap-1 text-muted2 text-[10px] mt-0.5"><Clock3 size={10} /> {new Date(project.createdAt).toLocaleString("es-CL")}</span>
                        </span>
                        <ChevronRight size={14} className="text-muted2" />
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
