"use client"
// app/imagenes/page.tsx — v3
// Nuevos estilos: 3D Animation, Comic Book, Neon Cyberpunk, Fantasy, Retrato HD
// Modo Calidad con prompts estructurados para mejores caras

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, ImagePlus, Sparkles, Download, ZoomIn, X, Loader2, RefreshCw } from "lucide-react"

const STYLES = [
  { id: "realistic",      label: "Foto Real",       emoji: "📷", tip: "Mejor para retratos y escenas realistas" },
  { id: "portrait",       label: "Retrato HD",       emoji: "👤", tip: "Optimizado para caras con máximo detalle" },
  { id: "3d animation",   label: "3D Animation",     emoji: "🎬", tip: "Estilo Pixar/Disney 3D" },
  { id: "comic book",     label: "Cómic",            emoji: "💥", tip: "Estilo cómic americano clásico" },
  { id: "digital art",    label: "Arte Digital",     emoji: "🎨", tip: "Ilustración digital profesional" },
  { id: "anime",          label: "Anime",            emoji: "⛩️", tip: "Estilo anime japonés de alta calidad" },
  { id: "cinematic",      label: "Cinematográfico",  emoji: "🎬", tip: "Estilo película, iluminación dramática" },
  { id: "neon cyberpunk", label: "Cyberpunk",        emoji: "🌆", tip: "Neón y futurismo urbano" },
  { id: "fantasy",        label: "Fantasía",         emoji: "🔮", tip: "Arte épico de fantasía" },
  { id: "oil painting",   label: "Óleo",             emoji: "🖼️", tip: "Pintura al óleo clásica" },
  { id: "watercolor",     label: "Acuarela",         emoji: "💧", tip: "Pintura acuarela artística" },
  { id: "sketch",         label: "Boceto",           emoji: "✏️", tip: "Dibujo a lápiz detallado" },
  { id: "3d render",      label: "3D Render",        emoji: "🧊", tip: "Render 3D fotorrealista" },
  { id: "architectural",  label: "Arquitectura",     emoji: "🏛️", tip: "Fotografía arquitectónica" },
  { id: "educational",    label: "Educativo",        emoji: "📚", tip: "Diagrama o ilustración pedagógica" },
]

const SIZES = [
  { label: "Horizontal", w: 1024, h: 576,  icon: "▬" },
  { label: "Cuadrado",   w: 1024, h: 1024, icon: "■" },
  { label: "Vertical",   w: 576,  h: 1024, icon: "▮" },
  { label: "Portrait",   w: 832,  h: 1216, icon: "▯" },
]

const MODES = [
  { id: "fast",    label: "⚡ Rápido",  desc: "~15s, buena calidad" },
  { id: "quality", label: "✨ Calidad", desc: "~45s, máximo detalle" },
]

const PROVIDERS = [
  { id: "auto",         label: "Auto (mejor disponible)"        },
  { id: "stability",    label: "Stability AI (SD3.5 / Core)"    },
  { id: "together",     label: "Together AI (FLUX.2 / SD3.5)"   },
  { id: "openrouter",   label: "OpenRouter (Seedream/FLUX)"      },
  { id: "gemini",       label: "Gemini Imagen (Google)"          },
  { id: "pollinations", label: "Pollinations (FLUX free)"        },
  { id: "huggingface",  label: "Hugging Face (SDXL/FLUX)"        },
]

// Portrait presets — descripciones de personas con alta calidad facial
const PORTRAIT_PRESETS = [
  "Una mujer joven con cabello castaño rizado, ojos verdes expresivos, sonrisa natural, en un parque al atardecer",
  "Un hombre adulto con barba corta, mirada intensa, iluminación de estudio profesional",
  "Una estudiante universitaria con lentes, pelo negro largo liso, en una biblioteca moderna",
  "Un niño de 8 años riendo con pecas, cabello rubio, en un día soleado de verano",
]

const EXAMPLES = [
  "Un astronauta flotando frente a la Tierra en el espacio profundo",
  "Un bosque de bambú al amanecer con niebla suave",
  "Una ciudad chilena futurista en el año 2150",
  "Un robot leyendo un libro en una biblioteca antigua de madera",
  "Sistema solar visto desde una nave espacial con anillos de Saturno visibles",
  "Un gato samurái bajo la lluvia en Tokio neon",
]

