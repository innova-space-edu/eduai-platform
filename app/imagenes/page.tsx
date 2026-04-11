"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ImagePlus, Sparkles, Download, ZoomIn, X, Loader2 } from "lucide-react"

const STYLES = [
  { id: "realistic",    label: "Realista",        emoji: "📷" },
  { id: "digital art",  label: "Arte Digital",    emoji: "🎨" },
  { id: "oil painting", label: "Óleo",            emoji: "🖼️" },
  { id: "anime",        label: "Anime",           emoji: "⛩️" },
  { id: "watercolor",   label: "Acuarela",        emoji: "💧" },
  { id: "3d render",    label: "3D",              emoji: "🧊" },
  { id: "sketch",       label: "Boceto",          emoji: "✏️" },
  { id: "cinematic",    label: "Cinematográfico", emoji: "🎬" },
]

const SIZES = [
  { label: "Horizontal", w: 1024, h: 576  },
  { label: "Cuadrado",   w: 1024, h: 1024 },
  { label: "Vertical",   w: 576,  h: 1024 },
]

const PROVIDERS = [
  { id: "auto",         label: "Auto (mejor disponible)" },
  { id: "gemini",       label: "Gemini Imagen (Google)"  },
  { id: "pollinations", label: "Pollinations (FLUX free)" },
  { id: "together",     label: "Together AI (FLUX)"      },
  { id: "huggingface",  label: "Hugging Face (FLUX/SDXL)"},
  { id: "openrouter",   label: "OpenRouter (premium)"    },
]

const EXAMPLES = [
  "Un astronauta en el espacio profundo, la Tierra detrás de él",
  "Un bosque de bambú al amanecer con niebla",
  "Un robot leyendo un libro en una biblioteca antigua",
  "Una ciudad chilena en el año 2150",
  "Sistema solar visto desde una nave espacial",
  "Un gato samurái bajo la lluvia en Tokio",
]

const LOADING_MESSAGES = [
  "Optimizando tu descripción con IA...",
  "Componiendo la escena...",
  "Añadiendo detalles de iluminación...",
  "Refinando texturas y colores...",
  "Aplicando estilo artístico...",
  "Casi listo...",
]

interface Result {
  imageUrl: string
  optimizedPrompt: string
  provider: string
  originalPrompt: string
}

function ImageSkeleton({ aspectRatio }: { aspectRatio: string }) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const mi = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 2500)
    const pi = setInterval(() => setProgress(p => p >= 92 ? p : p + Math.random() * 3), 300)
    return () => { clearInterval(mi); clearInterval(pi) }
  }, [])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-soft" style={{ aspectRatio }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}>
        <div className="absolute inset-0 opacity-20"
          style={{ background: "linear-gradient(105deg, transparent 40%, rgba(139,92,246,0.4) 50%, transparent 60%)", animation: "shimmer 2s infinite" }} />
      </div>
      <div className="absolute bottom-0 inset-x-0 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 size={13} className="text-purple-400 animate-spin flex-shrink-0" />
          <p className="text-purple-700 text-xs">{LOADING_MESSAGES[msgIdx]}</p>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border-medium)" }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #8b5cf6, #ec4899)" }} />
        </div>
      </div>
      <style>{`@keyframes shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }`}</style>
    </div>
  )
}

