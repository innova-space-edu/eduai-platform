"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, FolderOpen, Info, LoaderCircle, RotateCcw, Sparkles, Upload, WandSparkles } from "lucide-react"
import { RENDERERS } from "@/components/creator-hub/renderers"
import VideoSummaryRenderer from "@/components/creator-hub/VideoSummaryRenderer"
import CreatorHubUtilityBar from "@/components/creator-hub/CreatorHubUtilityBar"
import ColorPalette from "@/components/ui/ColorPalette"
import TemplatePicker from "@/components/design/TemplatePicker"
import { getDefaultDesignTemplateId } from "@/lib/design-templates/registry"
import { CREATOR_HUB_FORMATS, getCreatorHubFormat } from "@/components/creator-hub/catalog"
import { saveCreatorHubProject } from "@/components/creator-hub/project-store"

const SOURCE_TYPES = [
  { id: "topic", icon: "💡", label: "Tema", description: "Describe lo que necesitas" },
  { id: "text", icon: "📝", label: "Texto", description: "Pega contenido completo" },
  { id: "url", icon: "🔗", label: "URL", description: "Procesa una página web" },
  { id: "pdf", icon: "📄", label: "PDF", description: "Carga un documento" },
  { id: "docx", icon: "📎", label: "DOCX", description: "Carga un archivo Word" },
] as const

const VIDEO_SOURCE_TYPES = [
  { id: "youtube", icon: "▶️", label: "YouTube", description: "Video público con audio e imagen" },
] as const

type SourceType = "topic" | "text" | "url" | "pdf" | "docx" | "youtube"
type EditorStep = "input" | "processing" | "result"
type DetailLevel = "concise" | "standard" | "detailed"
type SummaryStyle = "explanatory" | "class" | "critical" | "executive"
type Audience = "secondary" | "teacher" | "general" | "university"

