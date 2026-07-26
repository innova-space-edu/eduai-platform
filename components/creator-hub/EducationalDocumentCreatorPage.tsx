"use client"

import { useCallback, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, FolderOpen, LoaderCircle, RotateCcw, Sparkles, Upload, WandSparkles } from "lucide-react"
import UniversalLayerEditor, { prepareVisibleCreatorData } from "@/components/creator-hub/UniversalLayerEditor"
import EducationalDocumentPreview from "@/components/creator-hub/EducationalDocumentPreview"
import EducationalDocumentDownloadBar from "@/components/creator-hub/EducationalDocumentDownloadBar"
import CreatorHubUtilityBar from "@/components/creator-hub/CreatorHubUtilityBar"
import ColorPalette from "@/components/ui/ColorPalette"
import TemplatePicker from "@/components/design/TemplatePicker"
import { getCreatorHubFormat } from "@/components/creator-hub/catalog"
import { getDefaultDesignTemplateId } from "@/lib/design-templates/registry"
import { saveCreatorHubProject, updateCreatorHubProject } from "@/components/creator-hub/project-store"
import type { EducationalFormat } from "@/app/api/creator/educational-document/route"

const SOURCES = [
  { id: "topic", icon: "💡", label: "Tema", description: "Describe el material" },
  { id: "text", icon: "📝", label: "Texto", description: "Pega contenido" },
  { id: "url", icon: "🔗", label: "URL", description: "Página web" },
  { id: "pdf", icon: "📄", label: "PDF", description: "Documento PDF" },
  { id: "docx", icon: "📎", label: "DOCX", description: "Archivo Word" },
] as const

type SourceType = (typeof SOURCES)[number]["id"]
type Step = "input" | "processing" | "result"

function titleFromData(data: any, fallback: string) {
  return data?.title || data?.sourceAssessment || fallback
}

