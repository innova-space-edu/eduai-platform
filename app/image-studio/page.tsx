"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import {
  ArrowLeft, Sparkles, Download, Trash2,
  ZoomIn, ChevronLeft, ChevronRight, Search,
  SlidersHorizontal, ImagePlus, X,
} from "lucide-react"

// ─── Constantes ───────────────────────────────────────────────────────────────
const STYLES = [
  { id: "realistic",    label: "Realista",        emoji: "📷" },
  { id: "digital art",  label: "Arte Digital",    emoji: "🎨" },
  { id: "oil painting", label: "Óleo",            emoji: "🖼️" },
  { id: "anime",        label: "Anime",           emoji: "⛩️" },
  { id: "watercolor",   label: "Acuarela",        emoji: "💧" },
  { id: "3d render",    label: "3D",              emoji: "🧊" },
  { id: "sketch",       label: "Boceto",          emoji: "✏️" },
  { id: "cinematic",    label: "Cinematográfico", emoji: "🎬" },
  { id: "educational",  label: "Educativo",       emoji: "📚" },
  { id: "flat design",  label: "Flat Design",     emoji: "✦"  },
]

const SIZES = [
  { label: "Horizontal", w: 1024, h: 576,  ratio: "16/9" },
  { label: "Cuadrado",   w: 1024, h: 1024, ratio: "1/1"  },
  { label: "Vertical",   w: 576,  h: 1024, ratio: "9/16" },
]

const PROVIDERS = [
  { id: "auto",         label: "⚡ Auto (recomendado)" },
  { id: "gemini",       label: "✦ Gemini Imagen"       },
  { id: "pollinations", label: "🌸 Pollinations FLUX"  },
  { id: "together",     label: "⚡ Together FLUX"      },
  { id: "huggingface",  label: "🤗 Hugging Face"       },
  { id: "openrouter",   label: "🔑 OpenRouter"         },
]

const MODES = [
  { id: "fast",        label: "Rápido",    desc: "Menor costo"        },
  { id: "quality",     label: "Calidad",   desc: "Mejor acabado"      },
  { id: "educational", label: "Educativo", desc: "Diagramas y texto"  },
]

const EXAMPLES = [
  "Un sistema solar con planetas etiquetados",
  "La mitocondria como ciudad futurista",
  "La Revolución Francesa en un cuadro épico",
  "ADN doble hélice con colores vibrantes",
  "Célula animal con orgánulos iluminados",
  "Ecosistema marino con biodiversidad",
]

// ─── Steps de generación ──────────────────────────────────────────────────────
const GEN_STEPS = [
  { label: "Analizando descripción...",       pct: 8  },
  { label: "Optimizando prompt con IA...",    pct: 18 },
  { label: "Inicializando red neuronal...",   pct: 32 },
  { label: "Sintetizando tokens visuales...", pct: 46 },
  { label: "Renderizando capas de difusión...",pct: 61},
  { label: "Refinando texturas y colores...", pct: 74 },
  { label: "Aplicando estilo artístico...",   pct: 87 },
  { label: "Finalizando imagen...",           pct: 95 },
]

