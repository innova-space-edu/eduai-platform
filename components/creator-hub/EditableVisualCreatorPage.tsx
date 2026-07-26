"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, FolderOpen, Info, Layers3, LoaderCircle, RotateCcw, Sparkles, Upload, WandSparkles } from "lucide-react"
import { InfographicContentEditor, PresentationContentEditor } from "@/components/creator-hub/EditableVisualEditors"
import { EditableInfographicPreview, EditablePresentationSlidePreview } from "@/components/creator-hub/EditableVisualPreviews"
import CreatorHubUtilityBar from "@/components/creator-hub/CreatorHubUtilityBar"
import ColorPalette from "@/components/ui/ColorPalette"
import TemplatePicker from "@/components/design/TemplatePicker"
import { getDefaultDesignTemplateId } from "@/lib/design-templates/registry"
import { getCreatorHubFormat } from "@/components/creator-hub/catalog"
import { loadCloudCreatorHubProject, saveCreatorHubProject, updateCreatorHubProject } from "@/components/creator-hub/project-store"

const SOURCE_TYPES = [
  { id: "topic", icon: "💡", label: "Tema", description: "Describe lo que necesitas" },
  { id: "text", icon: "📝", label: "Texto", description: "Pega contenido completo" },
  { id: "url", icon: "🔗", label: "URL", description: "Procesa una página web" },
  { id: "pdf", icon: "📄", label: "PDF", description: "Carga un documento" },
  { id: "docx", icon: "📎", label: "DOCX", description: "Carga un archivo Word" },
] as const

type SourceType = (typeof SOURCE_TYPES)[number]["id"]
type VisualFormat = "infographic" | "ppt"
type Step = "input" | "processing" | "result"

type ApiResponse = {
  success?: boolean
  error?: string
  output?: { data?: any }
}

const CONFIG = {
  infographic: {
    editorTitle: "Edita la infografía por capas",
    editorDescription: "Cambia títulos, cifras, ideas e íconos; oculta, bloquea, duplica y reordena cada capa.",
    processing: ["Analizando la fuente", "Jerarquizando información", "Construyendo capas visuales"],
  },
  ppt: {
    editorTitle: "Edita la presentación por capas",
    editorDescription: "Cada diapositiva funciona como una capa principal editable antes de descargar el PPTX final.",
    processing: ["Analizando la fuente", "Diseñando la secuencia pedagógica", "Construyendo diapositivas editables"],
  },
} as const

