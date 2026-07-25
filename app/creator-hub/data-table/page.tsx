"use client"

import { useCallback, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, FolderOpen, Info, LoaderCircle, RotateCcw, Sparkles, Upload, WandSparkles } from "lucide-react"
import DataTableRenderer from "@/components/creator-hub/DataTableRenderer"
import CreatorHubUtilityBar from "@/components/creator-hub/CreatorHubUtilityBar"
import ColorPalette from "@/components/ui/ColorPalette"
import TemplatePicker from "@/components/design/TemplatePicker"
import { saveCreatorHubProject } from "@/components/creator-hub/project-store"
import { getDefaultDesignTemplateId } from "@/lib/design-templates/registry"
import type { DataTableData } from "@/lib/data-table-downloads"

const META = {
  id: "data-table",
  icon: "📋",
  label: "Tabla de datos",
  description: "Convierte temas, textos y documentos en tablas editables y exportables.",
  color: "#0ea5e9",
  placeholder: "Ej: comparación de energías renovables, resultados de una encuesta o rúbrica de evaluación...",
  highlights: ["Edita filas y columnas", "Exporta a Excel y CSV", "Genera una imagen PNG"],
}

const SOURCE_TYPES = [
  { id: "topic", icon: "💡", label: "Tema", description: "Crea una tabla ilustrativa" },
  { id: "text", icon: "📝", label: "Texto", description: "Organiza datos pegados" },
  { id: "url", icon: "🔗", label: "URL", description: "Extrae una página web" },
  { id: "pdf", icon: "📄", label: "PDF", description: "Procesa un documento" },
  { id: "docx", icon: "📎", label: "DOCX", description: "Carga un archivo Word" },
] as const

type SourceType = (typeof SOURCE_TYPES)[number]["id"]
type EditorStep = "input" | "processing" | "result"

type ProcessResponse = {
  success?: boolean
  error?: string
  output?: { data?: DataTableData }
}

