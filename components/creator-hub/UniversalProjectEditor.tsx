"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  History,
  LoaderCircle,
  Redo2,
  Save,
  Undo2,
} from "lucide-react"
import UniversalLayerEditor, { prepareVisibleCreatorData } from "@/components/creator-hub/UniversalLayerEditor"
import CreatorHubUtilityBar from "@/components/creator-hub/CreatorHubUtilityBar"
import VideoSummaryRenderer from "@/components/creator-hub/VideoSummaryRenderer"
import ColorPalette from "@/components/ui/ColorPalette"
import TemplatePicker from "@/components/design/TemplatePicker"
import { RENDERERS } from "@/components/creator-hub/renderers"
import { getCreatorHubFormat } from "@/components/creator-hub/catalog"
import {
  loadCloudCreatorHubProject,
  saveCreatorHubProjectVersion,
  updateCreatorHubProject,
  type CreatorHubProject,
} from "@/components/creator-hub/project-store"

function clone<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

function titleFromData(data: any, fallback: string) {
  const candidates = [data?.title, data?.headline, data?.deckTitle, data?.centralTopic, data?.topic, data?.subject]
  return candidates.find((value) => typeof value === "string" && value.trim()) || fallback
}

function ComicPreview({ data, accentColor }: { data: any; accentColor: string }) {
  const panels = Array.isArray(data?.panels) ? data.panels.filter((panel: any) => panel?.hidden !== true) : []
  return (
    <article className="rounded-3xl border border-soft bg-white p-5 text-slate-900">
      <header className="mb-5 border-b border-slate-200 pb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: accentColor }}>Historieta educativa</p>
        <h1 className="mt-2 text-2xl font-black">{data?.title || "Historieta"}</h1>
        {data?.summary && <p className="mt-2 text-sm leading-6 text-slate-600">{data.summary}</p>}
      </header>
      <div className={`grid gap-4 ${data?.style === "webtoon" ? "grid-cols-1" : "md:grid-cols-2"}`}>
        {panels.map((panel: any, index: number) => (
          <section key={panel.id || index} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className={`relative flex items-center justify-center overflow-hidden bg-white ${data?.style === "webtoon" ? "aspect-[2/3]" : "aspect-[4/3]"}`}>
              {panel.imageUrl ? <img src={panel.imageUrl} alt={panel.title || `Viñeta ${index + 1}`} className="h-full w-full object-cover" /> : <div className="px-5 text-center text-xs text-slate-400">Imagen pendiente</div>}
              {panel.dialogue && <div className="absolute left-3 top-3 max-w-[74%] rounded-2xl rounded-tl-sm border border-black/10 bg-white/95 px-3 py-2 text-[11px] font-semibold leading-4 shadow-lg">{panel.dialogue}</div>}
            </div>
            <div className="p-3"><p className="text-xs font-black" style={{ color: accentColor }}>{index + 1}. {panel.title || "Viñeta"}</p><p className="mt-1 text-[11px] leading-5 text-slate-600">{panel.scene}</p></div>
          </section>
        ))}
      </div>
    </article>
  )
}

function DataTablePreview({ data, accentColor }: { data: any; accentColor: string }) {
  const columns = Array.isArray(data?.columns) ? data.columns : []
  const rows = Array.isArray(data?.rows) ? data.rows.filter((row: any) => row?.hidden !== true) : []
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900">
      <header className="border-b border-slate-200 px-6 py-5"><p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accentColor }}>Tabla editable</p><h1 className="mt-1 text-xl font-black">{data?.title || "Tabla de datos"}</h1>{data?.description && <p className="mt-2 text-xs leading-5 text-slate-500">{data.description}</p>}</header>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-left text-xs"><thead><tr>{columns.map((column: any, index: number) => <th key={column.id || index} className="border-b border-slate-200 px-4 py-3 font-black" style={{ color: accentColor }}>{column.label || `Columna ${index + 1}`}</th>)}</tr></thead><tbody>{rows.map((row: any, rowIndex: number) => <tr key={row.id || rowIndex} className={rowIndex % 2 ? "bg-slate-50" : "bg-white"}>{(row.values || []).map((value: any, valueIndex: number) => <td key={valueIndex} className="border-b border-slate-100 px-4 py-3 text-slate-600">{String(value ?? "")}</td>)}</tr>)}</tbody></table></div>
    </article>
  )
}

