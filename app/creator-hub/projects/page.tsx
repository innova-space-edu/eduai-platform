"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Copy, Download, FolderOpen, Search, Trash2, WandSparkles, X } from "lucide-react"
import { CREATOR_HUB_FORMATS, getCreatorHubFormat } from "@/components/creator-hub/catalog"
import {
  downloadCreatorHubProject,
  duplicateCreatorHubProject,
  loadCreatorHubProjects,
  removeCreatorHubProject,
  type CreatorHubProject,
} from "@/components/creator-hub/project-store"

export default function CreatorHubProjectsPage() {
  const [projects, setProjects] = useState<CreatorHubProject[]>(() => loadCreatorHubProjects())
  const [query, setQuery] = useState("")
  const [format, setFormat] = useState("all")

  const refresh = () => setProjects(loadCreatorHubProjects())

  useEffect(() => {
    window.addEventListener("creator-hub-projects-updated", refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener("creator-hub-projects-updated", refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return projects.filter((project) => {
      if (format !== "all" && project.format !== format) return false
      if (!normalized) return true
      return `${project.title} ${project.format}`.toLowerCase().includes(normalized)
    })
  }, [format, projects, query])

  const copyProject = async (project: CreatorHubProject) => {
    await navigator.clipboard?.writeText(JSON.stringify(project, null, 2))
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-7 py-4">
          <div className="flex items-center gap-2 text-slate-600 text-xs font-bold tracking-widest uppercase"><FolderOpen size={14} /> Mis proyectos</div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mt-2">
            <div>
              <h1 className="text-main text-xl sm:text-2xl font-bold">Historial local de Creator Hub</h1>
              <p className="text-muted2 text-sm mt-1">Cada material generado desde el editor mejorado se conserva como respaldo local en este navegador.</p>
            </div>
            <div className="relative w-full lg:w-[340px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted2" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proyecto..." className="w-full rounded-xl border border-soft bg-card-theme pl-9 pr-9 py-2.5 text-sm text-main outline-none focus:border-blue-500/30" />
              {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2 hover:text-main"><X size={14} /></button>}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-7 py-7 sm:py-9">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
          <button onClick={() => setFormat("all")} className="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold" style={{ background: format === "all" ? "rgba(37,99,235,0.10)" : "var(--bg-card)", borderColor: format === "all" ? "rgba(37,99,235,0.24)" : "var(--border-soft)", color: format === "all" ? "#2563eb" : "var(--text-muted)" }}>Todos ({projects.length})</button>
          {CREATOR_HUB_FORMATS.map((item) => {
            const count = projects.filter((project) => project.format === item.id).length
            if (count === 0) return null
            return <button key={item.id} onClick={() => setFormat(item.id)} className="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold" style={{ background: format === item.id ? `${item.color}12` : "var(--bg-card)", borderColor: format === item.id ? `${item.color}28` : "var(--border-soft)", color: format === item.id ? item.color : "var(--text-muted)" }}>{item.icon} {item.label} ({count})</button>
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-soft bg-card-theme p-10 text-center">
            <FolderOpen size={28} className="text-muted2 mx-auto" />
            <p className="text-main font-bold mt-3">No hay proyectos para mostrar</p>
            <p className="text-muted2 text-sm mt-1">Genera un material nuevo para que aparezca automáticamente en esta biblioteca.</p>
            <Link href="/creator-hub/materials" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white mt-4" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}><WandSparkles size={14} /> Crear material</Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((project) => {
              const meta = getCreatorHubFormat(project.format)
              return (
                <article key={project.id} className="rounded-3xl border border-soft bg-card-theme p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl" style={{ background: `${meta?.color || "#64748b"}14`, border: `1px solid ${meta?.color || "#64748b"}24` }}>{meta?.icon || "📄"}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-main text-sm font-bold truncate">{project.title}</p>
                      <p className="text-muted2 text-[11px] mt-1">{meta?.label || project.format}</p>
                      <p className="text-muted2 text-[10px] mt-0.5">{new Date(project.createdAt).toLocaleString("es-CL")}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Link href={`/creator-hub/${project.format}`} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{ background: meta?.color || "#2563eb" }}>Nueva versión</Link>
                    <button onClick={() => copyProject(project)} className="w-8 h-8 rounded-xl border border-soft flex items-center justify-center text-muted2 hover:text-main" title="Copiar JSON"><Copy size={13} /></button>
                    <button onClick={() => duplicateCreatorHubProject(project.id)} className="w-8 h-8 rounded-xl border border-soft flex items-center justify-center text-muted2 hover:text-main" title="Duplicar"><span className="text-xs">＋</span></button>
                    <button onClick={() => downloadCreatorHubProject(project)} className="w-8 h-8 rounded-xl border border-soft flex items-center justify-center text-muted2 hover:text-main" title="Descargar respaldo"><Download size={13} /></button>
                    <button onClick={() => removeCreatorHubProject(project.id)} className="w-8 h-8 rounded-xl border border-soft flex items-center justify-center text-muted2 hover:text-red-500" title="Eliminar"><Trash2 size={13} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
