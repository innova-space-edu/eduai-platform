"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { Copy, Download, FolderOpen, History, LoaderCircle, Search, Trash2, Upload, WandSparkles, X } from "lucide-react"
import { CREATOR_HUB_FORMATS, getCreatorHubFormat } from "@/components/creator-hub/catalog"
import {
  downloadCreatorHubProject,
  duplicateCreatorHubProject,
  importCreatorHubProject,
  loadCloudCreatorHubProjects,
  loadCreatorHubProjects,
  removeCreatorHubProject,
  saveCreatorHubProjectVersion,
  type CreatorHubProject,
} from "@/components/creator-hub/project-store"

export default function CreatorHubProjectsPage() {
  const [projects, setProjects] = useState<CreatorHubProject[]>(() => loadCreatorHubProjects())
  const [query, setQuery] = useState("")
  const [format, setFormat] = useState("all")
  const [loading, setLoading] = useState(true)
  const [versioningId, setVersioningId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const importRef = useRef<HTMLInputElement>(null)

  const refreshLocal = () => setProjects(loadCreatorHubProjects())
  const refreshCloud = async () => {
    setLoading(true)
    setProjects(await loadCloudCreatorHubProjects())
    setLoading(false)
  }

  useEffect(() => {
    void refreshCloud()
    window.addEventListener("creator-hub-projects-updated", refreshLocal)
    window.addEventListener("storage", refreshLocal)
    return () => {
      window.removeEventListener("creator-hub-projects-updated", refreshLocal)
      window.removeEventListener("storage", refreshLocal)
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
    setMessage("Proyecto copiado como JSON.")
  }

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const value = JSON.parse(await file.text())
      const imported = importCreatorHubProject(value)
      if (!imported) throw new Error("El archivo no contiene un proyecto válido.")
      setMessage(`Proyecto “${imported.title}” importado.`)
      refreshLocal()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible importar el proyecto.")
    } finally {
      if (importRef.current) importRef.current.value = ""
    }
  }

  const saveVersion = async (project: CreatorHubProject) => {
    setVersioningId(project.id)
    const updated = await saveCreatorHubProjectVersion(project.id, "Versión manual guardada desde Mis proyectos")
    setMessage(updated ? `Versión ${updated.currentVersion || "nueva"} guardada.` : "La versión quedó local; falta aplicar la migración de Supabase para sincronizarla.")
    setVersioningId(null)
    refreshLocal()
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600"><FolderOpen size={14} /> Mis proyectos</div>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-xl font-bold text-main sm:text-2xl">Biblioteca sincronizada de Creator Hub</h1>
              <p className="mt-1 text-sm text-muted2">Reabre materiales, continúa editando, guarda versiones e importa respaldos JSON.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <button type="button" onClick={() => importRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-soft bg-card-theme px-4 py-2.5 text-xs font-bold text-sub hover:text-main"><Upload size={14} /> Importar proyecto</button>
              <input ref={importRef} type="file" accept="application/json,.json" onChange={importProject} className="hidden" />
              <div className="relative w-full lg:w-[340px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted2" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proyecto..." className="w-full rounded-xl border border-soft bg-card-theme py-2.5 pl-9 pr-9 text-sm text-main outline-none focus:border-blue-500/30" />
                {query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2 hover:text-main"><X size={14} /></button>}
              </div>
            </div>
          </div>
          {message && <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-600">{message}</div>}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-7 sm:py-9">
        <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
          <button type="button" onClick={() => setFormat("all")} className="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold" style={{ background: format === "all" ? "rgba(37,99,235,0.10)" : "var(--bg-card)", borderColor: format === "all" ? "rgba(37,99,235,0.24)" : "var(--border-soft)", color: format === "all" ? "#2563eb" : "var(--text-muted)" }}>Todos ({projects.length})</button>
          {CREATOR_HUB_FORMATS.map((item) => {
            const count = projects.filter((project) => project.format === item.id).length
            if (count === 0) return null
            return <button key={item.id} type="button" onClick={() => setFormat(item.id)} className="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold" style={{ background: format === item.id ? `${item.color}12` : "var(--bg-card)", borderColor: format === item.id ? `${item.color}28` : "var(--border-soft)", color: format === item.id ? item.color : "var(--text-muted)" }}>{item.icon} {item.label} ({count})</button>
          })}
        </div>

        {loading && projects.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center"><LoaderCircle size={30} className="animate-spin text-blue-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-soft bg-card-theme p-10 text-center">
            <FolderOpen size={28} className="mx-auto text-muted2" />
            <p className="mt-3 font-bold text-main">No hay proyectos para mostrar</p>
            <p className="mt-1 text-sm text-muted2">Genera un material nuevo para que aparezca automáticamente en esta biblioteca.</p>
            <Link href="/creator-hub/materials" className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}><WandSparkles size={14} /> Crear material</Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => {
              const meta = getCreatorHubFormat(project.format)
              return (
                <article key={project.id} className="rounded-3xl border border-soft bg-card-theme p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl" style={{ background: `${meta?.color || "#64748b"}14`, border: `1px solid ${meta?.color || "#64748b"}24` }}>{meta?.icon || "📄"}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-main">{project.title}</p>
                      <p className="mt-1 text-[11px] text-muted2">{meta?.label || project.format} · versión {project.currentVersion || 1}</p>
                      <p className="mt-0.5 text-[10px] text-muted2">Modificado {new Date(project.updatedAt).toLocaleString("es-CL")}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/creator-hub/${project.format}?project=${encodeURIComponent(project.id)}`} className="rounded-xl px-3 py-1.5 text-xs font-bold text-white" style={{ background: meta?.color || "#2563eb" }}>Continuar editando</Link>
                    <button type="button" onClick={() => saveVersion(project)} disabled={versioningId === project.id} className="flex h-8 items-center gap-1.5 rounded-xl border border-soft px-2.5 text-[10px] font-bold text-muted2 hover:text-main disabled:opacity-40" title="Guardar versión manual">{versioningId === project.id ? <LoaderCircle size={12} className="animate-spin" /> : <History size={12} />} Guardar versión</button>
                    <button type="button" onClick={() => copyProject(project)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-soft text-muted2 hover:text-main" title="Copiar JSON"><Copy size={13} /></button>
                    <button type="button" onClick={() => duplicateCreatorHubProject(project.id)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-soft text-muted2 hover:text-main" title="Duplicar"><span className="text-xs">＋</span></button>
                    <button type="button" onClick={() => downloadCreatorHubProject(project)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-soft text-muted2 hover:text-main" title="Descargar respaldo"><Download size={13} /></button>
                    <button type="button" onClick={() => removeCreatorHubProject(project.id)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-soft text-muted2 hover:text-red-500" title="Eliminar"><Trash2 size={13} /></button>
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