// ─── Animación futurista de generación ───────────────────────────────────────
function GeneratingAnimation({ prompt, style }: { prompt: string; style: string }) {
  const [stepIdx, setStepIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [glitch, setGlitch] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // Avanzar steps
  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch(true)
      setTimeout(() => setGlitch(false), 180)
      setStepIdx(i => Math.min(i + 1, GEN_STEPS.length - 1))
    }, 3200)
    return () => clearInterval(interval)
  }, [])

  // Progreso suave
  useEffect(() => {
    const target = GEN_STEPS[stepIdx].pct
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= target) return p
        return Math.min(p + 0.6, target)
      })
    }, 30)
    return () => clearInterval(interval)
  }, [stepIdx])

  // Canvas — partículas y red neuronal
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rawCtx = canvas.getContext("2d")
    if (!rawCtx) return
    const ctx: CanvasRenderingContext2D = rawCtx

    const W = canvas.width  = canvas.offsetWidth  || 600
    const H = canvas.height = canvas.offsetHeight || 400

    // Nodos de la red
    const NODE_COUNT = 22
    type Node = { x: number; y: number; vx: number; vy: number; r: number; pulse: number }
    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 2.5 + 1,
      pulse: Math.random() * Math.PI * 2,
    }))

    // Partículas flotantes
    const PART_COUNT = 35
    type Particle = { x: number; y: number; vy: number; alpha: number; size: number; color: string }
    const particles: Particle[] = Array.from({ length: PART_COUNT }, () => ({
      x: Math.random() * W,
      y: H + Math.random() * 50,
      vy: -(Math.random() * 0.8 + 0.3),
      alpha: Math.random() * 0.6 + 0.2,
      size: Math.random() * 2 + 0.5,
      color: ["#00f5ff", "#8b5cf6", "#ec4899", "#22d3ee"][Math.floor(Math.random() * 4)],
    }))

    let scanY = 0
    let frame = 0

    function draw() {
      ctx.clearRect(0, 0, W, H)

      // Fondo
      ctx.fillStyle = "rgba(2,6,20,0.92)"
      ctx.fillRect(0, 0, W, H)

      // Grid suave
      ctx.strokeStyle = "rgba(0,245,255,0.04)"
      ctx.lineWidth = 0.5
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      // Scan beam
      scanY = (scanY + 1.8) % H
      const scanGrad = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20)
      scanGrad.addColorStop(0,   "rgba(0,245,255,0)")
      scanGrad.addColorStop(0.5, "rgba(0,245,255,0.18)")
      scanGrad.addColorStop(1,   "rgba(0,245,255,0)")
      ctx.fillStyle = scanGrad
      ctx.fillRect(0, scanY - 20, W, 40)

      // Mover nodos
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.pulse += 0.04
        if (n.x < 0 || n.x > W) n.vx *= -1
        if (n.y < 0 || n.y > H) n.vy *= -1
      })

      // Conexiones entre nodos cercanos
      nodes.forEach((a, i) => {
        nodes.slice(i + 1).forEach(b => {
          const dx = a.x - b.x, dy = a.y - b.y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 120) {
            const alpha = (1 - dist/120) * 0.5
            const t = (frame / 60) % 1
            const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
            grad.addColorStop(0,   `rgba(0,245,255,${alpha * 0.7})`)
            grad.addColorStop(0.5, `rgba(139,92,246,${alpha})`)
            grad.addColorStop(1,   `rgba(236,72,153,${alpha * 0.7})`)
            ctx.strokeStyle = grad
            ctx.lineWidth = 0.7
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()

            // Pulso viajando en la línea
            const px = a.x + (b.x - a.x) * t
            const py = a.y + (b.y - a.y) * t
            ctx.beginPath()
            ctx.arc(px, py, 2, 0, Math.PI*2)
            ctx.fillStyle = `rgba(0,245,255,${alpha * 1.5})`
            ctx.fill()
          }
        })
      })

      // Nodos
      nodes.forEach(n => {
        const pSize = Math.max(0.1, n.r + Math.sin(n.pulse) * 1.2)
        // Glow
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, pSize * 5)
        glow.addColorStop(0, "rgba(0,245,255,0.3)")
        glow.addColorStop(1, "rgba(0,245,255,0)")
        ctx.beginPath()
        ctx.arc(n.x, n.y, pSize * 5, 0, Math.PI*2)
        ctx.fillStyle = glow; ctx.fill()
        // Core
        ctx.beginPath()
        ctx.arc(n.x, n.y, pSize, 0, Math.PI*2)
        ctx.fillStyle = "#00f5ff"; ctx.fill()
      })

      // Partículas
      particles.forEach(p => {
        p.y += p.vy
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W }
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2)
        ctx.fill()
      })
      ctx.globalAlpha = 1

      frame++
      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const step = GEN_STEPS[stepIdx]

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{
      background: "linear-gradient(160deg, #020614, #050d24, #020614)",
      border: "1px solid rgba(0,245,255,0.15)",
      boxShadow: "0 0 60px rgba(0,245,255,0.06), inset 0 0 60px rgba(0,0,0,0.5)",
    }}>
      {/* Canvas de fondo */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.9 }} />

      {/* Corner brackets */}
      {[["top-3 left-3", "border-t-2 border-l-2"], ["top-3 right-3", "border-t-2 border-r-2"],
        ["bottom-3 left-3", "border-b-2 border-l-2"], ["bottom-3 right-3", "border-b-2 border-r-2"]
      ].map(([pos, border], i) => (
        <div key={i} className={`absolute ${pos} w-4 h-4 ${border}`}
          style={{ borderColor: "rgba(0,245,255,0.6)" }} />
      ))}

      {/* Contenido principal */}
      <div className="relative z-10 flex flex-col items-center justify-center py-14 px-8 gap-8 min-h-[340px]">

        {/* Orbe central */}
        <div className="relative flex items-center justify-center">
          <div className="absolute" style={{
            width: 90, height: 90, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,245,255,0.25), rgba(139,92,246,0.15), transparent 70%)",
            animation: "pulse-orb 2s ease-in-out infinite",
          }} />
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(0,245,255,0.25), rgba(139,92,246,0.35))",
            border: "1px solid rgba(0,245,255,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "spin-slow 8s linear infinite",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, #00f5ff, #8b5cf6)",
              animation: "pulse-orb 1.5s ease-in-out infinite alternate",
            }} />
          </div>
          {/* Anillos orbitales */}
          {[{ size: 80, dur: "4s" }, { size: 104, dur: "7s" }].map(({ size, dur }, i) => (
            <div key={i} className="absolute" style={{
              width: size, height: size, borderRadius: "50%",
              border: `1px solid rgba(0,245,255,${i === 0 ? 0.35 : 0.15})`,
              animation: `spin-slow ${dur} linear infinite ${i === 1 ? "reverse" : ""}`,
            }} />
          ))}
        </div>

        {/* Texto de estado */}
        <div className="text-center space-y-2">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase"
            style={{ color: "rgba(0,245,255,0.6)" }}>
            Generación en progreso
          </p>
          <p className={`text-base font-semibold transition-all duration-200 ${glitch ? "translate-x-0.5 blur-[0.5px]" : ""}`}
            style={{
              color: "var(--text-primary)",
              textShadow: glitch ? "2px 0 rgba(0,245,255,0.6), -2px 0 rgba(236,72,153,0.6)" : "none",
            }}>
            {step.label}
          </p>
          {prompt && (
            <p className="text-xs max-w-xs mx-auto truncate"
              style={{ color: "rgba(139,92,246,0.8)" }}>
              "{prompt.slice(0, 52)}{prompt.length > 52 ? "…" : ""}"
            </p>
          )}
        </div>

        {/* Barra de progreso */}
        <div className="w-full max-w-xs">
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px]" style={{ color: "rgba(0,245,255,0.5)" }}>
              {style.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono" style={{ color: "rgba(0,245,255,0.7)" }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-card-soft)", border: "1px solid rgba(0,245,255,0.15)" }}>
            <div className="h-full rounded-full transition-all duration-300 relative overflow-hidden"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #00f5ff, #8b5cf6, #ec4899)",
                boxShadow: "0 0 8px rgba(0,245,255,0.7)",
              }}>
              <div className="absolute inset-0"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                  animation: "shimmer-bar 1.5s infinite",
                }} />
            </div>
          </div>

          {/* Mini steps */}
          <div className="flex justify-between mt-2.5">
            {GEN_STEPS.filter((_, i) => i % 2 === 0).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full transition-all duration-500"
                style={{
                  background: i * 2 <= stepIdx ? "#00f5ff" : "var(--border-medium)",
                  boxShadow: i * 2 <= stepIdx ? "0 0 6px #00f5ff" : "none",
                }} />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-orb {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface GalleryImage {
  id: string; prompt: string; optimized_prompt: string; image_url: string
  provider: string; style: string; source: string; topic: string | null
  width: number; height: number; created_at: string
}
type FilterSource    = "all" | "manual" | "auto_study"
type PanelMode       = "generate" | "gallery"
type GenerationMode  = "fast" | "quality" | "educational"

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ImageStudioPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [panel, setPanel] = useState<PanelMode>("generate")

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
    })
  }, [router, supabase])

  // Generate state
  const [prompt,     setPrompt]     = useState("")
  const [style,      setStyle]      = useState("realistic")
  const [sizeIdx,    setSizeIdx]    = useState(0)
  const [provider,   setProvider]   = useState("auto")
  const [mode,       setMode]       = useState<GenerationMode>("fast")
  const [generating, setGenerating] = useState(false)
  const [genError,   setGenError]   = useState("")
  const [result,     setResult]     = useState<{
    imageUrl: string; optimizedPrompt: string; provider: string; model?: string
  } | null>(null)

  // Gallery state
  const [images,     setImages]     = useState<GalleryImage[]>([])
  const [galLoading, setGalLoading] = useState(true)
  const [filter,     setFilter]     = useState<FilterSource>("all")
  const [search,     setSearch]     = useState("")
  const [fullscreen, setFullscreen] = useState<GalleryImage | null>(null)
  const [fsIdx,      setFsIdx]      = useState(0)

  useEffect(() => { loadGallery() }, [])

  async function loadGallery() {
    setGalLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGalLoading(false); return }
    const { data } = await supabase
      .from("generated_images").select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(120)
    setImages(data || [])
    setGalLoading(false)
  }

  async function handleGenerate() {
    if (!prompt.trim() || generating) return
    setGenerating(true); setGenError(""); setResult(null)
    const size = SIZES[sizeIdx]
    try {
      const res = await fetch("/api/agents/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), style, width: size.w, height: size.h, provider, mode, source: "manual" }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => `Error ${res.status}`)
        throw new Error(text)
      }
      const data = await res.json()
      setResult({ imageUrl: data.imageUrl, optimizedPrompt: data.optimizedPrompt, provider: data.provider, model: data.model })
      // Recargar galería después de un momento para que Supabase registre
      setTimeout(loadGallery, 2000)
    } catch (err: any) {
      setGenError(err?.message || "Error desconocido")
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete(id: string) {
    await supabase.from("generated_images").delete().eq("id", id)
    setImages(prev => prev.filter(i => i.id !== id))
    if (fullscreen?.id === id) setFullscreen(null)
  }

  function handleDownload(imageUrl: string, promptText: string) {
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = `eduai-${promptText.slice(0, 30).replace(/\s+/g, "-")}.jpg`
    a.click()
  }

  const filtered = images.filter(img => {
    const matchSrc    = filter === "all" || img.source === filter
    const matchSearch = !search.trim() || img.prompt.toLowerCase().includes(search.toLowerCase())
    return matchSrc && matchSearch
  })

  function openFullscreen(img: GalleryImage) {
    const idx = filtered.findIndex(i => i.id === img.id)
    setFsIdx(idx); setFullscreen(img)
  }
  function fsNav(dir: -1 | 1) {
    const next = fsIdx + dir
    if (next < 0 || next >= filtered.length) return
    setFsIdx(next); setFullscreen(filtered[next])
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (!fullscreen) return
      if (e.key === "Escape")      setFullscreen(null)
      if (e.key === "ArrowLeft")  fsNav(-1)
      if (e.key === "ArrowRight") fsNav(1)
    }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [fullscreen, fsIdx, filtered])

  const styleLabel = Object.fromEntries(STYLES.map(s => [s.id, s.label]))

  return (
    <div className="min-h-screen bg-app">

      {/* ── Fullscreen viewer ──────────────────────────────────────────────── */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/97 flex flex-col" onClick={() => setFullscreen(null)}>
          <div className="flex items-start justify-between p-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-muted2 text-sm leading-relaxed">{fullscreen.prompt}</p>
              <p className="text-muted2 text-xs mt-1">{styleLabel[fullscreen.style] || fullscreen.style} · {fullscreen.provider}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => handleDownload(fullscreen.image_url, fullscreen.prompt)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-main transition-all"
                style={{ background: "var(--border-soft)", border: "1px solid var(--border-medium)" }}>
                <Download size={13} /> Descargar
              </button>
              <button onClick={() => handleDelete(fullscreen.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <Trash2 size={13} /> Eliminar
              </button>
              <button onClick={() => setFullscreen(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-sub hover:text-main"
                style={{ background: "var(--bg-card-soft)" }}>
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center relative px-4 pb-4" onClick={e => e.stopPropagation()}>
            {fsIdx > 0 && (
              <button onClick={() => fsNav(-1)} className="absolute left-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-main"
                style={{ background: "var(--border-soft)", border: "1px solid var(--border-medium)" }}>
                <ChevronLeft size={18} />
              </button>
            )}
            <img src={fullscreen.image_url} alt={fullscreen.prompt}
              className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl" />
            {fsIdx < filtered.length - 1 && (
              <button onClick={() => fsNav(1)} className="absolute right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-main"
                style={{ background: "var(--border-soft)", border: "1px solid var(--border-medium)" }}>
                <ChevronRight size={18} />
              </button>
            )}
          </div>
          <div className="text-center pb-4 flex-shrink-0">
            <span className="text-muted2 text-xs">{fsIdx + 1} / {filtered.length}</span>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-soft bg-app backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main hover:bg-input-theme transition-all flex-shrink-0">
            <ArrowLeft size={15} />
          </Link>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#db2777,#9333ea)", boxShadow: "0 4px 12px rgba(219,39,119,0.3)" }}>
            <ImagePlus size={17} className="text-main" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-main font-bold text-sm leading-tight">Image Studio</h1>
            <p className="text-muted2 text-[11px]">Gemini · Pollinations · FLUX · IA multiproveedor</p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)" }}>
            {(["generate", "gallery"] as PanelMode[]).map(p => (
              <button key={p} onClick={() => setPanel(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background:  panel === p ? "rgba(219,39,119,0.15)" : "transparent",
                  color:       panel === p ? "#f9a8d4" : "#6b7280",
                }}>
                {p === "generate" ? "✨ Generar" : `🖼️ Galería (${images.length})`}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── Panel Generar ──────────────────────────────────────────────── */}
        {panel === "generate" && (
          <div className="flex flex-col gap-5">

            {/* Prompt */}
            <div>
              <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">DESCRIPCIÓN</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleGenerate() }}
                placeholder="Describe la imagen que quieres crear..."
                className="w-full bg-card-soft-theme border border-soft rounded-2xl px-4 py-3.5 text-main placeholder-gray-400 text-sm focus:outline-none focus:border-pink-500/30 focus:bg-input-theme transition-all resize-none min-h-[80px]"
              />
              <div className="flex gap-2 flex-wrap mt-2">
                {EXAMPLES.slice(0, 3).map(ex => (
                  <button key={ex} onClick={() => setPrompt(ex)}
                    className="text-[10px] px-2.5 py-1 rounded-lg border transition-all"
                    style={{ background: "rgba(219,39,119,0.06)", borderColor: "rgba(219,39,119,0.15)", color: "#f9a8d4" }}>
                    {ex.slice(0, 32)}…
                  </button>
                ))}
              </div>
            </div>

            {/* Controls grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Estilos */}
              <div>
                <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">ESTILO</label>
                <div className="flex flex-wrap gap-1.5">
                  {STYLES.map(s => (
                    <button key={s.id} onClick={() => setStyle(s.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all"
                      style={{
                        background:  style === s.id ? "rgba(219,39,119,0.1)" : "var(--bg-card-soft)",
                        borderColor: style === s.id ? "rgba(219,39,119,0.3)" : "var(--bg-card-soft)",
                        color:       style === s.id ? "#f9a8d4" : "#6b7280",
                      }}>
                      <span>{s.emoji}</span><span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tamaño */}
              <div>
                <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">TAMAÑO</label>
                <div className="flex flex-col gap-1.5">
                  {SIZES.map((s, i) => (
                    <button key={s.label} onClick={() => setSizeIdx(i)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left"
                      style={{
                        background:  sizeIdx === i ? "rgba(219,39,119,0.1)" : "var(--bg-card-soft)",
                        borderColor: sizeIdx === i ? "rgba(219,39,119,0.3)" : "var(--bg-card-soft)",
                        color:       sizeIdx === i ? "#f9a8d4" : "#6b7280",
                      }}>
                      <div className="rounded flex-shrink-0" style={{
                        width: s.ratio === "16/9" ? 18 : s.ratio === "1/1" ? 12 : 9,
                        height: s.ratio === "16/9" ? 10 : s.ratio === "1/1" ? 12 : 16,
                        background: sizeIdx === i ? "rgba(219,39,119,0.4)" : "rgba(255,255,255,0.2)",
                        border: `1px solid ${sizeIdx === i ? "rgba(219,39,119,0.6)" : "rgba(255,255,255,0.2)"}`,
                      }} />
                      <span>{s.label}</span>
                      <span className="ml-auto opacity-50">{s.w}×{s.h}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Proveedor */}
              <div>
                <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">PROVEEDOR</label>
                <div className="flex flex-col gap-1.5">
                  {PROVIDERS.map(p => (
                    <button key={p.id} onClick={() => setProvider(p.id)}
                      className="px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left"
                      style={{
                        background:  provider === p.id ? "rgba(219,39,119,0.1)" : "var(--bg-card-soft)",
                        borderColor: provider === p.id ? "rgba(219,39,119,0.3)" : "var(--bg-card-soft)",
                        color:       provider === p.id ? "#f9a8d4" : "#6b7280",
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modo */}
            <div>
              <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">MODO</label>
              <div className="flex gap-2 flex-wrap">
                {MODES.map(m => (
                  <button key={m.id} onClick={() => setMode(m.id as GenerationMode)}
                    className="flex flex-col px-4 py-2 rounded-xl text-xs font-medium border transition-all text-left"
                    style={{
                      background:  mode === m.id ? "rgba(219,39,119,0.1)" : "var(--bg-card-soft)",
                      borderColor: mode === m.id ? "rgba(219,39,119,0.3)" : "var(--bg-card-soft)",
                      color:       mode === m.id ? "#f9a8d4" : "#6b7280",
                    }}>
                    <span className="font-semibold">{m.label}</span>
                    <span className="text-[10px] opacity-60 mt-0.5">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Botón generar */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
              className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg,#be185d,#db2777)",
                boxShadow: prompt.trim() && !generating ? "0 4px 20px rgba(219,39,119,0.35)" : "none",
              }}>
              <Sparkles size={17} />
              {generating ? "Generando imagen..." : "Generar imagen"}
            </button>

            {/* ── ANIMACIÓN DE GENERACIÓN ────────────────────────────────── */}
            {generating && (
              <GeneratingAnimation prompt={prompt} style={style} />
            )}

            {/* Error */}
            {genError && !generating && (
              <div className="px-4 py-3 rounded-2xl border border-red-500/25 bg-red-500/[0.07] text-red-400 text-xs leading-relaxed whitespace-pre-wrap">
                ❌ {genError}
              </div>
            )}

            {/* Resultado */}
            {result && !generating && (
              <div className="flex flex-col gap-3">
                <div className="relative rounded-2xl overflow-hidden border border-medium"
                  style={{ boxShadow: "0 8px 40px rgba(219,39,119,0.15)" }}>
                  <img src={result.imageUrl} alt={prompt}
                    className="w-full object-cover"
                    style={{ aspectRatio: SIZES[sizeIdx].ratio }} />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button onClick={() => handleDownload(result.imageUrl, prompt)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-main backdrop-blur-md"
                      style={{ background: "rgba(0,0,0,0.65)", border: "1px solid var(--border-medium)" }}>
                      <Download size={13} /> Descargar
                    </button>
                  </div>
                </div>

                <div className="px-4 py-3 rounded-xl border"
                  style={{ background: "rgba(219,39,119,0.05)", borderColor: "rgba(219,39,119,0.15)" }}>
                  <p className="text-[10px] text-pink-400 font-semibold uppercase tracking-widest mb-1">Prompt optimizado</p>
                  <p className="text-sub text-xs leading-relaxed">{result.optimizedPrompt}</p>
                  <p className="text-muted2 text-[10px] mt-1.5">
                    {result.provider}{result.model ? ` · ${result.model}` : ""}
                  </p>
                </div>

                <button onClick={() => { setResult(null); setPrompt("") }}
                  className="text-muted2 hover:text-sub text-xs transition-colors text-center">
                  + Nueva imagen
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Panel Galería ──────────────────────────────────────────────── */}
        {panel === "gallery" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por descripción..."
                  className="w-full bg-card-soft-theme border border-soft rounded-xl pl-9 pr-4 py-2.5 text-sub placeholder-gray-400 text-sm focus:outline-none focus:border-pink-500/30 transition-all" />
              </div>
              <div className="flex gap-1.5">
                {(["all","manual","auto_study"] as FilterSource[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className="px-3 py-2 rounded-xl text-xs font-medium border transition-all"
                    style={{
                      background:  filter === f ? "rgba(219,39,119,0.1)" : "var(--bg-card-soft)",
                      borderColor: filter === f ? "rgba(219,39,119,0.3)" : "var(--bg-card-soft)",
                      color:       filter === f ? "#f9a8d4" : "#6b7280",
                    }}>
                    {f === "all" ? "Todas" : f === "manual" ? "Manual" : "Auto-estudio"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3 rounded-2xl border"
              style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
              <div className="flex items-center gap-2 text-sub text-xs">
                <SlidersHorizontal size={13} />
                <span>{filtered.length} imágenes</span>
              </div>
              <button onClick={loadGallery} className="text-xs text-pink-400 hover:text-pink-700 transition-colors">
                Recargar
              </button>
            </div>

            {galLoading ? (
              <div className="py-16 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-pink-500/30 border-t-pink-400 animate-spin" />
                  <p className="text-muted2 text-xs">Cargando galería...</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 rounded-2xl border text-center"
                style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: "rgba(219,39,119,0.08)" }}>
                  <ImagePlus size={24} className="text-pink-400" />
                </div>
                <p className="text-sub text-sm font-medium mb-1">No hay imágenes todavía</p>
                <p className="text-muted2 text-xs">Genera tu primera imagen para verla aquí.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filtered.map(img => (
                  <div key={img.id}
                    className="group relative rounded-2xl overflow-hidden border border-soft cursor-pointer transition-all hover:border-soft hover:scale-[1.02]"
                    style={{ aspectRatio: img.width && img.height ? `${img.width}/${img.height}` : "16/9", background: "#0a1020" }}
                    onClick={() => openFullscreen(img)}>
                    <img src={img.image_url} alt={img.prompt}
                      className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)" }}>
                      <div className="flex justify-end">
                        <button onClick={e => { e.stopPropagation(); handleDelete(img.id) }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg backdrop-blur-md"
                          style={{ background: "rgba(239,68,68,0.3)", border: "1px solid rgba(239,68,68,0.4)" }}>
                          <Trash2 size={12} className="text-red-700" />
                        </button>
                      </div>
                      <div>
                        <p className="text-sub text-[10px] leading-tight line-clamp-2 mb-2">{img.prompt}</p>
                        <div className="flex gap-1.5">
                          <button onClick={e => { e.stopPropagation(); handleDownload(img.image_url, img.prompt) }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-main backdrop-blur-md"
                            style={{ background: "var(--border-medium)" }}>
                            <Download size={10} /> Descargar
                          </button>
                          <button onClick={e => { e.stopPropagation(); openFullscreen(img) }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-main backdrop-blur-md"
                            style={{ background: "var(--border-medium)" }}>
                            <ZoomIn size={10} /> Ver
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
