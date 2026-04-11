"use client"

import { useCallback, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { RENDERERS } from "@/components/creator-hub/renderers"
import DownloadBar from "@/components/ui/DownloadBar"
import ColorPalette from "@/components/ui/ColorPalette"

// ── Metadata de cada formato ──────────────────────────────────────────────────
const FORMAT_META: Record<string, {
  icon: string; label: string; desc: string; color: string
  placeholder: string
}> = {
  infographic: { icon: "📊", label: "Infografía",    color: "#3b82f6", desc: "Genera una infografía visual con bloques, estadísticas y datos clave", placeholder: "Ej: Cambio climático, Fotosíntesis, Revolución Industrial..." },
  ppt:         { icon: "📑", label: "Presentación",  color: "#8b5cf6", desc: "Crea slides profesionales con portada, secciones y notas del orador",  placeholder: "Ej: Inteligencia Artificial, Segunda Guerra Mundial..." },
  poster:      { icon: "🎨", label: "Afiche",        color: "#ec4899", desc: "Diseña un poster visual llamativo para ferias o proyectos escolares",   placeholder: "Ej: Día del Medio Ambiente, Derechos del Niño..." },
  podcast:     { icon: "🎙️", label: "Podcast",       color: "#f59e0b", desc: "Genera un guión conversacional entre Álvaro y Elvira con audio",       placeholder: "Ej: Los planetas del sistema solar, La célula..." },
  mindmap:     { icon: "🧠", label: "Mapa Mental",   color: "#10b981", desc: "Organiza conceptos en un árbol interactivo con zoom y navegación",     placeholder: "Ej: Ecosistemas, Tipos de energía, Historia de Chile..." },
  flashcards:  { icon: "📇", label: "Flashcards",    color: "#06b6d4", desc: "Crea tarjetas de estudio integradas con repetición espaciada",         placeholder: "Ej: Vocabulario inglés, Fórmulas química, Capitales..." },
  quiz:        { icon: "✅", label: "Quiz",           color: "#22c55e", desc: "Genera preguntas con feedback, taxonomía de Bloom y puntaje",          placeholder: "Ej: Leyes de Newton, La Reconquista, Álgebra lineal..." },
  timeline:    { icon: "⏳", label: "Timeline",       color: "#f97316", desc: "Construye una línea temporal con hitos y eventos importantes",         placeholder: "Ej: Independencia de Chile, Evolución del internet..." },
}

const SOURCE_TYPES = [
  { id: "topic", icon: "💡", label: "Tema"  },
  { id: "text",  icon: "📝", label: "Texto" },
  { id: "url",   icon: "🔗", label: "URL"   },
  { id: "pdf",   icon: "📄", label: "PDF"   },
  { id: "docx",  icon: "📎", label: "DOCX"  },
]

export default function CreatorHubFormatPage() {
  const params       = useParams()
  const format       = (params?.format as string) || "infographic"
  const meta         = FORMAT_META[format] || FORMAT_META.infographic
  const Renderer     = RENDERERS[format]

  // ── State — idéntico al creator original ─────────────────────────────────
  const [sourceType,   setSourceType]   = useState("topic")
  const [content,      setContent]      = useState("")
  const [fileName,     setFileName]     = useState("")
  const [accentColor,  setAccentColor]  = useState(meta.color)
  const [processing,   setProcessing]   = useState(false)
  const [result,       setResult]       = useState<any>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [step,         setStep]         = useState<"input" | "processing" | "result">("input")
  const fileRef = useRef<HTMLInputElement>(null)

  // ── File handler — idéntico al creator original ───────────────────────────
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1]
      setContent(b64)
    }
    reader.readAsDataURL(file)
  }, [])

  // ── Generate — llama al mismo endpoint que el creator original ────────────
  const handleGenerate = async () => {
    if (!content.trim()) return
    setProcessing(true)
    setError(null)
    setStep("processing")
    try {
      const res = await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, content, fileName, outputFormat: format }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Error procesando")
      setResult(data.output.data)
      setStep("result")
    } catch (err: any) {
      setError(err.message)
      setStep("input")
    } finally {
      setProcessing(false)
    }
  }

  const handleReset = () => {
    setStep("input")
    setResult(null)
    setContent("")
    setFileName("")
    setError(null)
  }

  return (
    <div className="flex flex-col min-h-screen">

      {/* Topbar */}
      <div className="border-b border-soft bg-app backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* Color dot del formato */}
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}
            >
              {meta.icon}
            </div>
            <div>
              <p className="text-main font-bold text-sm leading-tight">{meta.label}</p>
              <p className="text-muted2 text-[11px] hidden sm:block">{meta.desc}</p>
            </div>
          </div>

          {step === "result" && (
            <button
              onClick={handleReset}
              className="text-xs text-muted2 hover:text-main border border-soft rounded-xl px-3 py-1.5 transition-colors flex-shrink-0"
            >
              + Nueva creación
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto w-full px-6 py-8 flex flex-col gap-5">

        {/* ── INPUT ─────────────────────────────────────────────────────────── */}
        {step === "input" && (
          <>
            {/* Fuente */}
            <div>
              <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">FUENTE</label>
              <div className="flex gap-2 flex-wrap">
                {SOURCE_TYPES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSourceType(s.id); setContent(""); setFileName("") }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-sm font-medium transition-all"
                    style={{
                      background:   sourceType === s.id ? `${meta.color}12` : "var(--bg-card)",
                      borderColor:  sourceType === s.id ? `${meta.color}35` : "var(--border-soft)",
                      color:        sourceType === s.id ? meta.color : "#9ca3af",
                    }}
                  >
                    <span>{s.icon}</span>{s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input de contenido */}
            {(sourceType === "topic" || sourceType === "text" || sourceType === "url") ? (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={
                  sourceType === "topic" ? meta.placeholder :
                  sourceType === "url"   ? "https://ejemplo.com/articulo" :
                  "Pega aquí el texto que quieres transformar..."
                }
                className={`w-full bg-card-soft-theme border border-soft rounded-2xl px-4 py-3.5 text-main placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500/30 focus:bg-input-theme transition-all resize-vertical ${
                  sourceType === "text" ? "min-h-[140px]" : "min-h-[56px]"
                }`}
              />
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  content
                    ? "border-green-500/30 bg-green-500/[0.04]"
                    : "border-soft bg-card-soft-theme hover:border-medium"
                }`}
              >
                <div className="text-3xl mb-2">{content ? "✅" : sourceType === "pdf" ? "📄" : "📎"}</div>
                <p className={`text-sm ${content ? "text-green-400" : "text-muted2"}`}>
                  {content ? `${fileName} cargado` : `Clic para subir .${sourceType}`}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept={sourceType === "pdf" ? ".pdf" : ".docx,.doc"}
                  onChange={handleFile}
                  className="hidden"
                />
              </div>
            )}

            {/* Color */}
            <ColorPalette value={accentColor} onChange={setAccentColor} />

            {/* Botón generar */}
            <button
              onClick={handleGenerate}
              disabled={!content.trim() || processing}
              className="w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-30"
              style={{
                background: `linear-gradient(135deg, ${meta.color}cc, ${meta.color})`,
                boxShadow:  content.trim() ? `0 4px 20px ${meta.color}30` : "none",
              }}
            >
              {meta.icon} Generar {meta.label}
            </button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3">
                <p className="text-red-400 text-xs">❌ {error}</p>
              </div>
            )}
          </>
        )}

        {/* ── PROCESSING ────────────────────────────────────────────────────── */}
        {step === "processing" && (
          <div className="text-center py-16">
            <div className="relative w-16 h-16 mx-auto mb-5">
              <div className="w-16 h-16 rounded-full border-2 border-soft border-t-blue-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">{meta.icon}</div>
            </div>
            <h3 className="text-main font-bold text-base mb-1">Generando {meta.label.toLowerCase()}...</h3>
            <p className="text-muted2 text-sm">Extrayendo conceptos y construyendo el resultado</p>
          </div>
        )}

        {/* ── RESULT ────────────────────────────────────────────────────────── */}
        {step === "result" && result && (
          <>
            {/* Success banner */}
            <div
              className="flex items-center gap-2 rounded-2xl p-3 border"
              style={{ background: `${meta.color}08`, borderColor: `${meta.color}25` }}
            >
              <span>✅</span>
              <span className="text-sm font-semibold flex-1" style={{ color: meta.color }}>
                {meta.label} generada correctamente
              </span>
              <button
                onClick={() => navigator.clipboard?.writeText(JSON.stringify(result, null, 2))}
                className="text-[11px] border rounded-lg px-2.5 py-1 hover:opacity-80 transition-opacity"
                style={{ color: meta.color, borderColor: `${meta.color}30` }}
              >
                📋 JSON
              </button>
            </div>

            {/* Resultado */}
            <div
              id="creator-result-container"
              className="rounded-2xl p-5 border"
              style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}
            >
              {Renderer && <Renderer data={result} />}
            </div>

            {/* Descarga */}
            <DownloadBar format={format} data={result} accentColor={accentColor} />
          </>
        )}

      </div>
    </div>
  )
}
