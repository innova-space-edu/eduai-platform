"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileInput,
  FolderOpen,
  LayoutTemplate,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from "lucide-react"
import { InfographicContentEditor, PresentationContentEditor } from "@/components/creator-hub/EditableVisualEditors"
import DirectVisualCanvasEditor from "@/components/creator-hub/DirectVisualCanvasEditor"
import CreatorHubUtilityBar from "@/components/creator-hub/CreatorHubUtilityBar"
import TemplatePicker, { type TemplatePickerSelection } from "@/components/design/TemplatePicker"
import { getCreatorHubFormat } from "@/components/creator-hub/catalog"
import { loadCloudCreatorHubProject, saveCreatorHubProject, updateCreatorHubProject } from "@/components/creator-hub/project-store"
import {
  applyCanvasAccent,
  applyCanvasTemplate,
  ensureVisualCanvasData,
  refreshVisualCanvasBindings,
  type CreatorTemplateReference,
} from "@/lib/creator-canvas"

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
type FloatingPanel = "content" | "template" | null

type ApiResponse = {
  success?: boolean
  error?: string
  output?: { data?: any }
}

function uid(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function projectTitle(format: VisualFormat, data: any, fallback: string) {
  return format === "infographic"
    ? data?.title || fallback
    : data?.title || data?.slides?.[0]?.title || fallback
}

function ensureLayerMetadata(format: VisualFormat, data: any) {
  if (!data || typeof data !== "object") return data
  if (format === "infographic") {
    return {
      ...data,
      sections: Array.isArray(data.sections)
        ? data.sections.map((section: any) => ({
            id: section?.id || uid("layer"),
            hidden: section?.hidden === true,
            locked: section?.locked === true,
            ...section,
          }))
        : [],
    }
  }
  return {
    ...data,
    slides: Array.isArray(data.slides)
      ? data.slides.map((slide: any) => ({
          id: slide?.id || uid("slide"),
          hidden: slide?.hidden === true,
          locked: slide?.locked === true,
          ...slide,
        }))
      : [],
  }
}

function toTemplateReference(template?: TemplatePickerSelection | null): CreatorTemplateReference | null {
  if (!template || template.kind === "blank") return null
  return {
    id: template.id,
    name: template.name,
    imageUrl: template.imageUrl,
    fileUrl: template.fileUrl,
    fileKind: template.fileKind,
    accentColor: template.accentColor,
    secondaryColor: template.secondaryColor,
    instructions: template.instructions,
  }
}

async function resolveCustomTemplate(templateId: string): Promise<TemplatePickerSelection | null> {
  if (!templateId.startsWith("custom:")) return null
  const response = await fetch("/api/creative-templates", { cache: "no-store" })
  if (!response.ok) return null
  const payload = await response.json().catch(() => ({}))
  const id = templateId.slice("custom:".length)
  const template = (payload?.templates || []).find((item: any) => item.id === id)
  if (!template) return null
  return {
    id: templateId,
    name: template.name || "Plantilla",
    kind: "custom",
    formats: template.formats,
    accentColor: template.accentColor,
    secondaryColor: template.secondaryColor,
    instructions: template.instructions,
    imageUrl: template.imageUrl,
    fileUrl: template.fileUrl,
    fileKind: template.fileKind,
    fileName: template.fileName,
  }
}

const headerButton = "inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-sub transition hover:text-main disabled:opacity-35"

export default function EditableVisualCreatorPage({ format }: { format: VisualFormat }) {
  const meta = getCreatorHubFormat(format)
  const searchParams = useSearchParams()
  const requestedProjectId = searchParams.get("project")
  const [sourceType, setSourceType] = useState<SourceType>("topic")
  const [content, setContent] = useState("")
  const [fileName, setFileName] = useState("")
  const [accentColor, setAccentColor] = useState("#334155")
  const [designTemplateId, setDesignTemplateId] = useState("blank")
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePickerSelection | null>(null)
  const [step, setStep] = useState<Step>("input")
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [hydrating, setHydrating] = useState(Boolean(requestedProjectId))
  const [panel, setPanel] = useState<FloatingPanel>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const slideCount = format === "ppt" && Array.isArray(result?.slides) ? result.slides.length : 0

  useEffect(() => {
    const hidden = step === "result"
    window.dispatchEvent(new CustomEvent("creator-hub:sidebar-mode", { detail: { hidden } }))
    return () => {
      window.dispatchEvent(new CustomEvent("creator-hub:sidebar-mode", { detail: { hidden: false } }))
    }
  }, [step])

  useEffect(() => {
    if (!requestedProjectId) {
      setHydrating(false)
      return
    }
    let active = true
    setHydrating(true)
    void loadCloudCreatorHubProject(requestedProjectId).then(async (project) => {
      if (!active) return
      if (!project || project.format !== format) {
        setError("No fue posible abrir este proyecto.")
        setHydrating(false)
        return
      }
      const template = await resolveCustomTemplate(project.designTemplateId || "")
      if (!active) return
      const color = template?.accentColor || project.accentColor || "#334155"
      const prepared = ensureVisualCanvasData(
        ensureLayerMetadata(format, project.data),
        format,
        color,
        toTemplateReference(template),
      )
      const withTemplate = applyCanvasTemplate(prepared, toTemplateReference(template))
      setProjectId(project.id)
      setResult(withTemplate)
      setAccentColor(color)
      setDesignTemplateId(template?.id || project.designTemplateId || "blank")
      setSelectedTemplate(template)
      setPreviewIndex(0)
      setSaved(true)
      setStep("result")
      setHydrating(false)
    })
    return () => {
      active = false
    }
  }, [format, requestedProjectId])

  useEffect(() => {
    if (format !== "ppt") return
    if (slideCount === 0) setPreviewIndex(0)
    else if (previewIndex >= slideCount) setPreviewIndex(slideCount - 1)
  }, [format, previewIndex, slideCount])

  const handleFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setContent(String(reader.result || "").split(",")[1] || "")
    reader.readAsDataURL(file)
  }, [])

  const persistResult = (
    next: any,
    nextAccent = accentColor,
    nextTemplate = designTemplateId,
    refreshBindings = false,
  ) => {
    const prepared = refreshBindings ? refreshVisualCanvasBindings(next) : next
    setResult(prepared)
    if (!projectId) return
    const updated = updateCreatorHubProject(projectId, {
      title: projectTitle(format, prepared, meta?.label || "Material"),
      data: prepared,
      accentColor: nextAccent,
      designTemplateId: nextTemplate,
    })
    setSaved(Boolean(updated))
  }

  const changeTemplate = (
    templateId: string,
    nextAccentColor?: string,
    template?: TemplatePickerSelection,
  ) => {
    const nextTemplate = template || null
    const color = nextAccentColor || accentColor
    setDesignTemplateId(templateId)
    setSelectedTemplate(nextTemplate)
    setAccentColor(color)
    if (!result) return

    let next = ensureVisualCanvasData(result, format, color, toTemplateReference(nextTemplate))
    next = applyCanvasTemplate(next, toTemplateReference(nextTemplate))
    next = applyCanvasAccent(next, color)
    next._design = {
      ...(next._design || {}),
      id: templateId,
      custom: nextTemplate?.kind === "custom",
      sourceFile: nextTemplate?.fileName || null,
      templateImageUrl: nextTemplate?.imageUrl || null,
      palette: {
        ...(next._design?.palette || {}),
        primary: color,
        accent: color,
        secondary: nextTemplate?.secondaryColor || "#94a3b8",
      },
    }
    persistResult(next, color, templateId)
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
    setAccentColor("#334155")
    setDesignTemplateId("blank")
    setSelectedTemplate(null)
    setPanel(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  const generate = async () => {
    if (!content.trim()) return
    setProcessing(true)
    setError(null)
    setSaved(false)
    setStep("processing")
    setPanel(null)

    try {
      const response = await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, content, fileName, outputFormat: format, designTemplateId }),
      })
      const payload = await response.json() as ApiResponse
      if (!payload.success || !payload.output?.data) {
        throw new Error(payload.error || "No fue posible generar el material")
      }

      let generated = ensureLayerMetadata(format, payload.output.data)
      generated = ensureVisualCanvasData(generated, format, accentColor, toTemplateReference(selectedTemplate))
      generated = applyCanvasTemplate(generated, toTemplateReference(selectedTemplate))
      generated._design = {
        ...(generated._design || {}),
        id: designTemplateId,
        custom: selectedTemplate?.kind === "custom",
        sourceFile: selectedTemplate?.fileName || null,
        templateImageUrl: selectedTemplate?.imageUrl || null,
        palette: {
          ...(generated._design?.palette || {}),
          primary: accentColor,
          accent: accentColor,
          secondary: selectedTemplate?.secondaryColor || "#94a3b8",
        },
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
  const Editor = format === "infographic" ? InfographicContentEditor : PresentationContentEditor

  if (hydrating) {
    return <div className="flex min-h-[70vh] items-center justify-center"><LoaderCircle size={34} className="animate-spin text-blue-500" /></div>
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-soft bg-header-theme/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1900px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/creator-hub/materials" className={headerButton} title="Volver"><ArrowLeft size={15} /></Link>
            <span className="text-lg">{meta.icon}</span>
            <div className="min-w-0"><p className="truncate text-sm font-bold text-main">{meta.label}</p><p className="hidden text-[10px] text-muted2 sm:block">Editor visual</p></div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {step === "result" && (
              <>
                <button type="button" onClick={() => setPanel((current) => current === "content" ? null : "content")} className={`${headerButton} ${panel === "content" ? "text-blue-600" : ""}`}><FileInput size={14} /> Contenido</button>
                <button type="button" onClick={() => setPanel((current) => current === "template" ? null : "template")} className={`${headerButton} ${panel === "template" ? "text-blue-600" : ""}`}><LayoutTemplate size={14} /> Plantilla</button>
              </>
            )}
            {saved && <span className="hidden items-center gap-1.5 px-2 text-[10px] font-bold text-emerald-600 md:flex"><CheckCircle2 size={12} /> Guardado</span>}
            {(step === "result" || step === "processing") && <button type="button" onClick={reset} disabled={processing} className={headerButton}><RotateCcw size={14} /> Nueva creación</button>}
          </div>
        </div>
      </header>

      {panel && step === "result" && (
        <aside className="fixed left-3 top-[70px] z-50 max-h-[calc(100vh-84px)] w-[430px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border border-soft bg-header-theme/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><p className="text-sm font-bold text-main">{panel === "content" ? "Contenido" : "Plantilla"}</p></div>
            <button type="button" onClick={() => setPanel(null)} className={headerButton}><X size={15} /></button>
          </div>
          {panel === "content"
            ? <Editor data={result} onChange={(next) => persistResult(next, accentColor, designTemplateId, true)} />
            : <TemplatePicker format={format} value={designTemplateId} onChange={changeTemplate} compact />}
        </aside>
      )}

      {step === "input" && (
        <main className="mx-auto grid max-w-6xl gap-5 px-5 py-7 lg:grid-cols-[430px_minmax(0,1fr)]">
          <section className="space-y-4 rounded-3xl border border-soft bg-card-theme p-5">
            <div><h1 className="text-lg font-bold text-main">Crear {meta.label.toLowerCase()}</h1><p className="mt-1 text-xs leading-5 text-muted2">Selecciona la fuente y una plantilla base.</p></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted2">Fuente</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SOURCE_TYPES.map((source) => {
                  const active = sourceType === source.id
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => {
                        setSourceType(source.id)
                        setContent("")
                        setFileName("")
                        setError(null)
                        if (fileRef.current) fileRef.current.value = ""
                      }}
                      className="rounded-2xl border p-3 text-left"
                      style={{ borderColor: active ? "rgba(37,99,235,.35)" : "var(--border-soft)", background: "var(--bg-card-soft)" }}
                    >
                      <span className="text-base">{source.icon}</span>
                      <p className="mt-1 text-xs font-bold text-main">{source.label}</p>
                      <p className="text-[10px] text-muted2">{source.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted2">Contenido</p>
              {sourceType === "topic" || sourceType === "text" || sourceType === "url" ? (
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={sourceType === "text" ? 9 : 5}
                  placeholder={sourceType === "topic" ? meta.placeholder : sourceType === "url" ? "https://ejemplo.com/articulo" : "Pega aquí el contenido..."}
                  className="mt-2 w-full resize-y rounded-2xl border border-soft bg-card-soft-theme px-3.5 py-3 text-sm text-main outline-none"
                />
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 w-full rounded-2xl border-2 border-dashed border-soft p-6 text-center">
                  <Upload size={24} className="mx-auto text-muted2" />
                  <span className="mt-2 block text-xs font-bold text-sub">{content ? `${fileName} cargado` : `Subir archivo .${sourceType}`}</span>
                  <input ref={fileRef} type="file" accept={sourceType === "pdf" ? ".pdf" : ".docx,.doc"} onChange={handleFile} className="hidden" />
                </button>
              )}
            </div>
            {error && <div className="rounded-xl border border-red-500/25 px-3 py-2 text-xs text-red-500">{error}</div>}
            <button type="button" onClick={generate} disabled={!content.trim() || processing} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-35"><Sparkles size={15} /> Generar</button>
          </section>
          <section className="rounded-3xl border border-soft bg-card-theme p-5"><TemplatePicker format={format} value={designTemplateId} onChange={changeTemplate} /></section>
        </main>
      )}

      {step === "processing" && (
        <div className="flex min-h-[75vh] flex-col items-center justify-center">
          <LoaderCircle size={42} className="animate-spin text-blue-600" />
          <p className="mt-4 text-sm font-bold text-main">Creando el lienzo...</p>
        </div>
      )}

      {step === "result" && result && (
        <main className="mx-auto max-w-[1900px] space-y-3 px-3 py-3 sm:px-5">
          {format === "ppt" && (
            <div className="flex items-center justify-center gap-4">
              <button type="button" onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))} disabled={previewIndex === 0} className={headerButton}><ChevronLeft size={14} /> Anterior</button>
              <span className="text-xs font-bold text-main">{previewIndex + 1} / {slideCount}</span>
              <button type="button" onClick={() => setPreviewIndex((index) => Math.min(slideCount - 1, index + 1))} disabled={previewIndex >= slideCount - 1} className={headerButton}>Siguiente <ChevronRight size={14} /></button>
            </div>
          )}
          <DirectVisualCanvasEditor data={result} pageIndex={previewIndex} onChange={(next) => persistResult(next)} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-soft px-3 py-2">
            <Link href="/creator-hub/projects" className={headerButton}><FolderOpen size={14} /> Proyectos</Link>
            <CreatorHubUtilityBar format={format} data={result} accentColor={accentColor} designTemplateId={designTemplateId} title={projectTitle(format, result, meta.label)} />
          </div>
        </main>
      )}
    </div>
  )
}