type ProcessContentResponse = {
  success?: boolean
  error?: string
  output?: { data?: unknown }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readString(data: unknown, key: string) {
  if (!isRecord(data)) return undefined
  const value = data[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

function getProjectTitle(data: unknown, fallback: string) {
  return readString(data, "title") || readString(data, "headline") || readString(data, "deckTitle") || readString(data, "centralTopic") || readString(data, "topic") || fallback
}

function getDesignPalette(data: unknown) {
  if (!isRecord(data) || !isRecord(data._design) || !isRecord(data._design.palette)) return undefined
  const background = typeof data._design.palette.background === "string" ? data._design.palette.background : undefined
  const primary = typeof data._design.palette.primary === "string" ? data._design.palette.primary : undefined
  return { background, primary }
}

export default function CreatorHubFormatPage() {
  const params = useParams()
  const format = (params?.format as string) || "infographic"
  const meta = getCreatorHubFormat(format) || CREATOR_HUB_FORMATS[0]
  const isVideoSummary = meta.id === "video-summary"
  const Renderer = isVideoSummary ? VideoSummaryRenderer : RENDERERS[meta.id]
  const sourceOptions = isVideoSummary ? VIDEO_SOURCE_TYPES : SOURCE_TYPES

  const [sourceType, setSourceType] = useState<SourceType>(isVideoSummary ? "youtube" : "topic")
  const [content, setContent] = useState("")
  const [fileName, setFileName] = useState("")
  const [accentColor, setAccentColor] = useState(meta.color)
  const [designTemplateId, setDesignTemplateId] = useState(() => getDefaultDesignTemplateId(meta.id))
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<EditorStep>("input")
  const [saved, setSaved] = useState(false)
  const [language, setLanguage] = useState("Español de Chile")
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("detailed")
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>("explanatory")
  const [audience, setAudience] = useState<Audience>("secondary")
  const [includeVisualAnalysis, setIncludeVisualAnalysis] = useState(true)
  const [customInstruction, setCustomInstruction] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSourceType(isVideoSummary ? "youtube" : "topic")
    setContent("")
    setFileName("")
    setResult(null)
    setError(null)
    setStep("input")
    setSaved(false)
    setAccentColor(meta.color)
    setDesignTemplateId(getDefaultDesignTemplateId(meta.id))
    if (fileRef.current) fileRef.current.value = ""
  }, [isVideoSummary, meta.color, meta.id])

  const handleFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1]
      setContent(base64 || "")
    }
    reader.readAsDataURL(file)
  }, [])

  const handleGenerate = async () => {
    if (!content.trim()) return
    setProcessing(true)
    setSaved(false)
    setError(null)
    setStep("processing")
    try {
      const endpoint = isVideoSummary ? "/api/creator/video-summary" : "/api/process-content"
      const requestBody = isVideoSummary
        ? {
            youtubeUrl: content.trim(),
            designTemplateId,
            options: {
              language,
              detailLevel,
              summaryStyle,
              audience,
              includeVisualAnalysis,
              customInstruction,
            },
          }
        : { sourceType, content, fileName, outputFormat: meta.id, designTemplateId }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
      const data = (await response.json()) as ProcessContentResponse
      if (!data.success || !data.output?.data) throw new Error(data.error || "No fue posible generar el material")
      const generated = data.output.data
      setResult(generated)
      setStep("result")
      const storedProject = saveCreatorHubProject({
        format: meta.id,
        title: getProjectTitle(generated, meta.label),
        data: generated,
        accentColor,
        designTemplateId,
      })
      setSaved(Boolean(storedProject))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado")
      setStep("input")
    } finally {
      setProcessing(false)
    }
  }

  const handleReset = () => {
    setStep("input")
    setContent("")
    setFileName("")
    setResult(null)
    setError(null)
    setSaved(false)
    setCustomInstruction("")
    if (fileRef.current) fileRef.current.value = ""
  }

  const handleSourceChange = (nextSource: SourceType) => {
    setSourceType(nextSource)
    setContent("")
    setFileName("")
    setError(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  const handleTemplateChange = (templateId: string, nextAccentColor?: string) => {
    setDesignTemplateId(templateId)
    if (nextAccentColor) setAccentColor(nextAccentColor)
  }

  const resultPalette = getDesignPalette(result)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="max-w-[1500px] mx-auto px-5 sm:px-7 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/creator-hub/materials" className="w-9 h-9 rounded-xl border border-soft flex items-center justify-center text-muted2 hover:text-main hover:bg-card-soft-theme transition-all flex-shrink-0" title="Volver a materiales">
              <ArrowLeft size={15} />
            </Link>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${meta.color}16`, border: `1px solid ${meta.color}2c` }}>{meta.icon}</div>
            <div className="min-w-0">
              <p className="text-main font-bold text-sm sm:text-base truncate">{meta.label}</p>
              <p className="text-muted2 text-[11px] truncate hidden sm:block">{meta.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {saved && <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-emerald-600"><CheckCircle2 size={13} /> Guardado en proyectos</span>}
            {(step === "result" || step === "processing") && (
              <button onClick={handleReset} disabled={processing} className="flex items-center gap-1.5 rounded-xl border border-soft px-3 py-2 text-xs font-bold text-muted2 hover:text-main hover:bg-card-soft-theme disabled:opacity-40 transition-all">
                <RotateCcw size={13} /> Nueva creación
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-5 sm:px-7 py-6 grid xl:grid-cols-[400px_minmax(0,1fr)] gap-5 items-start">
        <aside className="xl:sticky xl:top-[82px] space-y-4">
          <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <WandSparkles size={15} style={{ color: meta.color }} />
              <h2 className="text-main text-sm font-bold">Configura tu material</h2>
            </div>
            <p className="text-muted2 text-xs leading-relaxed mt-1.5">
              {isVideoSummary
                ? "Pega un enlace público de YouTube y define cómo debe analizarse el contenido hablado y visual."
                : "Elige la fuente, una plantilla y el color principal. El motor actual de EduAI se mantiene conectado."}
            </p>

            <div className="mt-5">
              <label className="text-muted2 text-[10px] font-bold tracking-[0.16em] uppercase">1. Fuente de contenido</label>
              <div className={`grid gap-2 mt-2 ${isVideoSummary ? "grid-cols-1" : "grid-cols-2"}`}>
                {sourceOptions.map((source) => {
                  const active = sourceType === source.id
                  return (
                    <button key={source.id} onClick={() => handleSourceChange(source.id)} className="rounded-2xl border p-2.5 text-left transition-all" style={{ background: active ? `${meta.color}10` : "var(--bg-card-soft)", borderColor: active ? `${meta.color}35` : "var(--border-soft)" }}>
                      <span className="block text-base">{source.icon}</span>
                      <span className="block text-xs font-bold mt-1" style={{ color: active ? meta.color : "var(--text-secondary)" }}>{source.label}</span>
                      <span className="block text-[10px] text-muted2 mt-0.5 leading-tight">{source.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-muted2 text-[10px] font-bold tracking-[0.16em] uppercase">2. Contenido</label>
              {sourceType === "youtube" ? (
                <div className="mt-2">
                  <input
                    type="url"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full rounded-2xl border border-soft bg-card-soft-theme px-3.5 py-3 text-sm text-main placeholder:text-muted2 outline-none focus:border-red-500/30 focus:bg-input-theme transition-all"
                  />
                  <p className="mt-2 text-[10px] leading-relaxed text-muted2">Admite enlaces watch, youtu.be y Shorts. El video debe ser público.</p>
                </div>
              ) : (sourceType === "topic" || sourceType === "text" || sourceType === "url") ? (
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={sourceType === "text" ? 8 : 4}
                  placeholder={sourceType === "topic" ? meta.placeholder : sourceType === "url" ? "https://ejemplo.com/articulo" : "Pega aquí el contenido que quieres transformar..."}
                  className="w-full mt-2 rounded-2xl border border-soft bg-card-soft-theme px-3.5 py-3 text-sm text-main placeholder:text-muted2 outline-none resize-y focus:border-blue-500/30 focus:bg-input-theme transition-all"
                />
              ) : (
                <button onClick={() => fileRef.current?.click()} className="w-full mt-2 rounded-2xl border-2 border-dashed p-6 text-center transition-all" style={{ background: content ? "rgba(16,185,129,0.06)" : "var(--bg-card-soft)", borderColor: content ? "rgba(16,185,129,0.32)" : "var(--border-medium)" }}>
                  {content ? <CheckCircle2 size={24} className="mx-auto text-emerald-500" /> : <Upload size={24} className="mx-auto text-muted2" />}
                  <span className={`block text-xs font-bold mt-2 ${content ? "text-emerald-600" : "text-sub"}`}>{content ? `${fileName} cargado` : `Subir archivo .${sourceType}`}</span>
                  <span className="block text-[10px] text-muted2 mt-1">Clic para seleccionar un documento</span>
                  <input ref={fileRef} type="file" accept={sourceType === "pdf" ? ".pdf" : ".docx,.doc"} onChange={handleFile} className="hidden" />
                </button>
              )}
            </div>

            {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-3 mt-4"><p className="text-red-500 text-xs leading-relaxed">❌ {error}</p></div>}
          </section>

          {isVideoSummary && (
            <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5 space-y-4">
              <div>
                <label className="text-muted2 text-[10px] font-bold tracking-[0.16em] uppercase">3. Personaliza el resumen</label>
                <p className="mt-1 text-[11px] leading-relaxed text-muted2">Controla el idioma, la profundidad y el enfoque pedagógico.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted2">IDIOMA</span>
                  <select value={language} onChange={(event) => setLanguage(event.target.value)} className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none">
                    <option>Español de Chile</option>
                    <option>Español latinoamericano</option>
                    <option>English</option>
                    <option>Português</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted2">DETALLE</span>
                  <select value={detailLevel} onChange={(event) => setDetailLevel(event.target.value as DetailLevel)} className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none">
                    <option value="concise">Conciso</option>
                    <option value="standard">Estándar</option>
                    <option value="detailed">Detallado</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted2">ENFOQUE</span>
                  <select value={summaryStyle} onChange={(event) => setSummaryStyle(event.target.value as SummaryStyle)} className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none">
                    <option value="explanatory">Explicativo</option>
                    <option value="class">Apoyo de clase</option>
                    <option value="critical">Análisis crítico</option>
                    <option value="executive">Ejecutivo</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted2">AUDIENCIA</span>
                  <select value={audience} onChange={(event) => setAudience(event.target.value as Audience)} className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none">
                    <option value="secondary">Enseñanza media</option>
                    <option value="teacher">Docente</option>
                    <option value="general">Público general</option>
                    <option value="university">Universitario</option>
                  </select>
                </label>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-soft bg-card-soft-theme p-3 cursor-pointer">
                <input type="checkbox" checked={includeVisualAnalysis} onChange={(event) => setIncludeVisualAnalysis(event.target.checked)} className="mt-0.5 h-4 w-4 accent-red-500" />
                <span>
                  <span className="block text-xs font-bold text-sub">Analizar también lo visual</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-muted2">Considera diagramas, demostraciones, textos en pantalla y cambios de escena.</span>
                </span>
              </label>

              <label className="block">
                <span className="text-[10px] font-bold text-muted2">INSTRUCCIÓN PERSONALIZADA</span>
                <textarea
                  value={customInstruction}
                  onChange={(event) => setCustomInstruction(event.target.value)}
                  rows={3}
                  maxLength={1200}
                  placeholder="Ej: destaca los experimentos, las estadísticas y las conclusiones del expositor..."
                  className="mt-1.5 w-full resize-y rounded-2xl border border-soft bg-card-soft-theme px-3.5 py-3 text-xs text-main placeholder:text-muted2 outline-none focus:border-red-500/30"
                />
              </label>
            </section>
          )}

          <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5 space-y-5">
            <div>
              <label className="text-muted2 text-[10px] font-bold tracking-[0.16em] uppercase">{isVideoSummary ? "4" : "3"}. Diseño visual</label>
              <div className="mt-2"><TemplatePicker format={meta.id} value={designTemplateId} onChange={handleTemplateChange} compact /></div>
            </div>
            <ColorPalette value={accentColor} onChange={setAccentColor} />
          </section>

          <button onClick={handleGenerate} disabled={!content.trim() || processing} className="w-full rounded-2xl py-3.5 px-4 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-35 transition-all" style={{ background: `linear-gradient(135deg,${meta.color}cc,${meta.color})`, boxShadow: content.trim() ? `0 12px 24px ${meta.color}24` : "none" }}>
            {processing ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {processing ? (isVideoSummary ? "Analizando video..." : "Generando material...") : `Generar ${meta.label}`}
          </button>
        </aside>

        <section className="min-w-0 rounded-3xl border border-soft bg-card-theme overflow-hidden">
          <div className="border-b border-soft px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-main text-sm font-bold">Vista de trabajo</p>
              <p className="text-muted2 text-[11px] mt-0.5">Previsualiza el resultado y utiliza las acciones disponibles.</p>
            </div>
            <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: `${meta.color}12`, color: meta.color }}>{meta.icon} {meta.label}</span>
          </div>

          {step === "input" && (
            <div className="min-h-[620px] flex flex-col items-center justify-center text-center px-6 py-10">
              <div className="w-20 h-20 rounded-[28px] flex items-center justify-center text-4xl" style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}22` }}>{meta.icon}</div>
              <h2 className="text-main text-lg font-bold mt-5">Prepara tu {meta.label.toLowerCase()}</h2>
              <p className="text-muted2 text-sm leading-relaxed mt-2 max-w-lg">
                {isVideoSummary
                  ? "Pega un enlace público de YouTube. EduAI analizará el contenido hablado y visual para construir una síntesis con marcas de tiempo."
                  : "Completa la configuración del panel izquierdo. Puedes partir desde un tema, un texto, una URL, un PDF o un documento Word."}
              </p>
              <div className="grid sm:grid-cols-3 gap-2 mt-6 max-w-2xl w-full">
                {meta.highlights.map((highlight) => <div key={highlight} className="rounded-2xl border border-soft bg-card-soft-theme p-3 text-xs text-sub">✓ {highlight}</div>)}
              </div>
              <div className="rounded-2xl border border-soft bg-card-soft-theme p-3.5 mt-5 max-w-2xl flex items-start gap-2 text-left">
                <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-muted2 text-xs leading-relaxed">
                  {isVideoSummary
                    ? "El resultado incluirá resumen general, tesis central, momentos clave, conceptos, aprendizajes, preguntas y glosario. Los videos privados o no listados no son compatibles."
                    : "Las funciones originales siguen conectadas. La mejora se concentra en ordenar Creator Hub, ampliar el editor y mantener todos los formatos accesibles."}
                </p>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="min-h-[620px] flex flex-col items-center justify-center text-center px-6 py-10">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-2 border-soft animate-spin" style={{ borderTopColor: meta.color }} />
                <div className="absolute inset-0 flex items-center justify-center text-3xl">{meta.icon}</div>
              </div>
              <h2 className="text-main text-lg font-bold mt-5">{isVideoSummary ? "Analizando el video..." : `Generando ${meta.label.toLowerCase()}...`}</h2>
              <p className="text-muted2 text-sm mt-2 max-w-md">
                {isVideoSummary
                  ? "EduAI está revisando el audio, los elementos visuales y las marcas de tiempo del video."
                  : "EduAI está extrayendo conceptos, estructurando el contenido y aplicando la plantilla seleccionada."}
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {(isVideoSummary
                  ? ["Leyendo audio y escenas", "Identificando momentos clave", "Construyendo síntesis pedagógica"]
                  : ["Analizando fuente", "Organizando contenido", "Aplicando diseño"]
                ).map((label) => <span key={label} className="rounded-full border border-soft bg-card-soft-theme px-3 py-1 text-[11px] text-muted2 animate-pulse">{label}</span>)}
              </div>
            </div>
          )}

          {step === "result" && result !== null && (
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border p-3.5" style={{ background: `${meta.color}08`, borderColor: `${meta.color}22` }}>
                <CheckCircle2 size={18} style={{ color: meta.color }} className="flex-shrink-0" />
                <div className="min-w-0 flex-1"><p className="text-sm font-bold" style={{ color: meta.color }}>{meta.label} generada correctamente</p><p className="text-muted2 text-[11px] mt-0.5">{saved ? "El resultado se guardó en Mis proyectos y continúa disponible para exportar." : "El resultado está listo para exportar. El respaldo local no pudo guardarse en este navegador."}</p></div>
                <Link href="/creator-hub/projects" className="flex items-center gap-1.5 text-xs font-bold text-sub hover:text-main"><FolderOpen size={13} /> Ver proyectos</Link>
              </div>

              <div id="creator-result-container" className="rounded-2xl border p-4 sm:p-5 overflow-auto" style={{ background: resultPalette?.background || "var(--bg-card-soft)", borderColor: resultPalette?.primary ? `${resultPalette.primary}22` : "var(--border-soft)" }}>
                {Renderer ? <Renderer data={result} /> : <pre className="text-xs text-sub whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>}
              </div>

              <CreatorHubUtilityBar format={meta.id} data={result} accentColor={accentColor} designTemplateId={designTemplateId} title={getProjectTitle(result, meta.label)} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
