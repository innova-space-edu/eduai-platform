"use client"

import { useCallback, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, FolderOpen, Info, LoaderCircle, RotateCcw, Sparkles, Upload, WandSparkles } from "lucide-react"
import { MindmapContentEditor, TimelineContentEditor } from "@/components/creator-hub/EditableDiagramEditors"
import { EditableMindmapPreview, EditableTimelinePreview } from "@/components/creator-hub/EditableDiagramPreviews"
import CreatorHubUtilityBar from "@/components/creator-hub/CreatorHubUtilityBar"
import ColorPalette from "@/components/ui/ColorPalette"
import TemplatePicker from "@/components/design/TemplatePicker"
import { getDefaultDesignTemplateId } from "@/lib/design-templates/registry"
import { getCreatorHubFormat } from "@/components/creator-hub/catalog"
import { saveCreatorHubProject, updateCreatorHubProject } from "@/components/creator-hub/project-store"

const SOURCE_TYPES = [
  { id: "topic", icon: "💡", label: "Tema", description: "Describe lo que necesitas" },
  { id: "text", icon: "📝", label: "Texto", description: "Pega contenido completo" },
  { id: "url", icon: "🔗", label: "URL", description: "Procesa una página web" },
  { id: "pdf", icon: "📄", label: "PDF", description: "Carga un documento" },
  { id: "docx", icon: "📎", label: "DOCX", description: "Carga un archivo Word" },
] as const

type SourceType = typeof SOURCE_TYPES[number]["id"]
type DiagramFormat = "mindmap" | "timeline"
type Step = "input" | "processing" | "result"

type ApiResponse = {
  success?: boolean
  error?: string
  output?: { data?: any }
}

const CONFIG = {
  mindmap: {
    editorTitle: "Edita conceptos y conexiones",
    editorDescription: "Cambia niveles, relaciones, colores y descripciones de cada nodo del mapa.",
    processing: ["Extrayendo conceptos", "Construyendo relaciones", "Organizando niveles visuales"],
  },
  timeline: {
    editorTitle: "Edita hitos y relaciones causales",
    editorDescription: "Corrige fechas, reorganiza acontecimientos y conecta causas con consecuencias.",
    processing: ["Identificando hitos", "Ordenando la secuencia", "Detectando relaciones causales"],
  },
} as const

function resultTitle(format: DiagramFormat, data: any, fallback: string) {
  return format === "mindmap" ? data?.centralTopic || fallback : data?.title || fallback
}

function designPalette(data: any) {
  const palette = data?._design?.palette
  return {
    background: typeof palette?.background === "string" ? palette.background : undefined,
    primary: typeof palette?.primary === "string" ? palette.primary : undefined,
  }
}

