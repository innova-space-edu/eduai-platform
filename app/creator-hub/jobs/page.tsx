"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FolderPlus,
  LoaderCircle,
  PauseCircle,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react"
import { getCreatorHubFormat } from "@/components/creator-hub/catalog"
import { saveCreatorHubProject } from "@/components/creator-hub/project-store"

type Job = {
  id: string
  type: string
  title: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  progress: number
  stage?: string | null
  result?: any
  error?: string | null
  project_id?: string | null
  attempts: number
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

const STATUS = {
  queued: { label: "En cola", icon: Clock3, color: "#64748b" },
  running: { label: "Procesando", icon: LoaderCircle, color: "#2563eb" },
  completed: { label: "Completado", icon: CheckCircle2, color: "#16a34a" },
  failed: { label: "Falló", icon: XCircle, color: "#dc2626" },
  cancelled: { label: "Cancelado", icon: PauseCircle, color: "#d97706" },
} as const

function inferMaterial(job: Job) {
  const result = job.result
  if (!result) return null
  if (job.type === "source-studio" && result.data) return { format: "report", data: result.data }
  if (job.type === "comic-storyboard" && result.storyboard) return { format: "comic", data: result.storyboard }
  if (result.output?.data) return { format: result.output.format || result.outputFormat || result.format || "report", data: result.output.data }
  return null
}

function materialTitle(data: any, fallback: string) {
  return data?.title || data?.headline || data?.centralTopic || data?.topic || fallback
}

export default function CreatorHubJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("all")
  const [imported, setImported] = useState<Record<string, string>>({})

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/creator/jobs", { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No fue posible cargar los trabajos.")
      setJobs(payload.jobs || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cargar los trabajos.")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true)
    }, 5_000)
    return () => window.clearInterval(interval)
  }, [load])

  const visible = useMemo(() => filter === "all" ? jobs : jobs.filter((job) => job.status === filter), [filter, jobs])
  const activeCount = jobs.filter((job) => job.status === "queued" || job.status === "running").length

  const cancel = async (id: string) => {
    await fetch("/api/creator/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", id }),
    })
    void load(true)
  }

  const remove = async (id: string) => {
    await fetch(`/api/creator/jobs?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    setJobs((current) => current.filter((job) => job.id !== id))
  }

  const saveResult = (job: Job) => {
    const material = inferMaterial(job)
    if (!material) return
    const meta = getCreatorHubFormat(material.format)
    const project = saveCreatorHubProject({
      format: material.format,
      title: materialTitle(material.data, meta?.label || job.title),
      data: material.data,
      accentColor: material.data?._design?.palette?.primary || meta?.color || "#7c3aed",
      designTemplateId: material.data?._design?.id,
    })
    if (project) setImported((current) => ({ ...current, [job.id]: project.id }))
  }

  const downloadResult = (job: Job) => {
    const blob = new Blob([JSON.stringify(job.result, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${job.title || "creator-job"}.json`.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase()
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 800)
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-4 sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600"><Clock3 size={14} /> Centro de trabajos</div><h1 className="mt-2 text-xl font-bold text-main sm:text-2xl">Generaciones persistentes</h1><p className="mt-1 text-sm text-muted2">Revisa tareas largas, su avance, resultados y errores sin perder el proceso al cambiar de página.</p></div>
            <button type="button" onClick={() => void load()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-soft text-muted2 hover:text-main" title="Actualizar"><RefreshCw size={15} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7 sm:px-7">
        <div className="mb-5 flex flex-col gap-3 rounded-3xl border border-soft bg-card-theme p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-bold text-main">{activeCount ? `${activeCount} trabajos activos` : "No hay trabajos activos"}</p><p className="mt-1 text-xs text-muted2">El centro se actualiza automáticamente cada 5 segundos mientras esta pestaña está visible.</p></div>
          <div className="flex flex-wrap gap-2">{["all", "queued", "running", "completed", "failed", "cancelled"].map((status) => <button key={status} type="button" onClick={() => setFilter(status)} className="rounded-full border px-3 py-1.5 text-[10px] font-bold" style={{ background: filter === status ? "rgba(37,99,235,0.10)" : "var(--bg-card-soft)", borderColor: filter === status ? "rgba(37,99,235,0.30)" : "var(--border-soft)", color: filter === status ? "#2563eb" : "var(--text-muted)" }}>{status === "all" ? `Todos (${jobs.length})` : STATUS[status as keyof typeof STATUS].label}</button>)}</div>
        </div>

        {error && <div className="mb-5 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs leading-5 text-red-500"><AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{error}</div>}

        {loading ? <div className="flex min-h-72 items-center justify-center"><LoaderCircle size={32} className="animate-spin text-blue-600" /></div> : visible.length === 0 ? <div className="rounded-3xl border border-dashed border-soft bg-card-theme p-12 text-center"><Clock3 size={32} className="mx-auto text-muted2" /><p className="mt-3 text-sm font-bold text-main">No hay trabajos para mostrar</p><p className="mt-1 text-xs text-muted2">Las próximas tareas largas aparecerán aquí cuando se envíen al centro de trabajos.</p></div> : <div className="space-y-3">{visible.map((job) => { const status = STATUS[job.status]; const Icon = status.icon; const material = inferMaterial(job); const projectId = imported[job.id]; return <article key={job.id} className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: `${status.color}12`, color: status.color }}>{job.status === "running" ? <Icon size={19} className="animate-spin" /> : <Icon size={19} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-bold text-main">{job.title}</h2><span className="rounded-full px-2.5 py-1 text-[9px] font-black uppercase" style={{ background: `${status.color}12`, color: status.color }}>{status.label}</span><span className="text-[9px] uppercase tracking-wider text-muted2">{job.type}</span></div><p className="mt-1 text-xs text-muted2">{job.stage || "Sin etapa"} · creado {new Date(job.created_at).toLocaleString("es-CL")}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-card-soft-theme"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, job.progress || 0)}%`, background: status.color }} /></div><div className="mt-1 flex items-center justify-between text-[9px] font-bold text-muted2"><span>{job.progress || 0}%</span>{job.completed_at && <span>Finalizó {new Date(job.completed_at).toLocaleString("es-CL")}</span>}</div>{job.error && <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[10px] leading-5 text-red-500">{job.error}</div>}</div><div className="flex flex-wrap gap-2 sm:max-w-[250px] sm:justify-end">{(job.status === "queued" || job.status === "running") && <button type="button" onClick={() => void cancel(job.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] font-bold text-amber-700"><PauseCircle size={12} /> Cancelar</button>}{job.status === "completed" && job.result && <button type="button" onClick={() => downloadResult(job)} className="inline-flex items-center gap-1.5 rounded-xl border border-soft px-3 py-2 text-[10px] font-bold text-sub"><Download size={12} /> JSON</button>}{job.status === "completed" && material && !projectId && <button type="button" onClick={() => saveResult(job)} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-bold text-white"><FolderPlus size={12} /> Guardar proyecto</button>}{projectId && <Link href={`/creator-hub/projects/${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white"><CheckCircle2 size={12} /> Abrir proyecto</Link>}{!["queued", "running"].includes(job.status) && <button type="button" onClick={() => void remove(job.id)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-500/20 text-red-500" title="Eliminar"><Trash2 size={12} /></button>}</div></div></article> })}</div>}
      </main>
    </div>
  )
}