export default function ImagenesPage() {
  const [prompt,        setPrompt]        = useState("")
  const [style,         setStyle]         = useState("realistic")
  const [size,          setSize]          = useState(SIZES[0])
  const [provider,      setProvider]      = useState("auto")
  const [loading,       setLoading]       = useState(false)
  const [optimizing,    setOptimizing]    = useState(false)
  const [results,       setResults]       = useState<Result[]>([])
  const [editingPrompt, setEditingPrompt] = useState("")
  const [showEditor,    setShowEditor]    = useState(false)
  const [fullscreen,    setFullscreen]    = useState<string | null>(null)
  const router = useRouter()

  // ── Lógica idéntica al original ──────────────────────────────────────────────
  async function getOptimizedPrompt() {
    if (!prompt.trim()) return
    setOptimizing(true)
    try {
      const res  = await fetch("/api/agents/imagenes/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style }),
      })
      const data = await res.json()
      setEditingPrompt(data.optimizedPrompt || prompt)
      setShowEditor(true)
    } catch {
      setEditingPrompt(prompt); setShowEditor(true)
    } finally { setOptimizing(false) }
  }

  async function generate(useCustomPrompt = false) {
    if (!prompt.trim() || loading) return
    setLoading(true); setShowEditor(false)
    try {
      const res = await fetch("/api/agents/imagenes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, width: size.w, height: size.h, provider, customPrompt: useCustomPrompt ? editingPrompt : undefined }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResults(prev => [{ ...data, originalPrompt: prompt }, ...prev])
      setEditingPrompt(data.optimizedPrompt)
    } catch (e: any) { alert(`Error: ${e.message}`) }
    finally { setLoading(false) }
  }

  function downloadImage(url: string, index: number) {
    const a = document.createElement("a"); a.href = url; a.download = `eduai-imagen-${index + 1}.jpg`; a.click()
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(null) }
    window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn)
  }, [])

  const aspectRatio = `${size.w}/${size.h}`
  const ACCENT = "#ec4899"

  return (
    <div className="min-h-screen bg-app flex flex-col">

      {/* Fullscreen */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setFullscreen(null)}>
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setFullscreen(null)}
              className="absolute -top-12 right-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm text-main transition-all"
              style={{ background: "var(--border-soft)" }}>
              <X size={14} /> Cerrar
            </button>
            <img src={fullscreen} alt="Imagen ampliada" className="w-full rounded-2xl object-contain shadow-2xl" style={{ maxHeight: "85vh" }} />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-soft bg-app backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main hover:bg-input-theme transition-all flex-shrink-0">
            <ArrowLeft size={15} />
          </Link>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0"
               style={{ background: "linear-gradient(135deg, #db2777, #9333ea)", boxShadow: "0 4px 12px rgba(219,39,119,0.3)" }}>
            <ImagePlus size={17} className="text-main" />
          </div>
          <div>
            <h1 className="text-main font-bold text-sm">Generador de Imágenes</h1>
            <p className="text-muted2 text-xs">Prompt optimizado con IA · FLUX · Stable Diffusion</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

        {/* Prompt input */}
        <div className="rounded-2xl p-5 border" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
          <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">DESCRIPCIÓN</label>
          <textarea
            value={prompt} onChange={e => { setPrompt(e.target.value); setShowEditor(false) }}
            placeholder="Ej: Un astronauta en el espacio profundo, la Tierra detrás de él..."
            rows={3}
            className="w-full bg-card-soft-theme border border-soft rounded-xl px-4 py-3 text-main placeholder-gray-400 text-sm focus:outline-none focus:border-pink-500/30 focus:bg-input-theme resize-none transition-all"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => { setPrompt(ex); setShowEditor(false) }}
                className="text-xs px-3 py-1 rounded-full transition-all truncate max-w-xs"
                style={{ background: "rgba(219,39,119,0.08)", border: "1px solid rgba(219,39,119,0.15)", color: "#f9a8d4" }}>
                {ex.slice(0, 30)}…
              </button>
            ))}
          </div>
        </div>

        {/* Prompt editor */}
        {showEditor && (
          <div className="rounded-2xl p-4 border animate-fade-in"
               style={{ background: "rgba(59,130,246,0.05)", borderColor: "rgba(59,130,246,0.2)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-blue-700 text-xs font-medium">✨ Prompt optimizado — puedes editarlo</p>
              <button onClick={() => setShowEditor(false)} className="text-muted2 hover:text-sub"><X size={14} /></button>
            </div>
            <textarea value={editingPrompt} onChange={e => setEditingPrompt(e.target.value)} rows={4}
              className="w-full bg-card-soft-theme border border-blue-500/20 rounded-xl px-4 py-3 text-sub text-xs focus:outline-none focus:border-blue-500/40 resize-none font-mono leading-relaxed transition-all" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => generate(true)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #db2777, #9333ea)" }}>
                🎨 Generar con este prompt
              </button>
              <button onClick={() => generate(false)}
                className="px-4 py-2.5 rounded-xl text-sm text-sub transition-all"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)" }}>
                Ignorar
              </button>
            </div>
          </div>
        )}

        {/* Controls grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Estilos */}
          <div className="rounded-2xl p-4 border md:col-span-2" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
            <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-3">ESTILO ARTÍSTICO</label>
            <div className="grid grid-cols-4 gap-2">
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all"
                  style={{
                    background:  style === s.id ? "rgba(219,39,119,0.1)" : "var(--bg-card-soft)",
                    borderColor: style === s.id ? "rgba(219,39,119,0.35)" : "var(--bg-card-soft)",
                    color:       style === s.id ? "#f9a8d4" : "var(--text-muted)",
                  }}>
                  <span className="text-lg">{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tamaño + Proveedor */}
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl p-4 border" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
              <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">TAMAÑO</label>
              <div className="flex flex-col gap-1.5">
                {SIZES.map(s => (
                  <button key={s.label} onClick={() => setSize(s)}
                    className="text-xs py-2 px-3 rounded-xl border text-left transition-all"
                    style={{
                      background:  size.label === s.label ? "rgba(219,39,119,0.1)" : "var(--bg-card-soft)",
                      borderColor: size.label === s.label ? "rgba(219,39,119,0.3)" : "var(--bg-card-soft)",
                      color:       size.label === s.label ? "#f9a8d4" : "var(--text-muted)",
                    }}>
                    {s.label} <span className="opacity-40">{s.w}×{s.h}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl p-4 border" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
              <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">MODELO</label>
              <select value={provider} onChange={e => setProvider(e.target.value)}
                className="w-full border border-medium rounded-xl px-3 py-2 text-sub text-xs focus:outline-none transition-all appearance-none cursor-pointer"
                style={{ background: "var(--bg-card-soft)", colorScheme: "dark" }}>
                {PROVIDERS.map(p => <option key={p.id} value={p.id} style={{ background: "var(--bg-card-soft)", color: "var(--text-secondary)" }}>{p.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        {!showEditor && (
          <div className="flex gap-3">
            <button onClick={getOptimizedPrompt} disabled={!prompt.trim() || optimizing || loading}
              className="flex-1 py-3.5 rounded-2xl font-medium text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)", color: "var(--text-muted)" }}>
              {optimizing
                ? <><Loader2 size={15} className="animate-spin" /> Optimizando...</>
                : <><Sparkles size={15} /> Ver prompt optimizado</>}
            </button>
            <button onClick={() => generate(false)} disabled={!prompt.trim() || loading || optimizing}
              className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #db2777, #9333ea)", boxShadow: prompt.trim() ? "0 4px 20px rgba(219,39,119,0.3)" : "none" }}>
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Generando...</>
                : <>🎨 Generar imagen</>}
            </button>
          </div>
        )}

        {/* Resultados */}
        {results.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-main font-semibold text-sm">Imágenes generadas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Skeleton mientras carga */}
              {loading && <ImageSkeleton aspectRatio={aspectRatio} />}
              {results.map((r, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-soft group"
                     style={{ background: "var(--bg-card)" }}>
                  <div className="relative" style={{ aspectRatio }}>
                    <img src={r.imageUrl} alt={r.originalPrompt}
                      onClick={() => setFullscreen(r.imageUrl)}
                      className="w-full h-full object-cover cursor-zoom-in" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3"
                         style={{ background: "rgba(0,0,0,0.6)" }}>
                      <button onClick={() => setFullscreen(r.imageUrl)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-main backdrop-blur-sm"
                        style={{ background: "var(--border-medium)" }}>
                        <ZoomIn size={13} /> Ampliar
                      </button>
                      <button onClick={() => downloadImage(r.imageUrl, i)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-main backdrop-blur-sm"
                        style={{ background: "var(--border-medium)" }}>
                        <Download size={13} /> Descargar
                      </button>
                      <button onClick={() => { setPrompt(r.originalPrompt); setEditingPrompt(r.optimizedPrompt); setShowEditor(true) }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-main backdrop-blur-sm"
                        style={{ background: "var(--border-medium)" }}>
                        ✏️ Refinar
                      </button>
                    </div>
                  </div>
                  <div className="p-3 border-t border-soft">
                    <p className="text-muted2 text-xs mb-1">via {r.provider}</p>
                    <p className="text-muted2 text-xs italic leading-relaxed line-clamp-2">{r.optimizedPrompt}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skeleton inicial */}
        {loading && results.length === 0 && (
          <ImageSkeleton aspectRatio={aspectRatio} />
        )}
      </div>
    </div>
  )
}