const LOADING_MESSAGES = [
  "Construyendo el prompt con IA...",
  "Generando la composición...",
  "Añadiendo detalles de iluminación...",
  "Refinando texturas y colores...",
  "Aplicando estilo artístico...",
  "Procesando la imagen...",
  "Ajustando detalles finales...",
  "Casi listo...",
]

interface Result {
  imageUrl: string
  optimizedPrompt: string
  provider: string
  originalPrompt: string
  style: string
  mode: string
}

function ImageSkeleton({ aspectRatio }: { aspectRatio: string }) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const mi = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 2800)
    const pi = setInterval(() => setProgress(p => p >= 92 ? p : p + Math.random() * 2.5), 350)
    return () => { clearInterval(mi); clearInterval(pi) }
  }, [])
  return (
    <div className="relative overflow-hidden rounded-2xl border border-soft" style={{ aspectRatio }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}>
        <div className="absolute inset-0 opacity-20"
          style={{ background: "linear-gradient(105deg, transparent 40%, rgba(139,92,246,0.4) 50%, transparent 60%)", animation: "shimmer 2s infinite" }} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-5xl opacity-10">🎨</div>
      </div>
      <div className="absolute bottom-0 inset-x-0 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 size={12} className="text-purple-400 animate-spin flex-shrink-0" />
          <p className="text-purple-300/70 text-xs">{LOADING_MESSAGES[msgIdx]}</p>
        </div>
        <div className="h-1 rounded-full overflow-hidden bg-white/10">
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
  const [mode,          setMode]          = useState("fast")
  const [loading,       setLoading]       = useState(false)
  const [optimizing,    setOptimizing]    = useState(false)
  const [results,       setResults]       = useState<Result[]>([])
  const [editingPrompt, setEditingPrompt] = useState("")
  const [showEditor,    setShowEditor]    = useState(false)
  const [fullscreen,    setFullscreen]    = useState<string | null>(null)

  const currentStyle = STYLES.find(s => s.id === style) || STYLES[0]
  const isPortraitStyle = style === "realistic" || style === "portrait"

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
    } catch { setEditingPrompt(prompt); setShowEditor(true) }
    finally { setOptimizing(false) }
  }

  async function generate(useCustomPrompt = false) {
    if (!prompt.trim() || loading) return
    setLoading(true); setShowEditor(false)
    try {
      const res = await fetch("/api/agents/imagenes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, style, width: size.w, height: size.h, provider, mode,
          customPrompt: useCustomPrompt ? editingPrompt : undefined,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResults(prev => [{ ...data, originalPrompt: prompt, style, mode }, ...prev])
      setEditingPrompt(data.optimizedPrompt)
    } catch (e: any) { alert(`Error: ${e.message}`) }
    finally { setLoading(false) }
  }

  function downloadImage(url: string, index: number) {
    const a = document.createElement("a"); a.href = url; a.download = `eduai-imagen-${index + 1}.png`; a.click()
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(null) }
    window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn)
  }, [])

  const aspectRatioStr = `${size.w}/${size.h}`
  const ACCENT = "#ec4899"

  return (
    <div className="min-h-screen bg-app flex flex-col">

      {/* Fullscreen */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setFullscreen(null)}>
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setFullscreen(null)}
              className="absolute -top-12 right-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm text-main"
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
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main transition-all flex-shrink-0">
            <ArrowLeft size={15} />
          </Link>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #db2777, #9333ea)", boxShadow: "0 4px 12px rgba(219,39,119,0.3)" }}>
            <ImagePlus size={17} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-main font-bold text-sm">Image Studio</h1>
            <p className="text-muted2 text-xs">FLUX.2 · Gemini · Seedream · {STYLES.length} estilos</p>
          </div>
          {/* Mode toggle in header */}
          <div className="flex rounded-xl overflow-hidden border border-soft">
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className="px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: mode === m.id ? "linear-gradient(135deg, #db2777, #9333ea)" : "var(--bg-card-soft)",
                  color: mode === m.id ? "white" : "var(--text-muted)",
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

        {/* Prompt input */}
        <div className="rounded-2xl p-5 border border-soft" style={{ background: "var(--bg-card-soft)" }}>
          <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">DESCRIPCIÓN</label>
          <textarea
            value={prompt} onChange={e => { setPrompt(e.target.value); setShowEditor(false) }}
            placeholder={isPortraitStyle
              ? "Ej: Una mujer joven con cabello castaño, ojos expresivos, sonrisa natural, en un parque al atardecer..."
              : "Ej: Un astronauta en el espacio profundo, la Tierra brillando detrás de él..."}
            rows={3}
            className="w-full bg-card-soft-theme border border-soft rounded-xl px-4 py-3 text-main placeholder-gray-400 text-sm focus:outline-none focus:border-pink-500/30 resize-none transition-all"
          />

          {/* Portrait presets (only for portrait styles) */}
          {isPortraitStyle && (
            <div className="mt-3">
              <p className="text-muted2 text-[10px] font-semibold tracking-widest mb-2">PRESETS DE RETRATO</p>
              <div className="flex flex-col gap-1.5">
                {PORTRAIT_PRESETS.map(ex => (
                  <button key={ex} onClick={() => { setPrompt(ex); setShowEditor(false) }}
                    className="text-left text-xs px-3 py-2 rounded-xl transition-all"
                    style={{ background: "rgba(219,39,119,0.06)", border: "1px solid rgba(219,39,119,0.12)", color: "#f9a8d4" }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Examples (non-portrait) */}
          {!isPortraitStyle && (
            <div className="flex flex-wrap gap-2 mt-3">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => { setPrompt(ex); setShowEditor(false) }}
                  className="text-xs px-3 py-1 rounded-full transition-all truncate max-w-xs"
                  style={{ background: "rgba(219,39,119,0.08)", border: "1px solid rgba(219,39,119,0.15)", color: "#f9a8d4" }}>
                  {ex.slice(0, 32)}…
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Prompt editor */}
        {showEditor && (
          <div className="rounded-2xl p-4 border"
            style={{ background: "rgba(59,130,246,0.05)", borderColor: "rgba(59,130,246,0.2)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-blue-400 text-xs font-medium">✨ Prompt estructurado FLUX.2 — puedes editarlo</p>
              <button onClick={() => setShowEditor(false)} className="text-muted2 hover:text-sub"><X size={14} /></button>
            </div>
            <textarea value={editingPrompt} onChange={e => setEditingPrompt(e.target.value)} rows={4}
              className="w-full bg-card-soft-theme border border-blue-500/20 rounded-xl px-4 py-3 text-sub text-xs focus:outline-none focus:border-blue-500/40 resize-none font-mono leading-relaxed" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => generate(true)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #db2777, #9333ea)" }}>
                🎨 Generar con este prompt
              </button>
              <button onClick={() => generate(false)}
                className="px-4 py-2.5 rounded-xl text-sm text-sub border border-soft">
                Ignorar
              </button>
            </div>
          </div>
        )}

        {/* Style grid */}
        <div className="rounded-2xl p-5 border border-soft" style={{ background: "var(--bg-card-soft)" }}>
          <div className="flex items-center justify-between mb-3">
            <label className="text-muted2 text-[11px] font-semibold tracking-widest">ESTILO ARTÍSTICO</label>
            {currentStyle.tip && <span className="text-muted2 text-[10px]">💡 {currentStyle.tip}</span>}
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {STYLES.map(s => (
              <button key={s.id} onClick={() => setStyle(s.id)} title={s.tip}
                className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-[10px] font-medium transition-all"
                style={{
                  background:  style === s.id ? "rgba(219,39,119,0.12)" : "var(--bg-card-soft)",
                  borderColor: style === s.id ? "rgba(219,39,119,0.4)"  : "var(--border-soft)",
                  color:       style === s.id ? "#f9a8d4"               : "var(--text-muted)",
                  boxShadow:   style === s.id ? "0 0 10px rgba(219,39,119,0.2)" : "none",
                }}>
                <span className="text-lg">{s.emoji}</span>
                <span className="text-center leading-tight">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Size + Provider row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 border border-soft" style={{ background: "var(--bg-card-soft)" }}>
            <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">TAMAÑO</label>
            <div className="grid grid-cols-2 gap-1.5">
              {SIZES.map(s => (
                <button key={s.label} onClick={() => setSize(s)}
                  className="text-xs py-2 px-2 rounded-xl border text-left transition-all flex items-center gap-1.5"
                  style={{
                    background:  size.label === s.label ? "rgba(219,39,119,0.1)"  : "var(--bg-card-soft)",
                    borderColor: size.label === s.label ? "rgba(219,39,119,0.3)"  : "var(--border-soft)",
                    color:       size.label === s.label ? "#f9a8d4"               : "var(--text-muted)",
                  }}>
                  <span className="text-base leading-none">{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-4 border border-soft" style={{ background: "var(--bg-card-soft)" }}>
            <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">MODELO</label>
            <select value={provider} onChange={e => setProvider(e.target.value)}
              className="w-full border border-soft rounded-xl px-3 py-2 text-sub text-xs focus:outline-none appearance-none cursor-pointer"
              style={{ background: "var(--bg-card-soft)", colorScheme: "dark" }}>
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <p className="text-muted2 text-[10px] mt-2">
              {mode === "quality"
                ? "✨ Calidad: SD3.5 Large + FLUX.2 Pro"
                : "⚡ Rápido: Stable Image Core + FLUX schnell"}
            </p>
          </div>
        </div>

        {/* Buttons */}
        {!showEditor && (
          <div className="flex gap-3">
            <button onClick={getOptimizedPrompt} disabled={!prompt.trim() || optimizing || loading}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-medium text-sm transition-all disabled:opacity-40 border border-soft text-sub hover:text-main"
              style={{ background: "var(--bg-card-soft)" }}>
              {optimizing
                ? <><Loader2 size={15} className="animate-spin" /> Optimizando...</>
                : <><Sparkles size={15} /> Ver prompt</>}
            </button>
            <button onClick={() => generate(false)} disabled={!prompt.trim() || loading || optimizing}
              className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #db2777, #9333ea)",
                boxShadow: prompt.trim() ? "0 4px 20px rgba(219,39,119,0.35)" : "none",
              }}>
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Generando...</>
                : <>🎨 Generar {mode === "quality" ? "(Calidad)" : ""}</>}
            </button>
          </div>
        )}

        {/* Quality tip */}
        {mode === "quality" && isPortraitStyle && (
          <div className="rounded-xl px-4 py-2.5 text-xs text-purple-300/80 border border-purple-500/15"
            style={{ background: "rgba(139,92,246,0.06)" }}>
            💡 Modo Calidad con Retrato HD usa FLUX.2 Pro con 35 pasos y prompt estructurado con especificaciones de cámara para máximo detalle facial.
          </div>
        )}

        {/* Results */}
        {(results.length > 0 || loading) && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-main font-semibold text-sm">
                {results.length > 0 ? `${results.length} imagen${results.length > 1 ? "es" : ""} generada${results.length > 1 ? "s" : ""}` : "Generando..."}
              </h2>
              {results.length > 0 && (
                <button onClick={() => setResults([])} className="text-muted2 text-xs hover:text-sub flex items-center gap-1">
                  <X size={12} /> Limpiar
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading && <ImageSkeleton aspectRatio={aspectRatioStr} />}
              {results.map((r, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-soft group" style={{ background: "var(--bg-card)" }}>
                  <div className="relative" style={{ aspectRatio: aspectRatioStr }}>
                    <img src={r.imageUrl} alt={r.originalPrompt}
                      onClick={() => setFullscreen(r.imageUrl)}
                      className="w-full h-full object-cover cursor-zoom-in" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
                      style={{ background: "rgba(0,0,0,0.65)" }}>
                      <button onClick={() => setFullscreen(r.imageUrl)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white backdrop-blur-sm border border-white/20">
                        <ZoomIn size={12} /> Ampliar
                      </button>
                      <button onClick={() => downloadImage(r.imageUrl, i)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white backdrop-blur-sm border border-white/20">
                        <Download size={12} /> Guardar
                      </button>
                      <button onClick={() => { setPrompt(r.originalPrompt); setEditingPrompt(r.optimizedPrompt); setShowEditor(true) }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white backdrop-blur-sm border border-white/20">
                        <RefreshCw size={12} /> Refinar
                      </button>
                    </div>
                    {/* Style badge */}
                    <div className="absolute top-2 left-2">
                      <span className="text-[10px] px-2 py-1 rounded-full font-medium backdrop-blur-sm"
                        style={{ background: "rgba(0,0,0,0.5)", color: "#f9a8d4" }}>
                        {STYLES.find(s => s.id === r.style)?.emoji} {STYLES.find(s => s.id === r.style)?.label}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 border-t border-soft">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-muted2 text-[10px]">via {r.provider}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-soft text-muted2">
                        {r.mode === "quality" ? "✨ Calidad" : "⚡ Rápido"}
                      </span>
                    </div>
                    <p className="text-muted2 text-xs italic leading-relaxed line-clamp-2">{r.optimizedPrompt}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