export default function EditableDiagramCreatorPage({ format }: { format: DiagramFormat }) {
  const meta = getCreatorHubFormat(format)
  const config = CONFIG[format]
  const [sourceType, setSourceType] = useState<SourceType>("topic")
  const [content, setContent] = useState("")
  const [fileName, setFileName] = useState("")
  const [accentColor, setAccentColor] = useState(meta?.color || "#10b981")
  const [designTemplateId, setDesignTemplateId] = useState(() => getDefaultDesignTemplateId(format))
  const [step, setStep] = useState<Step>("input")
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = String(reader.result || "").split(",")[1]
      setContent(base64 || "")
    }
    reader.readAsDataURL(file)
  }, [])

  const reset = () => {
    setSourceType("topic")
    setContent("")
    setFileName("")
    setStep("input")
    setProcessing(false)
    setResult(null)
    setError(null)
    setProjectId(null)
    setSaved(false)
    setAccentColor(meta?.color || "#10b981")
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

      const generated = payload.output.data
      setResult(generated)
      setStep("result")
      const project = saveCreatorHubProject({
        format,
        title: resultTitle(format, generated, meta?.label || "Material"),
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

  const updateResult = (next: any) => {
    setResult(next)
    if (!projectId) return
    const updated = updateCreatorHubProject(projectId, {
      title: resultTitle(format, next, meta?.label || "Material"),
      data: next,
      accentColor,
      designTemplateId,
    })
    setSaved(Boolean(updated))
  }

  if (!meta) return null

  const palette = designPalette(result)
  const Editor = format === "mindmap" ? MindmapContentEditor : TimelineContentEditor

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3.5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/creator-hub/materials" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-soft text-muted2 transition hover:bg-card-soft-theme hover:text-main" title="Volver a materiales"><ArrowLeft size={15} /></Link>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: `${meta.color}16`, border: `1px solid ${meta.color}2c` }}>{meta.icon}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-main sm:text-base">{meta.label} editable</p>
              <p className="hidden truncate text-[11px] text-muted2 sm:block">Genera, modifica y exporta relaciones visuales.</p>
            </div>
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
                <div className="flex items-center gap-2"><WandSparkles size={15} style={{ color: meta.color }} /><h2 className="text-sm font-bold text-main">Configura el material</h2></div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted2">Selecciona una fuente. EduAI creará una estructura inicial que podrás reorganizar completamente.</p>

                <div className="mt-5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">1. Fuente</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {SOURCE_TYPES.map((source) => {
                      const active = sourceType === source.id
                      return <button key={source.id} type="button" onClick={() => { setSourceType(source.id); setContent(""); setFileName(""); setError(null); if (fileRef.current) fileRef.current.value = "" }} className="rounded-2xl border p-2.5 text-left transition-all" style={{ background: active ? `${meta.color}10` : "var(--bg-card-soft)", borderColor: active ? `${meta.color}35` : "var(--border-soft)" }}><span className="block text-base">{source.icon}</span><span className="mt-1 block text-xs font-bold" style={{ color: active ? meta.color : "var(--text-secondary)" }}>{source.label}</span><span className="mt-0.5 block text-[10px] leading-tight text-muted2">{source.description}</span></button>
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">2. Contenido</label>
                  {(sourceType === "topic" || sourceType === "text" || sourceType === "url") ? (
                    <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={sourceType === "text" ? 9 : 5} placeholder={sourceType === "topic" ? meta.placeholder : sourceType === "url" ? "https://ejemplo.com/articulo" : "Pega aquí el contenido que quieres transformar..."} className="mt-2 w-full resize-y rounded-2xl border border-soft bg-card-soft-theme px-3.5 py-3 text-sm text-main outline-none placeholder:text-muted2 focus:border-blue-500/30 focus:bg-input-theme" />
                  ) : (
                    <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 w-full rounded-2xl border-2 border-dashed p-6 text-center" style={{ background: content ? "rgba(16,185,129,0.06)" : "var(--bg-card-soft)", borderColor: content ? "rgba(16,185,129,0.32)" : "var(--border-medium)" }}>{content ? <CheckCircle2 size={24} className="mx-auto text-emerald-500" /> : <Upload size={24} className="mx-auto text-muted2" />}<span className={`mt-2 block text-xs font-bold ${content ? "text-emerald-600" : "text-sub"}`}>{content ? `${fileName} cargado` : `Subir archivo .${sourceType}`}</span><span className="mt-1 block text-[10px] text-muted2">Clic para seleccionar un documento</span><input ref={fileRef} type="file" accept={sourceType === "pdf" ? ".pdf" : ".docx,.doc"} onChange={handleFile} className="hidden" /></button>
                  )}
                </div>
                {error && <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/5 p-3"><p className="text-xs leading-relaxed text-red-500">❌ {error}</p></div>}
              </section>

              <section className="space-y-5 rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
                <div><label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">3. Diseño visual</label><div className="mt-2"><TemplatePicker format={format} value={designTemplateId} onChange={(templateId, nextAccentColor) => { setDesignTemplateId(templateId); if (nextAccentColor) setAccentColor(nextAccentColor) }} compact /></div></div>
                <ColorPalette value={accentColor} onChange={setAccentColor} />
              </section>

              <button type="button" onClick={generate} disabled={!content.trim() || processing} className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white disabled:opacity-35" style={{ background: `linear-gradient(135deg,${meta.color}cc,${meta.color})`, boxShadow: content.trim() ? `0 12px 24px ${meta.color}24` : "none" }}>{processing ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}{processing ? "Generando estructura editable..." : `Generar ${meta.label}`}</button>
            </>
          ) : (
            <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
              <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: meta.color }}>Edición activa</p><h2 className="mt-1 text-base font-bold text-main">{config.editorTitle}</h2><p className="mt-1 text-xs leading-relaxed text-muted2">{config.editorDescription}</p></div>
              <Editor data={result} onChange={updateResult} />
            </section>
          )}
        </aside>

        <section className="min-w-0 overflow-hidden rounded-3xl border border-soft bg-card-theme">
          <div className="flex items-center justify-between gap-3 border-b border-soft px-4 py-3.5 sm:px-5"><div><p className="text-sm font-bold text-main">Vista de relaciones</p><p className="mt-0.5 text-[11px] text-muted2">La exportación utiliza esta versión limpia y actualizada.</p></div><span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: `${meta.color}12`, color: meta.color }}>{meta.icon} {meta.label}</span></div>

          {step === "input" && <div className="flex min-h-[650px] flex-col items-center justify-center px-6 py-10 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-[28px] text-4xl" style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}22` }}>{meta.icon}</div><h2 className="mt-5 text-lg font-bold text-main">Crea una estructura visual con IA</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted2">Después podrás cambiar conceptos, fechas, relaciones y orden sin volver a generar el material.</p><div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-3">{meta.highlights.map((highlight) => <div key={highlight} className="rounded-2xl border border-soft bg-card-soft-theme p-3 text-xs text-sub">✓ {highlight}</div>)}</div><div className="mt-5 flex max-w-2xl items-start gap-2 rounded-2xl border border-soft bg-card-soft-theme p-3.5 text-left"><Info size={15} className="mt-0.5 flex-shrink-0 text-blue-500" /><p className="text-xs leading-relaxed text-muted2">La mejora está aislada en Creator Hub. No modifica Cuaderno EduAI, Notebook ni agentes.</p></div></div>}

          {step === "processing" && <div className="flex min-h-[650px] flex-col items-center justify-center px-6 py-10 text-center"><div className="relative h-20 w-20"><div className="absolute inset-0 animate-spin rounded-full border-2 border-soft" style={{ borderTopColor: meta.color }} /><div className="absolute inset-0 flex items-center justify-center text-3xl">{meta.icon}</div></div><h2 className="mt-5 text-lg font-bold text-main">Preparando estructura editable...</h2><p className="mt-2 max-w-md text-sm text-muted2">EduAI está organizando conceptos y relaciones visuales.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{config.processing.map((label) => <span key={label} className="animate-pulse rounded-full border border-soft bg-card-soft-theme px-3 py-1 text-[11px] text-muted2">{label}</span>)}</div></div>}

          {step === "result" && result && (
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 rounded-2xl border p-3.5 sm:flex-row sm:items-center" style={{ background: `${meta.color}08`, borderColor: `${meta.color}22` }}><CheckCircle2 size={18} style={{ color: meta.color }} className="flex-shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-bold" style={{ color: meta.color }}>{meta.label} lista para editar</p><p className="mt-0.5 text-[11px] text-muted2">Todos los cambios se reflejan inmediatamente y se guardan en el proyecto.</p></div><Link href="/creator-hub/projects" className="flex items-center gap-1.5 text-xs font-bold text-sub hover:text-main"><FolderOpen size={13} /> Ver proyectos</Link></div>

              <div id="creator-result-container" className="overflow-auto rounded-2xl border p-4 sm:p-5" style={{ background: palette.background || "var(--bg-card-soft)", borderColor: palette.primary ? `${palette.primary}22` : "var(--border-soft)" }}>
                {format === "mindmap" ? <EditableMindmapPreview data={result} /> : <EditableTimelinePreview data={result} />}
              </div>

              <CreatorHubUtilityBar format={format} data={result} accentColor={accentColor} designTemplateId={designTemplateId} title={resultTitle(format, result, meta.label)} />
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