export default function CreatorDataTablePage() {
  const [sourceType, setSourceType] = useState<SourceType>("topic")
  const [content, setContent] = useState("")
  const [fileName, setFileName] = useState("")
  const [customInstruction, setCustomInstruction] = useState("")
  const [accentColor, setAccentColor] = useState(META.color)
  const [designTemplateId, setDesignTemplateId] = useState(() => getDefaultDesignTemplateId(META.id))
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<DataTableData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<EditorStep>("input")
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = String(reader.result || "").split(",")[1]
      setContent(base64 || "")
    }
    reader.onerror = () => setError("No fue posible leer el archivo seleccionado.")
    reader.readAsDataURL(file)
  }, [])

  const handleSourceChange = (nextSource: SourceType) => {
    setSourceType(nextSource)
    setContent("")
    setFileName("")
    setError(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  const handleGenerate = async () => {
    if (!content.trim() || processing) return
    setProcessing(true)
    setError(null)
    setSaved(false)
    setStep("processing")

    try {
      const response = await fetch("/api/creator/data-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          content,
          fileName,
          designTemplateId,
          customInstruction,
        }),
      })
      const data = (await response.json()) as ProcessResponse
      if (!response.ok || !data.success || !data.output?.data) {
        throw new Error(data.error || "No fue posible generar la tabla de datos.")
      }

      const generated = data.output.data
      setResult(generated)
      setStep("result")
      const stored = saveCreatorHubProject({
        format: META.id,
        title: generated.title || META.label,
        data: generated,
        accentColor,
        designTemplateId,
      })
      setSaved(Boolean(stored))
    } catch (generationError: unknown) {
      setError(generationError instanceof Error ? generationError.message : "Ocurrió un error inesperado.")
      setStep("input")
    } finally {
      setProcessing(false)
    }
  }

  const handleReset = () => {
    setSourceType("topic")
    setContent("")
    setFileName("")
    setCustomInstruction("")
    setResult(null)
    setError(null)
    setSaved(false)
    setStep("input")
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-3.5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/creator-hub/materials" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-soft text-muted2 transition hover:bg-card-soft-theme hover:text-main" title="Volver a materiales">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: `${META.color}16`, border: `1px solid ${META.color}2c` }}>{META.icon}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-main sm:text-base">{META.label}</p>
              <p className="hidden truncate text-[11px] text-muted2 sm:block">{META.description}</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {saved && <span className="hidden items-center gap-1.5 text-[11px] font-bold text-emerald-600 sm:flex"><CheckCircle2 size={13} /> Guardado en proyectos</span>}
            {(step === "result" || step === "processing") && (
              <button type="button" onClick={handleReset} disabled={processing} className="flex items-center gap-1.5 rounded-xl border border-soft px-3 py-2 text-xs font-bold text-muted2 transition hover:bg-card-soft-theme hover:text-main disabled:opacity-40">
                <RotateCcw size={13} /> Nueva tabla
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] items-start gap-5 px-5 py-6 sm:px-7 xl:grid-cols-[400px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-[82px]">
          <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <WandSparkles size={15} style={{ color: META.color }} />
              <h2 className="text-sm font-bold text-main">Configura tu tabla</h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted2">Elige una fuente. EduAI identificará categorías, cifras y relaciones para construir filas y columnas coherentes.</p>

            <div className="mt-5">
              <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">1. Fuente de contenido</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SOURCE_TYPES.map((source) => {
                  const active = sourceType === source.id
                  return (
                    <button key={source.id} type="button" onClick={() => handleSourceChange(source.id)} className="rounded-2xl border p-2.5 text-left transition-all" style={{ background: active ? `${META.color}10` : "var(--bg-card-soft)", borderColor: active ? `${META.color}35` : "var(--border-soft)" }}>
                      <span className="block text-base">{source.icon}</span>
                      <span className="mt-1 block text-xs font-bold" style={{ color: active ? META.color : "var(--text-secondary)" }}>{source.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-tight text-muted2">{source.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">2. Contenido</label>
              {sourceType === "topic" || sourceType === "text" || sourceType === "url" ? (
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={sourceType === "text" ? 8 : 4}
                  placeholder={sourceType === "topic" ? META.placeholder : sourceType === "url" ? "https://ejemplo.com/datos" : "Pega aquí los datos o el contenido que quieres organizar..."}
                  className="mt-2 w-full resize-y rounded-2xl border border-soft bg-card-soft-theme px-3.5 py-3 text-sm text-main outline-none placeholder:text-muted2 transition-all focus:border-sky-500/30 focus:bg-input-theme"
                />
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 w-full rounded-2xl border-2 border-dashed p-6 text-center transition-all" style={{ background: content ? "rgba(16,185,129,0.06)" : "var(--bg-card-soft)", borderColor: content ? "rgba(16,185,129,0.32)" : "var(--border-medium)" }}>
                  {content ? <CheckCircle2 size={24} className="mx-auto text-emerald-500" /> : <Upload size={24} className="mx-auto text-muted2" />}
                  <span className={`mt-2 block text-xs font-bold ${content ? "text-emerald-600" : "text-sub"}`}>{content ? `${fileName} cargado` : `Subir archivo .${sourceType}`}</span>
                  <span className="mt-1 block text-[10px] text-muted2">Clic para seleccionar un documento</span>
                  <input ref={fileRef} type="file" accept={sourceType === "pdf" ? ".pdf" : ".docx,.doc"} onChange={handleFile} className="hidden" />
                </button>
              )}
            </div>

            <label className="mt-4 block">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">3. Instrucción opcional</span>
              <textarea
                value={customInstruction}
                onChange={(event) => setCustomInstruction(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Ej: compara ventajas y desventajas, conserva unidades o crea una rúbrica con cuatro niveles..."
                className="mt-2 w-full resize-y rounded-2xl border border-soft bg-card-soft-theme px-3.5 py-3 text-xs text-main outline-none placeholder:text-muted2 focus:border-sky-500/30"
              />
            </label>

            {error && <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/5 p-3"><p className="text-xs leading-relaxed text-red-500">❌ {error}</p></div>}
          </section>

          <section className="space-y-5 rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">4. Diseño visual</label>
              <div className="mt-2"><TemplatePicker format={META.id} value={designTemplateId} onChange={(templateId, nextColor) => { setDesignTemplateId(templateId); if (nextColor) setAccentColor(nextColor) }} compact /></div>
            </div>
            <ColorPalette value={accentColor} onChange={setAccentColor} />
          </section>

          <button type="button" onClick={handleGenerate} disabled={!content.trim() || processing} className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition-all disabled:opacity-35" style={{ background: `linear-gradient(135deg,${META.color}cc,${META.color})`, boxShadow: content.trim() ? `0 12px 24px ${META.color}24` : "none" }}>
            {processing ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {processing ? "Estructurando datos..." : "Generar tabla editable"}
          </button>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-3xl border border-soft bg-card-theme">
          <div className="flex items-center justify-between gap-3 border-b border-soft px-4 py-3.5 sm:px-5">
            <div>
              <p className="text-sm font-bold text-main">Estudio de datos</p>
              <p className="mt-0.5 text-[11px] text-muted2">Edita el resultado y expórtalo sin perder la estructura de la tabla.</p>
            </div>
            <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: `${META.color}12`, color: META.color }}>{META.icon} {META.label}</span>
          </div>

          {step === "input" && (
            <div className="flex min-h-[620px] flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] text-4xl" style={{ background: `${META.color}12`, border: `1px solid ${META.color}22` }}>{META.icon}</div>
              <h2 className="mt-5 text-lg font-bold text-main">Crea una tabla que puedas modificar</h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted2">Puedes comenzar desde un tema, datos pegados, una página web, un PDF o un documento Word.</p>
              <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-3">
                {META.highlights.map((highlight) => <div key={highlight} className="rounded-2xl border border-soft bg-card-soft-theme p-3 text-xs text-sub">✓ {highlight}</div>)}
              </div>
              <div className="mt-5 flex max-w-2xl items-start gap-2 rounded-2xl border border-soft bg-card-soft-theme p-3.5 text-left">
                <Info size={15} className="mt-0.5 flex-shrink-0 text-sky-500" />
                <p className="text-xs leading-relaxed text-muted2">Cuando la fuente sea solo un tema, los datos generados se marcarán como ilustrativos. Cuando uses documentos, la tabla debe conservar las cifras y categorías disponibles en la fuente.</p>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="flex min-h-[620px] flex-col items-center justify-center px-6 py-10 text-center">
              <div className="relative h-20 w-20">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-soft" style={{ borderTopColor: META.color }} />
                <div className="absolute inset-0 flex items-center justify-center text-3xl">{META.icon}</div>
              </div>
              <h2 className="mt-5 text-lg font-bold text-main">Construyendo la tabla...</h2>
              <p className="mt-2 max-w-md text-sm text-muted2">EduAI está identificando variables, unidades, categorías y relaciones entre los datos.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {["Leyendo la fuente", "Definiendo columnas", "Validando filas", "Preparando edición"].map((label) => <span key={label} className="animate-pulse rounded-full border border-soft bg-card-soft-theme px-3 py-1 text-[11px] text-muted2">{label}</span>)}
              </div>
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 rounded-2xl border p-3.5 sm:flex-row sm:items-center" style={{ background: `${META.color}08`, borderColor: `${META.color}22` }}>
                <CheckCircle2 size={18} style={{ color: META.color }} className="flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: META.color }}>Tabla generada correctamente</p>
                  <p className="mt-0.5 text-[11px] text-muted2">{saved ? "Se guardó una copia inicial en Mis proyectos. Puedes editar celdas y descargar la versión actualizada desde el editor." : "La tabla está lista para editar y exportar; el respaldo local no pudo guardarse en este navegador."}</p>
                </div>
                <Link href="/creator-hub/projects" className="flex items-center gap-1.5 text-xs font-bold text-sub hover:text-main"><FolderOpen size={13} /> Ver proyectos</Link>
              </div>

              <div id="creator-result-container" className="overflow-auto rounded-2xl border border-soft bg-card-soft-theme p-3 sm:p-4">
                <DataTableRenderer data={result} />
              </div>

              <CreatorHubUtilityBar format={META.id} data={result} accentColor={accentColor} designTemplateId={designTemplateId} title={result.title || META.label} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