function ProjectPreview({ format, data, accentColor }: { format: string; data: any; accentColor: string }) {
  if (format === "comic") return <ComicPreview data={data} accentColor={accentColor} />
  if (format === "data-table") return <DataTablePreview data={data} accentColor={accentColor} />
  if (format === "video-summary") return <VideoSummaryRenderer data={data} />
  const Renderer = RENDERERS[format]
  if (Renderer) return <Renderer data={data} />
  return <pre className="max-h-[760px] overflow-auto rounded-2xl border border-soft bg-card-soft-theme p-4 text-xs leading-5 text-sub">{JSON.stringify(data, null, 2)}</pre>
}

export default function UniversalProjectEditor() {
  const params = useParams()
  const projectId = String(params?.id || "")
  const [project, setProject] = useState<CreatorHubProject | null>(null)
  const [data, setData] = useState<any>(null)
  const [accentColor, setAccentColor] = useState("#7c3aed")
  const [designTemplateId, setDesignTemplateId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [versioning, setVersioning] = useState(false)
  const [past, setPast] = useState<any[]>([])
  const [future, setFuture] = useState<any[]>([])
  const pendingBaseRef = useRef<any>(null)
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    void loadCloudCreatorHubProject(projectId).then((loaded) => {
      if (!active) return
      if (!loaded) {
        setError("No se encontró el proyecto. Puede haber sido eliminado o pertenecer a otra sesión.")
        setLoading(false)
        return
      }
      setProject(loaded)
      setData(clone(loaded.data))
      setAccentColor(loaded.accentColor || "#7c3aed")
      setDesignTemplateId(loaded.designTemplateId || "")
      setSaved(true)
      setLoading(false)
    })
    return () => {
      active = false
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current)
    }
  }, [projectId])

  const commitHistory = () => {
    if (!pendingBaseRef.current) return
    const base = pendingBaseRef.current
    pendingBaseRef.current = null
    setPast((current) => [...current.slice(-49), base])
    setFuture([])
  }

  const persist = (nextData: any, options?: { accent?: string; template?: string; record?: boolean }) => {
    const record = options?.record !== false
    if (record && data) {
      if (!pendingBaseRef.current) pendingBaseRef.current = clone(data)
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current)
      historyTimerRef.current = setTimeout(commitHistory, 800)
    }

    const nextAccent = options?.accent || accentColor
    const nextTemplate = options?.template ?? designTemplateId
    setData(nextData)
    setSaved(false)
    const updated = updateCreatorHubProject(projectId, {
      title: titleFromData(nextData, project?.title || "Material"),
      data: nextData,
      accentColor: nextAccent,
      designTemplateId: nextTemplate,
    })
    if (updated) {
      setProject(updated)
      window.setTimeout(() => setSaved(true), 950)
    }
  }

  const undo = () => {
    if (!data) return
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current)
    const stack = pendingBaseRef.current ? [...past, pendingBaseRef.current] : past
    pendingBaseRef.current = null
    const previous = stack[stack.length - 1]
    if (!previous) return
    setPast(stack.slice(0, -1))
    setFuture((current) => [clone(data), ...current].slice(0, 50))
    persist(clone(previous), { record: false })
  }

  const redo = () => {
    if (!data || future.length === 0) return
    const [next, ...rest] = future
    setPast((current) => [...current, clone(data)].slice(-50))
    setFuture(rest)
    persist(clone(next), { record: false })
  }

  const changeAccent = (color: string) => {
    if (!data) return
    setAccentColor(color)
    const next = {
      ...data,
      _design: {
        ...(data._design || {}),
        palette: { ...(data._design?.palette || {}), primary: color, accent: color },
      },
    }
    persist(next, { accent: color })
  }

  const changeTemplate = (templateId: string, nextAccent?: string) => {
    if (!data) return
    const color = nextAccent || accentColor
    setDesignTemplateId(templateId)
    if (nextAccent) setAccentColor(nextAccent)
    const next = {
      ...data,
      _design: {
        ...(data._design || {}),
        id: templateId,
        templateId,
        palette: { ...(data._design?.palette || {}), primary: color, accent: color },
      },
    }
    persist(next, { accent: color, template: templateId })
  }

  const saveVersion = async () => {
    commitHistory()
    setVersioning(true)
    const updated = await saveCreatorHubProjectVersion(projectId, `Versión manual de ${new Date().toLocaleString("es-CL")}`)
    if (updated) setProject(updated)
    setVersioning(false)
  }

  const visibleData = useMemo(() => prepareVisibleCreatorData(data), [data])
  const meta = project ? getCreatorHubFormat(project.format) : null
  const specializedFormats = new Set(["infographic", "ppt", "data-table", "comic"])
  const specializedHref = project?.format === "comic"
    ? `/creator-hub/comics?project=${encodeURIComponent(projectId)}`
    : `/creator-hub/${project?.format}?project=${encodeURIComponent(projectId)}`

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center"><LoaderCircle size={34} className="animate-spin text-violet-500" /></div>
  if (error || !project || !data) return <div className="mx-auto max-w-xl px-6 py-20 text-center"><p className="text-lg font-bold text-main">No fue posible abrir el proyecto</p><p className="mt-2 text-sm leading-6 text-muted2">{error}</p><Link href="/creator-hub/projects" className="mt-5 inline-flex rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white">Volver a Mis proyectos</Link></div>

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-5 py-3.5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/creator-hub/projects" className="flex h-9 w-9 items-center justify-center rounded-xl border border-soft text-muted2 hover:text-main"><ArrowLeft size={15} /></Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-xl" style={{ background: `${accentColor}16`, border: `1px solid ${accentColor}2c` }}>{meta?.icon || "✦"}</div>
            <div className="min-w-0"><p className="truncate text-sm font-bold text-main sm:text-base">{titleFromData(data, project.title)}</p><p className="hidden text-[11px] text-muted2 sm:block">Editor universal por capas · {meta?.label || project.format} · versión {project.currentVersion || 1}</p></div>
          </div>
          <div className="flex items-center gap-1.5">
            {saved && <span className="hidden items-center gap-1 text-[10px] font-bold text-emerald-600 lg:flex"><CheckCircle2 size={12} /> Guardado</span>}
            <button type="button" onClick={undo} disabled={past.length === 0 && !pendingBaseRef.current} className="flex h-9 w-9 items-center justify-center rounded-xl border border-soft text-muted2 disabled:opacity-25" title="Deshacer"><Undo2 size={14} /></button>
            <button type="button" onClick={redo} disabled={future.length === 0} className="flex h-9 w-9 items-center justify-center rounded-xl border border-soft text-muted2 disabled:opacity-25" title="Rehacer"><Redo2 size={14} /></button>
            <button type="button" onClick={saveVersion} disabled={versioning} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-soft px-3 text-[10px] font-bold text-sub disabled:opacity-40">{versioning ? <LoaderCircle size={12} className="animate-spin" /> : <History size={12} />} Guardar versión</button>
            {specializedFormats.has(project.format) && <Link href={specializedHref} className="hidden h-9 items-center gap-1.5 rounded-xl px-3 text-[10px] font-bold text-white sm:inline-flex" style={{ background: accentColor }}><ExternalLink size={12} /> Editor especializado</Link>}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1700px] items-start gap-5 px-5 py-6 sm:px-7 xl:grid-cols-[470px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-[82px] xl:max-h-[calc(100vh-96px)] xl:overflow-y-auto xl:pr-1">
          <section className="rounded-3xl border border-soft bg-card-theme p-4"><UniversalLayerEditor data={data} onChange={persist} /></section>
          <section className="space-y-5 rounded-3xl border border-soft bg-card-theme p-4"><TemplatePicker format={project.format} value={designTemplateId} onChange={changeTemplate} compact /><ColorPalette value={accentColor} onChange={changeAccent} /></section>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-main">Vista final sin capas ocultas</p><p className="mt-0.5 text-[11px] text-muted2">La exportación usa exactamente esta versión visible.</p></div><span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: `${accentColor}12`, color: accentColor }}>{meta?.icon} {meta?.label || project.format}</span></div>
            <div id="creator-result-container" className="overflow-auto rounded-2xl border border-soft bg-card-soft-theme p-3 sm:p-5"><ProjectPreview format={project.format} data={visibleData} accentColor={accentColor} /></div>
          </div>
          <CreatorHubUtilityBar format={project.format} data={visibleData} accentColor={accentColor} designTemplateId={designTemplateId} title={titleFromData(data, project.title)} />
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs leading-5 text-emerald-700"><Save size={13} className="mr-1 inline" /> Los cambios se guardan localmente de inmediato y se sincronizan con Supabase cuando la migración de Creator Hub está instalada.</div>
        </section>
      </main>
    </div>
  )
}