export default function EducationalDocumentCreatorPage({ format }: { format: EducationalFormat }) {
  const meta = getCreatorHubFormat(format)
  const [sourceType, setSourceType] = useState<SourceType>("topic")
  const [content, setContent] = useState("")
  const [fileName, setFileName] = useState("")
  const [accentColor, setAccentColor] = useState(meta?.color || "#2563eb")
  const [designTemplateId, setDesignTemplateId] = useState(() => getDefaultDesignTemplateId(format))
  const [step, setStep] = useState<Step>("input")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")
  const [projectId, setProjectId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setContent(String(reader.result || "").split(",")[1] || "")
    reader.readAsDataURL(file)
  }, [])

  const reset = () => {
    setSourceType("topic")
    setContent("")
    setFileName("")
    setStep("input")
    setLoading(false)
    setResult(null)
    setError("")
    setProjectId(null)
    setSaved(false)
    setAccentColor(meta?.color || "#2563eb")
    setDesignTemplateId(getDefaultDesignTemplateId(format))
    if (fileRef.current) fileRef.current.value = ""
  }

  const persist = (next: any, nextAccent = accentColor, nextTemplate = designTemplateId) => {
    setResult(next)
    if (!projectId) return
    const updated = updateCreatorHubProject(projectId, {
      title: titleFromData(next, meta?.label || "Documento"),
      data: next,
      accentColor: nextAccent,
      designTemplateId: nextTemplate,
    })
    setSaved(Boolean(updated))
  }

  const changeColor = (color: string) => {
    setAccentColor(color)
    if (!result) return
    const next = {
      ...result,
      _design: {
        ...(result._design || {}),
        palette: { ...(result._design?.palette || {}), primary: color, accent: color },
      },
    }
    persist(next, color, designTemplateId)
  }

  const changeTemplate = (templateId: string, nextAccent?: string) => {
    setDesignTemplateId(templateId)
    const color = nextAccent || accentColor
    if (nextAccent) setAccentColor(nextAccent)
    if (!result) return
    const next = {
      ...result,
      _design: {
        ...(result._design || {}),
        id: templateId,
        palette: { ...(result._design?.palette || {}), primary: color, accent: color },
      },
    }
    persist(next, color, templateId)
  }

  const generate = async () => {
    if (!content.trim()) return
    setLoading(true)
    setError("")
    setSaved(false)
    setStep("processing")
    try {
      const response = await fetch("/api/creator/educational-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, sourceType, content, fileName, designTemplateId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.output?.data) throw new Error(payload?.error || "No fue posible generar el documento.")
      const generated = payload.output.data
      const generatedColor = generated?._design?.palette?.primary || accentColor
      setAccentColor(generatedColor)
      setResult(generated)
      setStep("result")
      const project = saveCreatorHubProject({
        format,
        title: titleFromData(generated, meta?.label || "Documento"),
        data: generated,
        accentColor: generatedColor,
        designTemplateId,
      })
      setProjectId(project?.id || null)
      setSaved(Boolean(project))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ocurrió un error inesperado.")
      setStep("input")
    } finally {
      setLoading(false)
    }
  }

  if (!meta) return null
  const visibleData = prepareVisibleCreatorData(result)
  const currentTitle = titleFromData(result, meta.label)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-5 py-3.5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3"><Link href="/creator-hub/materials" className="flex h-9 w-9 items-center justify-center rounded-xl border border-soft text-muted2 hover:text-main"><ArrowLeft size={15} /></Link><div className="flex h-10 w-10 items-center justify-center rounded-2xl text-xl" style={{ background: `${accentColor}16`, border: `1px solid ${accentColor}2c` }}>{meta.icon}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-main sm:text-base">{meta.label} editable</p><p className="hidden text-[11px] text-muted2 sm:block">Genera, edita por capas, revisa y exporta.</p></div></div>
          <div className="flex items-center gap-2">{saved && <span className="hidden items-center gap-1.5 text-[10px] font-bold text-emerald-600 sm:flex"><CheckCircle2 size={12} /> Guardado</span>}{step !== "input" && <button type="button" onClick={reset} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-soft px-3 py-2 text-xs font-bold text-muted2"><RotateCcw size={13} /> Nueva creación</button>}</div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1700px] items-start gap-5 px-5 py-6 sm:px-7 xl:grid-cols-[470px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-[82px] xl:max-h-[calc(100vh-96px)] xl:overflow-y-auto xl:pr-1">
          {step !== "result" ? <>
            <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
              <div className="flex items-center gap-2"><WandSparkles size={15} style={{ color: accentColor }} /><h2 className="text-sm font-bold text-main">Configura el documento</h2></div>
              <p className="mt-1.5 text-xs leading-5 text-muted2">Selecciona una fuente. La primera versión se convertirá en bloques editables.</p>
              <div className="mt-5"><p className="text-[10px] font-black uppercase tracking-wider text-muted2">1. Fuente</p><div className="mt-2 grid grid-cols-2 gap-2">{SOURCES.map((source) => { const active = sourceType === source.id; return <button key={source.id} type="button" onClick={() => { setSourceType(source.id); setContent(""); setFileName(""); setError(""); if (fileRef.current) fileRef.current.value = "" }} className="rounded-2xl border p-2.5 text-left" style={{ background: active ? `${accentColor}0f` : "var(--bg-card-soft)", borderColor: active ? `${accentColor}45` : "var(--border-soft)" }}><span className="text-base">{source.icon}</span><p className="mt-1 text-xs font-bold" style={{ color: active ? accentColor : "var(--text-secondary)" }}>{source.label}</p><p className="mt-0.5 text-[10px] text-muted2">{source.description}</p></button> })}</div></div>
              <div className="mt-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted2">2. Contenido</p>{["topic", "text", "url"].includes(sourceType) ? <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={sourceType === "text" ? 10 : 6} placeholder={sourceType === "url" ? "https://ejemplo.com/fuente" : meta.placeholder} className="mt-2 w-full resize-y rounded-2xl border border-soft bg-card-soft-theme px-3.5 py-3 text-sm text-main outline-none" /> : <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 w-full rounded-2xl border-2 border-dashed border-soft bg-card-soft-theme p-6 text-center"><Upload size={24} className="mx-auto text-muted2" /><span className="mt-2 block text-xs font-bold text-sub">{fileName || `Subir archivo .${sourceType}`}</span><input ref={fileRef} type="file" accept={sourceType === "pdf" ? ".pdf" : ".doc,.docx"} onChange={handleFile} className="hidden" /></button>}</div>
              {error && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-500">{error}</div>}
            </section>
            <section className="space-y-5 rounded-3xl border border-soft bg-card-theme p-4 sm:p-5"><TemplatePicker format={format} value={designTemplateId} onChange={changeTemplate} compact /><ColorPalette value={accentColor} onChange={changeColor} /></section>
            <button type="button" onClick={generate} disabled={loading || !content.trim()} className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white disabled:opacity-35" style={{ background: `linear-gradient(135deg,${accentColor},#7c3aed)` }}>{loading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}{loading ? "Generando documento..." : `Generar ${meta.label}`}</button>
          </> : <>
            <section className="rounded-3xl border border-soft bg-card-theme p-4"><p className="text-[10px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Edición por capas</p><h2 className="mt-1 text-sm font-bold text-main">Modifica todo el contenido</h2><p className="mb-4 mt-1 text-xs leading-5 text-muted2">Oculta, bloquea, duplica, elimina o reordena cualquier bloque antes de exportar.</p><UniversalLayerEditor data={result} onChange={persist} /></section>
            <section className="space-y-5 rounded-3xl border border-soft bg-card-theme p-4"><TemplatePicker format={format} value={designTemplateId} onChange={changeTemplate} compact /><ColorPalette value={accentColor} onChange={changeColor} /></section>
          </>}
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-main">Vista imprimible</p><p className="mt-0.5 text-[11px] text-muted2">Las capas ocultas no aparecen en la exportación.</p></div><span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: `${accentColor}12`, color: accentColor }}>{meta.icon} {meta.label}</span></div>
            {step === "input" && <div className="flex min-h-[680px] flex-col items-center justify-center px-6 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-[28px] text-4xl" style={{ background: `${accentColor}12` }}>{meta.icon}</div><h2 className="mt-5 text-lg font-bold text-main">Crea un documento educativo completo</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted2">El resultado incluirá estructura pedagógica, vista para imprimir y editor universal por capas.</p></div>}
            {step === "processing" && <div className="flex min-h-[680px] flex-col items-center justify-center px-6 text-center"><LoaderCircle size={42} className="animate-spin" style={{ color: accentColor }} /><h2 className="mt-5 text-lg font-bold text-main">Preparando el documento...</h2><p className="mt-2 text-sm text-muted2">Organizando objetivos, actividades, evidencias y criterios.</p></div>}
            {step === "result" && result && <><div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3"><CheckCircle2 size={16} className="text-emerald-600" /><div className="flex-1"><p className="text-xs font-bold text-emerald-700">Documento listo para editar</p><p className="text-[10px] text-emerald-700/70">Los cambios se guardan automáticamente.</p></div><Link href="/creator-hub/projects" className="flex items-center gap-1 text-[10px] font-bold text-emerald-700"><FolderOpen size={12} /> Mis proyectos</Link></div><div id="creator-result-container" className="overflow-auto rounded-2xl border border-soft bg-card-soft-theme p-3 sm:p-5"><EducationalDocumentPreview format={format} data={visibleData} accentColor={accentColor} /></div></>}
          </div>
          {step === "result" && result && <><EducationalDocumentDownloadBar title={currentTitle} /><CreatorHubUtilityBar format={format} data={visibleData} accentColor={accentColor} designTemplateId={designTemplateId} title={currentTitle} /></>}
        </section>
      </main>
    </div>
  )
}