function uid(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function projectTitle(format: VisualFormat, data: any, fallback: string) {
  if (format === "infographic") return data?.title || fallback
  return data?.title || data?.slides?.[0]?.title || fallback
}

function designPalette(data: any) {
  const palette = data?._design?.palette
  return {
    background: typeof palette?.background === "string" ? palette.background : undefined,
    primary: typeof palette?.primary === "string" ? palette.primary : undefined,
  }
}

function ensureLayerMetadata(format: VisualFormat, data: any) {
  if (!data || typeof data !== "object") return data
  if (format === "infographic") {
    return {
      ...data,
      sections: Array.isArray(data.sections)
        ? data.sections.map((section: any) => ({ id: section?.id || uid("layer"), hidden: section?.hidden === true, locked: section?.locked === true, ...section }))
        : [],
    }
  }
  return {
    ...data,
    slides: Array.isArray(data.slides)
      ? data.slides.map((slide: any) => ({ id: slide?.id || uid("slide"), hidden: slide?.hidden === true, locked: slide?.locked === true, ...slide }))
      : [],
  }
}

export default function EditableVisualCreatorPage({ format }: { format: VisualFormat }) {
  const meta = getCreatorHubFormat(format)
  const config = CONFIG[format]
  const searchParams = useSearchParams()
  const requestedProjectId = searchParams.get("project")
  const [sourceType, setSourceType] = useState<SourceType>("topic")
  const [content, setContent] = useState("")
  const [fileName, setFileName] = useState("")
  const [accentColor, setAccentColor] = useState(meta?.color || "#3b82f6")
  const [designTemplateId, setDesignTemplateId] = useState(() => getDefaultDesignTemplateId(format))
  const [step, setStep] = useState<Step>("input")
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [hydrating, setHydrating] = useState(Boolean(requestedProjectId))
  const fileRef = useRef<HTMLInputElement>(null)

  const slideCount = format === "ppt" && Array.isArray(result?.slides) ? result.slides.length : 0

  useEffect(() => {
    if (!requestedProjectId) {
      setHydrating(false)
      return
    }
    let active = true
    setHydrating(true)
    void loadCloudCreatorHubProject(requestedProjectId).then((project) => {
      if (!active) return
      if (!project || project.format !== format) {
        setError("No fue posible abrir este proyecto en el editor seleccionado.")
        setHydrating(false)
        return
      }
      setProjectId(project.id)
      setResult(ensureLayerMetadata(format, project.data))
      setAccentColor(project.accentColor || meta?.color || "#3b82f6")
      setDesignTemplateId(project.designTemplateId || getDefaultDesignTemplateId(format))
      setPreviewIndex(0)
      setSaved(true)
      setStep("result")
      setHydrating(false)
    })
    return () => { active = false }
  }, [format, meta?.color, requestedProjectId])

  useEffect(() => {
    if (format !== "ppt") return
    if (slideCount === 0) {
      setPreviewIndex(0)
      return
    }
    if (previewIndex >= slideCount) setPreviewIndex(slideCount - 1)
  }, [format, previewIndex, slideCount])

  const handleFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setContent(String(reader.result || "").split(",")[1] || "")
    reader.readAsDataURL(file)
  }, [])

  const persistResult = (next: any, nextAccent = accentColor, nextTemplate = designTemplateId) => {
    setResult(next)
    if (!projectId) return
    const updated = updateCreatorHubProject(projectId, {
      title: projectTitle(format, next, meta?.label || "Material"),
      data: next,
      accentColor: nextAccent,
      designTemplateId: nextTemplate,
    })
    setSaved(Boolean(updated))
  }

  const changeAccentColor = (color: string) => {
    setAccentColor(color)
    if (!result) return
    const next = {
      ...result,
      _design: {
        ...(result._design || {}),
        palette: {
          ...(result._design?.palette || {}),
          primary: color,
          accent: color,
        },
      },
    }
    persistResult(next, color, designTemplateId)
  }

  const changeTemplate = (templateId: string, nextAccentColor?: string) => {
    setDesignTemplateId(templateId)
    const nextColor = nextAccentColor || accentColor
    if (nextAccentColor) setAccentColor(nextAccentColor)
    if (!result) return
    const next = {
      ...result,
      _design: {
        ...(result._design || {}),
        id: templateId,
        palette: {
          ...(result._design?.palette || {}),
          primary: nextColor,
          accent: nextColor,
        },
      },
    }
    persistResult(next, nextColor, templateId)
  }

  const reset = () => {
    setSourceType("topic")
    setContent("")
    setFileName("")
    setStep("input")
    setResult(null)
    setError(null)
    setProjectId(null)
    setSaved(false)
    setPreviewIndex(0)
    setAccentColor(meta?.color || "#3b82f6")
    setDesignTemplateId(getDefaultDesignTemplateId(format))
    if (fileRef.current) fileRef.current.value = ""
  }

  const generate = async () => {
    if (!content.trim()) return
    setProcessing(true)
    setError(null)
    setSaved(false)
    setStep("processing")

    try {
      const response = await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, content, fileName, outputFormat: format, designTemplateId }),
      })
      const payload = await response.json() as ApiResponse
      if (!payload.success || !payload.output?.data) throw new Error(payload.error || "No fue posible generar el material")

      const generated = ensureLayerMetadata(format, payload.output.data)
      generated._design = {
        ...(generated._design || {}),
        palette: { ...(generated._design?.palette || {}), primary: accentColor, accent: accentColor },
      }
      setResult(generated)
      setPreviewIndex(0)
      setStep("result")

      const project = saveCreatorHubProject({
        format,
        title: projectTitle(format, generated, meta?.label || "Material"),
        data: generated,
        accentColor,
        designTemplateId,
      })
      setProjectId(project?.id || null)
      setSaved(Boolean(project))
    } catch (generationError: unknown) {
      setError(generationError instanceof Error ? generationError.message : "Ocurrió un error inesperado")
      setStep("input")
    } finally {
      setProcessing(false)
    }
  }

  if (!meta) return null
  const palette = designPalette(result)
  const Editor = format === "infographic" ? InfographicContentEditor : PresentationContentEditor

  if (hydrating) {
    return <div className="flex min-h-[70vh] items-center justify-center"><LoaderCircle size={34} className="animate-spin text-blue-500" /></div>
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3.5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/creator-hub/materials" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-soft text-muted2 transition hover:bg-card-soft-theme hover:text-main" title="Volver a materiales"><ArrowLeft size={15} /></Link>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: `${accentColor}16`, border: `1px solid ${accentColor}2c` }}>{meta.icon}</div>
            <div className="min-w-0"><p className="truncate text-sm font-bold text-main sm:text-base">{meta.label} editable por capas</p><p className="hidden truncate text-[11px] text-muted2 sm:block">Genera, modifica y exporta desde un mismo espacio.</p></div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {saved && <span className="hidden items-center gap-1.5 text-[11px] font-bold text-emerald-600 sm:flex"><CheckCircle2 size={13} /> Cambios guardados</span>}
            {(step === "result" || step === "processing") && <button type="button" onClick={reset} disabled={processing} className="inline-flex items-center gap-1.5 rounded-xl border border-soft px-3 py-2 text-xs font-bold text-muted2 transition hover:bg-card-soft-theme hover:text-main disabled:opacity-40"><RotateCcw size={13} /> Nueva creación</button>}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] items-start gap-5 px-5 py-6 sm:px-7 xl:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-[82px] xl:max-h-[calc(100vh-96px)] xl:overflow-y-auto xl:pr-1">
          {step !== "result" ? (
            <>
              <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
                <div className="flex items-center gap-2"><WandSparkles size={15} style={{ color: accentColor }} /><h2 className="text-sm font-bold text-main">Configura el material</h2></div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted2">Selecciona una fuente. Después de generar aparecerá aquí el editor de capas.</p>
                <div className="mt-5"><label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">1. Fuente</label><div className="mt-2 grid grid-cols-2 gap-2">{SOURCE_TYPES.map((source) => { const active = sourceType === source.id; return <button key={source.id} type="button" onClick={() => { setSourceType(source.id); setContent(""); setFileName(""); setError(null); if (fileRef.current) fileRef.current.value = "" }} className="rounded-2xl border p-2.5 text-left transition-all" style={{ background: active ? `${accentColor}10` : "var(--bg-card-soft)", borderColor: active ? `${accentColor}35` : "var(--border-soft)" }}><span className="block text-base">{source.icon}</span><span className="mt-1 block text-xs font-bold" style={{ color: active ? accentColor : "var(--text-secondary)" }}>{source.label}</span><span className="mt-0.5 block text-[10px] leading-tight text-muted2">{source.description}</span></button> })}</div></div>
                <div className="mt-4"><label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">2. Contenido</label>{sourceType === "topic" || sourceType === "text" || sourceType === "url" ? <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={sourceType === "text" ? 9 : 5} placeholder={sourceType === "topic" ? meta.placeholder : sourceType === "url" ? "https://ejemplo.com/articulo" : "Pega aquí el contenido que quieres transformar..."} className="mt-2 w-full resize-y rounded-2xl border border-soft bg-card-soft-theme px-3.5 py-3 text-sm text-main outline-none placeholder:text-muted2 focus:border-blue-500/30" /> : <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 w-full rounded-2xl border-2 border-dashed p-6 text-center" style={{ background: content ? "rgba(16,185,129,0.06)" : "var(--bg-card-soft)", borderColor: content ? "rgba(16,185,129,0.32)" : "var(--border-medium)" }}>{content ? <CheckCircle2 size={24} className="mx-auto text-emerald-500" /> : <Upload size={24} className="mx-auto text-muted2" />}<span className="mt-2 block text-xs font-bold text-sub">{content ? `${fileName} cargado` : `Subir archivo .${sourceType}`}</span><input ref={fileRef} type="file" accept={sourceType === "pdf" ? ".pdf" : ".docx,.doc"} onChange={handleFile} className="hidden" /></button>}</div>
                {error && <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/5 p-3 text-xs text-red-500">❌ {error}</div>}
              </section>
              <section className="space-y-5 rounded-3xl border border-soft bg-card-theme p-4 sm:p-5"><div><label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">3. Diseño visual</label><div className="mt-2"><TemplatePicker format={format} value={designTemplateId} onChange={changeTemplate} compact /></div></div><ColorPalette value={accentColor} onChange={changeAccentColor} /></section>
              <button type="button" onClick={generate} disabled={!content.trim() || processing} className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white disabled:opacity-35" style={{ background: `linear-gradient(135deg,${accentColor}cc,${accentColor})` }}>{processing ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}{processing ? "Generando capas editables..." : `Generar ${meta.label}`}</button>
            </>
          ) : (
            <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
              <div className="mb-4"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: accentColor }}><Layers3 size={12} /> Edición activa</p><h2 className="mt-1 text-base font-bold text-main">{config.editorTitle}</h2><p className="mt-1 text-xs leading-relaxed text-muted2">{config.editorDescription}</p></div>
              <Editor data={result} onChange={(next) => persistResult(next)} />
              <div className="mt-5 border-t border-soft pt-5"><TemplatePicker format={format} value={designTemplateId} onChange={changeTemplate} compact /><div className="mt-4"><ColorPalette value={accentColor} onChange={changeAccentColor} /></div></div>
            </section>
          )}
        </aside>

        <section className="min-w-0 overflow-hidden rounded-3xl border border-soft bg-card-theme">
          <div className="flex items-center justify-between gap-3 border-b border-soft px-4 py-3.5 sm:px-5"><div><p className="text-sm font-bold text-main">Vista de trabajo</p><p className="mt-0.5 text-[11px] text-muted2">La previsualización y las exportaciones usan la versión más reciente.</p></div><span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: `${accentColor}12`, color: accentColor }}>{meta.icon} {meta.label}</span></div>
          {step === "input" && <div className="flex min-h-[650px] flex-col items-center justify-center px-6 py-10 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-[28px] text-4xl" style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}22` }}>{meta.icon}</div><h2 className="mt-5 text-lg font-bold text-main">Crea una primera versión con IA</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted2">Después de generar se habilitará el editor por capas para cambiar el contenido y el diseño.</p><div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-3">{meta.highlights.map((highlight) => <div key={highlight} className="rounded-2xl border border-soft bg-card-soft-theme p-3 text-xs text-sub">✓ {highlight}</div>)}</div><div className="mt-5 flex max-w-2xl items-start gap-2 rounded-2xl border border-soft bg-card-soft-theme p-3.5 text-left"><Info size={15} className="mt-0.5 flex-shrink-0 text-blue-500" /><p className="text-xs leading-relaxed text-muted2">Los materiales guardados en Mis proyectos ahora pueden reabrirse con “Continuar editando”.</p></div></div>}
          {step === "processing" && <div className="flex min-h-[650px] flex-col items-center justify-center px-6 py-10 text-center"><div className="relative h-20 w-20"><div className="absolute inset-0 animate-spin rounded-full border-2 border-soft" style={{ borderTopColor: accentColor }} /><div className="absolute inset-0 flex items-center justify-center text-3xl">{meta.icon}</div></div><h2 className="mt-5 text-lg font-bold text-main">Preparando capas editables...</h2><div className="mt-5 flex flex-wrap justify-center gap-2">{config.processing.map((label) => <span key={label} className="animate-pulse rounded-full border border-soft px-3 py-1 text-[11px] text-muted2">{label}</span>)}</div></div>}
          {step === "result" && result && <div className="space-y-4 p-4 sm:p-5"><div className="flex flex-col gap-3 rounded-2xl border p-3.5 sm:flex-row sm:items-center" style={{ background: `${accentColor}08`, borderColor: `${accentColor}22` }}><CheckCircle2 size={18} style={{ color: accentColor }} /><div className="min-w-0 flex-1"><p className="text-sm font-bold" style={{ color: accentColor }}>{meta.label} lista para editar por capas</p><p className="mt-0.5 text-[11px] text-muted2">Usa el panel izquierdo para modificar, ocultar, bloquear y reordenar capas.</p></div><Link href="/creator-hub/projects" className="flex items-center gap-1.5 text-xs font-bold text-sub"><FolderOpen size={13} /> Ver proyectos</Link></div>{format === "ppt" && <div className="flex items-center justify-between rounded-2xl border border-soft bg-card-soft-theme px-3 py-2"><button type="button" onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))} disabled={previewIndex === 0} className="inline-flex items-center gap-1 rounded-xl border border-soft px-3 py-1.5 text-xs font-bold text-muted2 disabled:opacity-30"><ChevronLeft size={13} /> Anterior</button><div className="text-center"><p className="text-xs font-bold text-main">Diapositiva {previewIndex + 1}</p><p className="text-[10px] text-muted2">{slideCount} en total</p></div><button type="button" onClick={() => setPreviewIndex((index) => Math.min(slideCount - 1, index + 1))} disabled={previewIndex >= slideCount - 1} className="inline-flex items-center gap-1 rounded-xl border border-soft px-3 py-1.5 text-xs font-bold text-muted2 disabled:opacity-30">Siguiente <ChevronRight size={13} /></button></div>}<div id="creator-result-container" className="overflow-auto rounded-2xl border p-4 sm:p-5" style={{ background: palette.background || "var(--bg-card-soft)", borderColor: `${accentColor}33` }}>{format === "infographic" ? <EditableInfographicPreview data={result} accentColor={accentColor} /> : <EditablePresentationSlidePreview data={result} index={previewIndex} accentColor={accentColor} />}</div><CreatorHubUtilityBar format={format} data={result} accentColor={accentColor} designTemplateId={designTemplateId} title={projectTitle(format, result, meta.label)} /></div>}
        </section>
      </main>
    </div>
  )
}
